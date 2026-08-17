import json

import pytest

from app.config import Settings
from app.db import Database
from app.models import CampaignCreate, CampaignStatus
from app.providers.mock import MockProvider
from app.services.artifacts import ArtifactStore
from app.services.campaigns import CampaignService


def make_service(tmp_path, provider=None, **settings_overrides):
    settings = Settings(data_dir=tmp_path, **settings_overrides)
    settings.ensure_directories()
    database = Database(settings.database_path)
    database.initialize()
    return CampaignService(
        settings=settings,
        database=database,
        artifacts=ArtifactStore(settings.campaigns_dir),
        provider=provider or MockProvider(),
        fetcher=lambda *args, **kwargs: ("https://example.com/", "Example company makes useful tools."),
    )


def request():
    return CampaignCreate(
        company_url="https://example.com",
        goal="Launch a useful service",
        audience="Operations leaders",
        offer="Free assessment",
    )


def test_complete_campaign_and_approve(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.campaigns.validate_public_url", lambda value: value)
    service = make_service(tmp_path)
    campaign = service.create(request())
    service.run(campaign["id"])
    completed = service.database.get_campaign(campaign["id"])
    assert completed["status"] == CampaignStatus.AWAITING_APPROVAL
    artifacts = service.artifacts.list(campaign["id"])
    assert len(artifacts) == 9
    receipt = json.loads(service.artifacts.read_path(campaign["id"], "receipt.json").read_text())
    assert receipt["published"] is False
    assert "api_key" not in json.dumps(receipt).lower()
    approved = service.approve(campaign["id"])
    assert approved["status"] == CampaignStatus.APPROVED


def test_invalid_state_transitions_are_rejected(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.campaigns.validate_public_url", lambda value: value)
    service = make_service(tmp_path)
    campaign = service.create(request())
    with pytest.raises(ValueError):
        service.approve(campaign["id"])
    with pytest.raises(ValueError):
        service.retry(campaign["id"])


def test_provider_failure_is_safe_and_retryable(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.campaigns.validate_public_url", lambda value: value)

    class FailingProvider:
        name = "failing"
        model = "test"

        def generate(self, **kwargs):
            raise RuntimeError("provider unavailable")

    service = make_service(tmp_path, FailingProvider())
    campaign = service.create(request())
    service.run(campaign["id"])
    failed = service.database.get_campaign(campaign["id"])
    assert failed["status"] == CampaignStatus.FAILED
    assert "provider unavailable" in failed["error"]
    retried = service.retry(campaign["id"])
    assert retried["status"] == CampaignStatus.QUEUED


def test_provider_failure_redacts_api_key(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.campaigns.validate_public_url", lambda value: value)
    secret = "sk-test-do-not-persist"

    class LeakyProvider:
        name = "failing"
        model = "test"

        def generate(self, **kwargs):
            raise RuntimeError(f"request rejected for {secret}")

    service = make_service(tmp_path, LeakyProvider(), api_key=secret)
    campaign = service.create(request())
    service.run(campaign["id"])
    failed = service.database.get_campaign(campaign["id"])
    receipt = service.artifacts.read_path(campaign["id"], "receipt.json").read_text()
    assert secret not in failed["error"]
    assert secret not in receipt
    assert "[redacted]" in failed["error"]
