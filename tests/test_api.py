from fastapi.testclient import TestClient

from app.api import create_app
from app.config import Settings
from app.db import Database
from app.providers.mock import MockProvider
from app.services.artifacts import ArtifactStore
from app.services.campaigns import CampaignService


def make_client(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.campaigns.validate_public_url", lambda value: value)
    settings = Settings(data_dir=tmp_path)
    settings.ensure_directories()
    database = Database(settings.database_path)
    database.initialize()
    service = CampaignService(
        settings=settings,
        database=database,
        artifacts=ArtifactStore(settings.campaigns_dir),
        provider=MockProvider(),
        fetcher=lambda *args, **kwargs: ("https://example.com/", "Example company website"),
    )
    return TestClient(create_app(settings, service))


def test_health_and_full_api_flow(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["provider"] == "mock"

    created = client.post(
        "/api/campaigns",
        json={
            "company_url": "https://example.com",
            "goal": "Launch a useful service",
            "audience": "Operations leaders",
            "offer": "Free assessment",
        },
    )
    assert created.status_code == 202
    campaign_id = created.json()["id"]
    campaign = client.get(f"/api/campaigns/{campaign_id}")
    assert campaign.status_code == 200
    assert campaign.json()["status"] == "awaiting_approval"
    assert len(campaign.json()["artifacts"]) == 9

    approved = client.post(f"/api/campaigns/{campaign_id}/approve")
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert client.post(f"/api/campaigns/{campaign_id}/approve").status_code == 409


def test_missing_campaign_is_404(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    assert client.get("/api/campaigns/missing").status_code == 404
    assert client.post("/api/campaigns/missing/approve").status_code == 404


def test_rejects_untrusted_host_and_cross_site_mutation(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    assert client.get("/health", headers={"host": "attacker.example"}).status_code == 400
    blocked = client.post(
        "/api/campaigns/missing/approve",
        headers={"origin": "https://attacker.example", "sec-fetch-site": "cross-site"},
    )
    assert blocked.status_code == 403


def test_security_headers_are_set(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    response = client.get("/")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
