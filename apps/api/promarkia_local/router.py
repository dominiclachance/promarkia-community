import hashlib
import ipaddress
import json
import mimetypes
import os
import socket
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel, Field as PydanticField
from sqlalchemy import func
from sqlmodel import Session, select

from autogenstudio.web.deps import get_db
from autogenstudio.datamodel import Team

from .catalog import LAUNCHPAD, SQUADS
from .models import (
    LocalApproval,
    LocalArtifact,
    LocalIntegration,
    LocalLaunchpadWorkflow,
    LocalMcpServer,
    LocalProfile,
    LocalSchedule,
    LocalUsageBudget,
    LocalUsageEvent,
    LocalSecret,
)
from .vault import LocalVault

router = APIRouter()


def now() -> datetime:
    return datetime.now(timezone.utc)


def app_root() -> Path:
    return Path(os.getenv("AUTOGENSTUDIO_APPDIR", str(Path.home() / ".promarkia")))


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _validated_provider_target(provider: str, target: str) -> str:
    parsed = urllib.parse.urlparse(target)
    hostname = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme not in {"http", "https"} or not hostname:
        raise HTTPException(400, "Provider URL must use HTTP or HTTPS")
    if parsed.username or parsed.password:
        raise HTTPException(400, "Provider URL must not contain credentials")
    if provider not in {"openai", "ollama", "openai-compatible"}:
        raise HTTPException(400, "Unsupported model provider")
    if provider == "openai" and (parsed.scheme != "https" or hostname != "api.openai.com"):
        raise HTTPException(400, "OpenAI must use https://api.openai.com")
    if provider == "ollama" and hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise HTTPException(400, "Ollama must use a loopback URL")

    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        addresses = {
            ipaddress.ip_address(item[4][0])
            for item in socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
        }
    except (OSError, ValueError) as exc:
        raise HTTPException(400, "Provider hostname could not be resolved") from exc
    if not addresses:
        raise HTTPException(400, "Provider hostname could not be resolved")
    if any(address.is_link_local or address.is_multicast or address.is_unspecified or address.is_reserved for address in addresses):
        raise HTTPException(400, "Provider URL resolves to a prohibited network address")
    return parsed.geturl()


class ProfileInput(BaseModel):
    display_name: str = "Local Owner"
    email: str = "local@promarkia.local"
    workspace_name: str = "My Workspace"
    preferences: dict[str, Any] = PydanticField(default_factory=dict)


class SecretInput(BaseModel):
    name: str
    value: str


class ProviderInput(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o-mini"
    base_url: str = "https://api.openai.com/v1"
    input_cost_per_million: float = 0
    output_cost_per_million: float = 0


class IntegrationInput(BaseModel):
    provider: str
    account_label: str = "default"
    kind: str = "api"
    enabled: bool = True
    settings: dict[str, Any] = PydanticField(default_factory=dict)
    secrets: dict[str, str] = PydanticField(default_factory=dict)


class McpInput(BaseModel):
    name: str
    transport: str = "stdio"
    command: Optional[str] = None
    args: list[str] = PydanticField(default_factory=list)
    url: Optional[str] = None
    env_secrets: dict[str, str] = PydanticField(default_factory=dict)
    enabled: bool = True


class ScheduleInput(BaseModel):
    name: str
    team_id: int
    task: str
    recurrence: dict[str, Any] = PydanticField(default_factory=dict)
    timezone: str = "America/New_York"
    next_run_at: Optional[datetime] = None
    status: str = "active"
    require_approval: bool = True


class ApprovalInput(BaseModel):
    action: str
    provider: str
    payload: dict[str, Any] = PydanticField(default_factory=dict)
    preview: dict[str, Any] = PydanticField(default_factory=dict)


class ApprovalDecision(BaseModel):
    note: Optional[str] = None


class BudgetInput(BaseModel):
    monthly_limit_usd: float = 25
    warning_percent: int = 80
    hard_cap_enabled: bool = False


@router.get("/health")
def health():
    return {"status": True, "mode": "local", "billing": False, "firestore": False}


@router.get("/capabilities")
def capabilities():
    return {
        "mode": "local",
        "squads": SQUADS,
        "features": {
            "chat": True, "routing": True, "history": True, "artifacts": True,
            "image": True, "video": True, "integrations": True, "mcp": True,
            "publishing": True, "approval_required": True, "scheduling": True,
            "launchpad": True, "usage_ledger": True, "billing": False,
            "firebase": False, "multi_tenant_cloud": False,
        },
    }


@router.get("/profile")
def get_profile(db=Depends(get_db)):
    with Session(db.engine) as session:
        profile = session.get(LocalProfile, "local")
        if not profile:
            profile = LocalProfile()
            session.add(profile)
            session.commit()
            session.refresh(profile)
        return profile


@router.put("/profile")
def put_profile(payload: ProfileInput, db=Depends(get_db)):
    with Session(db.engine) as session:
        profile = session.get(LocalProfile, "local") or LocalProfile()
        for key, value in payload.model_dump().items():
            setattr(profile, key, value)
        profile.updated_at = now()
        session.add(profile)
        session.commit()
        session.refresh(profile)
        return profile


@router.get("/secrets")
def list_secrets(db=Depends(get_db)):
    with Session(db.engine) as session:
        rows = session.exec(select(LocalSecret).order_by(LocalSecret.name)).all()
        return [{"name": row.name, "configured": True, "updated_at": row.updated_at} for row in rows]


@router.put("/secrets/{name}")
def put_secret(name: str, payload: SecretInput, db=Depends(get_db)):
    if name != payload.name or not payload.value:
        raise HTTPException(400, "A matching name and non-empty value are required")
    vault = LocalVault(app_root())
    with Session(db.engine) as session:
        row = session.exec(select(LocalSecret).where(LocalSecret.name == name)).first()
        if row:
            row.encrypted_value = vault.encrypt(payload.value)
            row.updated_at = now()
        else:
            row = LocalSecret(name=name, encrypted_value=vault.encrypt(payload.value))
        session.add(row)
        session.commit()
    return {"name": name, "configured": True}


@router.delete("/secrets/{name}")
def delete_secret(name: str, db=Depends(get_db)):
    with Session(db.engine) as session:
        row = session.exec(select(LocalSecret).where(LocalSecret.name == name)).first()
        if row:
            session.delete(row)
            session.commit()
    return {"status": True}


@router.get("/provider")
def get_provider(db=Depends(get_db)):
    with Session(db.engine) as session:
        profile = session.get(LocalProfile, "local") or LocalProfile()
        prefs = profile.preferences or {}
    return {
        "provider": prefs.get("model_provider", "openai"),
        "model": prefs.get("model", "gpt-4o-mini"),
        "base_url": prefs.get("base_url", "https://api.openai.com/v1"),
        "input_cost_per_million": prefs.get("input_cost_per_million", 0),
        "output_cost_per_million": prefs.get("output_cost_per_million", 0),
    }


@router.put("/provider")
def put_provider(payload: ProviderInput, db=Depends(get_db)):
    provider = payload.provider.lower().strip()
    if provider not in {"openai", "ollama", "openai-compatible"}:
        raise HTTPException(400, "Provider must be openai, ollama, or openai-compatible")
    if provider != "openai" and not payload.base_url.startswith(("http://", "https://")):
        raise HTTPException(400, "A valid provider base URL is required")
    with Session(db.engine) as session:
        profile = session.get(LocalProfile, "local") or LocalProfile()
        preferences = dict(profile.preferences or {})
        preferences.update({
            "model_provider": provider,
            "model": payload.model.strip(),
            "base_url": payload.base_url.rstrip("/"),
            "input_cost_per_million": max(payload.input_cost_per_million, 0),
            "output_cost_per_million": max(payload.output_cost_per_million, 0),
        })
        profile.preferences = preferences
        profile.updated_at = now()
        session.add(profile)
        session.commit()
    return get_provider(db)


@router.post("/provider/test")
def test_provider(payload: ProviderInput, db=Depends(get_db)):
    provider = payload.provider.lower().strip()
    base_url = payload.base_url.rstrip("/")
    if provider == "ollama" and base_url.endswith("/v1"):
        target = base_url[:-3] + "/api/tags"
        headers = {}
    else:
        target = base_url + "/models"
        headers = {}
        if provider == "openai":
            vault = LocalVault(app_root())
            with Session(db.engine) as session:
                secret = session.exec(select(LocalSecret).where(LocalSecret.name == "OPENAI_API_KEY")).first()
            if not secret:
                raise HTTPException(400, "OPENAI_API_KEY is not configured")
            headers["Authorization"] = f"Bearer {vault.decrypt(secret.encrypted_value)}"
    validated_target = _validated_provider_target(provider, target)
    try:
        # The endpoint is deliberately owner-configurable for self-hosted models.
        # Validation above blocks credentials, metadata/link-local ranges, unsafe
        # provider/host combinations, and redirects. CodeQL cannot infer those
        # application-level controls.
        opener = urllib.request.build_opener(_NoRedirectHandler())
        with opener.open(  # lgtm[py/full-ssrf]
            urllib.request.Request(validated_target, headers=headers), timeout=8
        ) as response:
            if response.status >= 300:
                raise HTTPException(502, f"Provider returned HTTP {response.status}")
        return {"status": True, "provider": provider, "model": payload.model}
    except (urllib.error.URLError, TimeoutError) as exc:
        raise HTTPException(502, f"Provider connection failed: {exc.reason if hasattr(exc, 'reason') else exc}") from exc


@router.get("/integrations")
def integrations(db=Depends(get_db)):
    with Session(db.engine) as session:
        return session.exec(select(LocalIntegration).order_by(LocalIntegration.provider)).all()


@router.post("/integrations")
def add_integration(payload: IntegrationInput, db=Depends(get_db)):
    vault = LocalVault(app_root())
    secret_names = []
    with Session(db.engine) as session:
        for key, value in payload.secrets.items():
            name = f"integration.{payload.provider}.{payload.account_label}.{key}"
            row = session.exec(select(LocalSecret).where(LocalSecret.name == name)).first()
            if row:
                row.encrypted_value = vault.encrypt(value)
                row.updated_at = now()
            else:
                row = LocalSecret(name=name, encrypted_value=vault.encrypt(value))
            session.add(row)
            secret_names.append(name)
        integration = session.exec(
            select(LocalIntegration)
            .where(LocalIntegration.provider == payload.provider)
            .where(LocalIntegration.account_label == payload.account_label)
        ).first()
        if integration:
            for key, value in payload.model_dump(exclude={"secrets"}).items():
                setattr(integration, key, value)
            integration.secret_names = sorted(set((integration.secret_names or []) + secret_names))
            integration.updated_at = now()
        else:
            integration = LocalIntegration(**payload.model_dump(exclude={"secrets"}), secret_names=secret_names)
        session.add(integration)
        session.commit()
        session.refresh(integration)
        return integration


@router.delete("/integrations/{integration_id}")
def delete_integration(integration_id: int, db=Depends(get_db)):
    with Session(db.engine) as session:
        row = session.get(LocalIntegration, integration_id)
        if not row:
            raise HTTPException(404, "Integration not found")
        for name in row.secret_names or []:
            secret = session.exec(select(LocalSecret).where(LocalSecret.name == name)).first()
            if secret:
                session.delete(secret)
        session.delete(row)
        session.commit()
    return {"status": True}


@router.get("/mcp-servers")
def mcp_servers(db=Depends(get_db)):
    with Session(db.engine) as session:
        return session.exec(select(LocalMcpServer).order_by(LocalMcpServer.name)).all()


@router.post("/mcp-servers")
def add_mcp(payload: McpInput, db=Depends(get_db)):
    vault = LocalVault(app_root())
    names = []
    with Session(db.engine) as session:
        for key, value in payload.env_secrets.items():
            name = f"mcp.{payload.name}.{key}"
            secret = session.exec(select(LocalSecret).where(LocalSecret.name == name)).first()
            if secret:
                secret.encrypted_value = vault.encrypt(value)
                secret.updated_at = now()
            else:
                secret = LocalSecret(name=name, encrypted_value=vault.encrypt(value))
            session.add(secret)
            names.append(name)
        row = session.exec(select(LocalMcpServer).where(LocalMcpServer.name == payload.name)).first()
        if row:
            for key, value in payload.model_dump(exclude={"env_secrets"}).items():
                setattr(row, key, value)
            row.env_secret_names = sorted(set((row.env_secret_names or []) + names))
            row.updated_at = now()
        else:
            row = LocalMcpServer(**payload.model_dump(exclude={"env_secrets"}), env_secret_names=names)
        session.add(row)
        session.commit()
        session.refresh(row)
        return row


@router.delete("/mcp-servers/{server_id}")
def delete_mcp(server_id: int, db=Depends(get_db)):
    with Session(db.engine) as session:
        row = session.get(LocalMcpServer, server_id)
        if not row:
            raise HTTPException(404, "MCP server not found")
        for name in row.env_secret_names or []:
            secret = session.exec(select(LocalSecret).where(LocalSecret.name == name)).first()
            if secret:
                session.delete(secret)
        session.delete(row)
        session.commit()
    return {"status": True}


@router.get("/schedules")
def schedules(db=Depends(get_db)):
    with Session(db.engine) as session:
        return session.exec(select(LocalSchedule).order_by(LocalSchedule.created_at.desc())).all()


@router.post("/schedules")
def create_schedule(payload: ScheduleInput, db=Depends(get_db)):
    if payload.team_id not in {s["id"] for s in SQUADS}:
        raise HTTPException(400, "Unknown squad")
    row = LocalSchedule(**payload.model_dump())
    with Session(db.engine) as session:
        session.add(row)
        session.commit()
        session.refresh(row)
        return row


@router.put("/schedules/{schedule_id}")
def update_schedule(schedule_id: int, payload: ScheduleInput, db=Depends(get_db)):
    with Session(db.engine) as session:
        row = session.get(LocalSchedule, schedule_id)
        if not row:
            raise HTTPException(404, "Schedule not found")
        for key, value in payload.model_dump().items():
            setattr(row, key, value)
        row.updated_at = now()
        session.add(row)
        session.commit()
        session.refresh(row)
        return row


@router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db=Depends(get_db)):
    with Session(db.engine) as session:
        row = session.get(LocalSchedule, schedule_id)
        if row:
            session.delete(row)
            session.commit()
    return {"status": True}


@router.get("/approvals")
def approvals(status: Optional[str] = None, db=Depends(get_db)):
    with Session(db.engine) as session:
        statement = select(LocalApproval).order_by(LocalApproval.requested_at.desc())
        if status:
            statement = statement.where(LocalApproval.status == status)
        return session.exec(statement).all()


@router.post("/approvals")
def request_approval(payload: ApprovalInput, db=Depends(get_db)):
    row = LocalApproval(**payload.model_dump())
    with Session(db.engine) as session:
        session.add(row)
        session.commit()
        session.refresh(row)
        return row


def decide_approval(approval_id: int, status: str, payload: ApprovalDecision, db):
    with Session(db.engine) as session:
        row = session.get(LocalApproval, approval_id)
        if not row or row.status != "pending":
            raise HTTPException(409, "Approval is not pending")
        row.status = status
        row.decision_note = payload.note
        row.decided_at = now()
        session.add(row)
        session.commit()
        session.refresh(row)
        return row


@router.post("/approvals/{approval_id}/approve")
def approve(approval_id: int, payload: ApprovalDecision, db=Depends(get_db)):
    return decide_approval(approval_id, "approved", payload, db)


@router.post("/approvals/{approval_id}/reject")
def reject(approval_id: int, payload: ApprovalDecision, db=Depends(get_db)):
    return decide_approval(approval_id, "rejected", payload, db)


@router.post("/artifacts/upload")
async def upload_artifact(file: UploadFile, session_id: Optional[int] = None, run_id: Optional[int] = None, db=Depends(get_db)):
    data = await file.read()
    digest = hashlib.sha256(data).hexdigest()
    files_root = app_root() / "files"
    artifact_dir = files_root / "artifacts" / digest[:2]
    artifact_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename or "artifact.bin").name
    target = artifact_dir / f"{digest}-{safe_name}"
    if not target.exists():
        target.write_bytes(data)
    row = LocalArtifact(
        session_id=session_id, run_id=run_id, name=safe_name,
        media_type=file.content_type or mimetypes.guess_type(safe_name)[0] or "application/octet-stream",
        relative_path=str(target.relative_to(files_root)).replace("\\", "/"), size_bytes=len(data), sha256=digest,
    )
    with Session(db.engine) as session:
        session.add(row)
        session.commit()
        session.refresh(row)
        return row


@router.get("/artifacts")
def artifacts(session_id: Optional[int] = None, db=Depends(get_db)):
    with Session(db.engine) as session:
        statement = select(LocalArtifact).order_by(LocalArtifact.created_at.desc())
        if session_id is not None:
            statement = statement.where(LocalArtifact.session_id == session_id)
        return session.exec(statement).all()


@router.delete("/artifacts/{artifact_id}")
def delete_artifact(artifact_id: int, db=Depends(get_db)):
    with Session(db.engine) as session:
        row = session.get(LocalArtifact, artifact_id)
        if not row:
            raise HTTPException(404, "Artifact not found")
        target = (app_root() / "files" / row.relative_path).resolve()
        files_root = (app_root() / "files").resolve()
        if files_root in target.parents and target.exists():
            target.unlink()
        session.delete(row)
        session.commit()
    return {"status": True}


@router.get("/launchpad")
def launchpad(db=Depends(get_db)):
    with Session(db.engine) as session:
        rows = session.exec(select(LocalLaunchpadWorkflow).where(LocalLaunchpadWorkflow.enabled == True)).all()  # noqa: E712
        return rows


@router.get("/usage")
def usage(db=Depends(get_db)):
    with Session(db.engine) as session:
        month_start = now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        total = session.exec(
            select(func.coalesce(func.sum(LocalUsageEvent.estimated_cost_usd), 0.0))
            .where(LocalUsageEvent.created_at >= month_start)
        ).one()
        events = session.exec(
            select(LocalUsageEvent)
            .where(LocalUsageEvent.created_at >= month_start)
            .order_by(LocalUsageEvent.created_at.desc()).limit(100)
        ).all()
        budget = session.get(LocalUsageBudget, "default") or LocalUsageBudget()
        percent = (float(total) / budget.monthly_limit_usd * 100) if budget.monthly_limit_usd > 0 else 0
        return {"estimated_cost_usd": float(total), "percent": percent, "budget": budget, "events": events}


@router.put("/usage/budget")
def update_budget(payload: BudgetInput, db=Depends(get_db)):
    if not 1 <= payload.warning_percent <= 100 or payload.monthly_limit_usd < 0:
        raise HTTPException(400, "Invalid budget")
    with Session(db.engine) as session:
        row = session.get(LocalUsageBudget, "default") or LocalUsageBudget()
        for key, value in payload.model_dump().items():
            setattr(row, key, value)
        row.updated_at = now()
        session.add(row)
        session.commit()
        session.refresh(row)
        return row


def seed_local_catalog(db) -> None:
    with Session(db.engine) as session:
        if not session.get(LocalProfile, "local"):
            session.add(LocalProfile())
        if not session.get(LocalUsageBudget, "default"):
            session.add(LocalUsageBudget())
        for workflow_id, title, team_id, template in LAUNCHPAD:
            if not session.get(LocalLaunchpadWorkflow, workflow_id):
                session.add(LocalLaunchpadWorkflow(
                    id=workflow_id, title=title, team_id=team_id,
                    description=f"Run {title.lower()} with human approval before external actions.",
                    prompt_template=template,
                    form_schema={"fields": [{"name": "goal", "type": "textarea", "required": True}]},
                ))
        squad_bundle = Path(__file__).with_name("squads.json")
        if squad_bundle.exists():
            for squad in json.loads(squad_bundle.read_text(encoding="utf-8")):
                row = session.get(Team, int(squad["id"]))
                if row is None:
                    session.add(Team(
                        id=int(squad["id"]),
                        user_id="guestuser@gmail.com",
                        component=squad["component"],
                    ))
        session.commit()
