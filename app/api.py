from __future__ import annotations

from pathlib import Path
from urllib.parse import urlsplit

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import Settings
from .db import Database
from .models import CampaignAccepted, CampaignCreate, CampaignRecord, CampaignStatus
from .providers import create_provider
from .services.artifacts import ArtifactStore
from .services.campaigns import CampaignService
from .services.safe_fetch import UnsafeUrlError


LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost", "testserver"}


def _is_loopback_request_host(value: str | None) -> bool:
    if not value:
        return False
    return value.rstrip(".").lower() in LOOPBACK_HOSTS


def create_app(settings: Settings | None = None, service: CampaignService | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    settings.ensure_directories()
    database = service.database if service else Database(settings.database_path)
    database.initialize()
    database.recover_interrupted()
    artifacts = service.artifacts if service else ArtifactStore(settings.campaigns_dir)
    service = service or CampaignService(
        settings=settings,
        database=database,
        artifacts=artifacts,
        provider=create_provider(settings),
    )

    app = FastAPI(title="Promarkia Community", version="0.1.0")
    static_dir = Path(__file__).parent / "static"
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.middleware("http")
    async def local_request_guard(request: Request, call_next):
        if not _is_loopback_request_host(request.url.hostname):
            return JSONResponse(status_code=400, content={"detail": "Local host required"})

        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("origin")
            if origin and not _is_loopback_request_host(urlsplit(origin).hostname):
                return JSONResponse(status_code=403, content={"detail": "Cross-site request blocked"})
            if request.headers.get("sec-fetch-site", "").lower() == "cross-site":
                return JSONResponse(status_code=403, content={"detail": "Cross-site request blocked"})

        response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; "
            "form-action 'self'; object-src 'none'"
        )
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    def serialize_campaign(campaign: dict) -> CampaignRecord:
        payload = dict(campaign)
        payload["artifacts"] = [
            {
                **artifact,
                "url": f"/api/campaigns/{campaign['id']}/artifacts/{artifact['name']}",
            }
            for artifact in artifacts.list(campaign["id"])
        ]
        return CampaignRecord.model_validate(payload)

    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(static_dir / "index.html")

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "provider": service.provider.name,
            "model": service.provider.model,
            "database": "ok" if settings.database_path.exists() else "missing",
            "artifact_directory": "ok" if settings.campaigns_dir.is_dir() else "missing",
        }

    @app.get("/api/campaigns", response_model=list[CampaignRecord])
    def list_campaigns():
        return [serialize_campaign(campaign) for campaign in database.list_campaigns()]

    @app.post("/api/campaigns", response_model=CampaignAccepted, status_code=status.HTTP_202_ACCEPTED)
    def create_campaign(request: CampaignCreate, background_tasks: BackgroundTasks):
        try:
            campaign = service.create(request)
        except UnsafeUrlError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        background_tasks.add_task(service.run, campaign["id"])
        return CampaignAccepted(id=campaign["id"], status=CampaignStatus.QUEUED)

    @app.get("/api/campaigns/{campaign_id}", response_model=CampaignRecord)
    def get_campaign(campaign_id: str):
        campaign = database.get_campaign(campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return serialize_campaign(campaign)

    @app.post("/api/campaigns/{campaign_id}/approve", response_model=CampaignRecord)
    def approve_campaign(campaign_id: str):
        try:
            return serialize_campaign(service.approve(campaign_id))
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Campaign not found") from error
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.post(
        "/api/campaigns/{campaign_id}/retry",
        response_model=CampaignAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def retry_campaign(campaign_id: str, background_tasks: BackgroundTasks):
        try:
            campaign = service.retry(campaign_id)
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Campaign not found") from error
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        background_tasks.add_task(service.run, campaign_id)
        return CampaignAccepted(id=campaign_id, status=CampaignStatus.QUEUED)

    @app.get("/api/campaigns/{campaign_id}/artifacts/{name}")
    def get_artifact(campaign_id: str, name: str):
        if not database.get_campaign(campaign_id):
            raise HTTPException(status_code=404, detail="Campaign not found")
        try:
            path = artifacts.read_path(campaign_id, name)
        except (ValueError, FileNotFoundError) as error:
            raise HTTPException(status_code=404, detail="Artifact not found") from error
        media_type = "application/json" if name.endswith(".json") else "text/plain"
        return FileResponse(path, media_type=media_type, filename=name)

    return app


app = create_app()
