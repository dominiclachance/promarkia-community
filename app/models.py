from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class CampaignStatus(StrEnum):
    QUEUED = "queued"
    RESEARCHING = "researching"
    STRATEGIZING = "strategizing"
    GENERATING = "generating"
    QA = "qa"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    FAILED = "failed"


ACTIVE_STATUSES = {
    CampaignStatus.QUEUED,
    CampaignStatus.RESEARCHING,
    CampaignStatus.STRATEGIZING,
    CampaignStatus.GENERATING,
    CampaignStatus.QA,
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class CampaignCreate(BaseModel):
    company_url: HttpUrl
    goal: str = Field(min_length=5, max_length=500)
    audience: str = Field(default="", max_length=300)
    offer: str = Field(default="", max_length=300)


class CampaignAccepted(BaseModel):
    id: str
    status: CampaignStatus


class CampaignRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    company_url: str
    goal: str
    audience: str
    offer: str
    status: CampaignStatus
    current_stage: str
    error: str | None = None
    created_at: str
    updated_at: str
    approved_at: str | None = None
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
