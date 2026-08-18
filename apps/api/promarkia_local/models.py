from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import Column, JSON, Text, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LocalProfile(SQLModel, table=True):
    id: str = Field(default="local", primary_key=True)
    display_name: str = "Local Owner"
    email: str = "local@promarkia.local"
    workspace_name: str = "My Workspace"
    preferences: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class LocalSecret(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    encrypted_value: str = Field(sa_column=Column(Text, nullable=False))
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class LocalIntegration(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("provider", "account_label"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    provider: str = Field(index=True)
    account_label: str = "default"
    kind: str = "api"
    enabled: bool = True
    settings: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    secret_names: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class LocalMcpServer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    transport: str = "stdio"
    command: Optional[str] = None
    args: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    url: Optional[str] = None
    env_secret_names: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    enabled: bool = True
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class LocalArtifact(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: Optional[int] = Field(default=None, index=True)
    run_id: Optional[int] = Field(default=None, index=True)
    name: str
    media_type: str = "text/plain"
    relative_path: str
    size_bytes: int = 0
    sha256: str = ""
    metadata_json: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    approved: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class LocalApproval(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    action: str = Field(index=True)
    provider: str = Field(index=True)
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    preview: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    status: str = Field(default="pending", index=True)
    requested_at: datetime = Field(default_factory=utcnow)
    decided_at: Optional[datetime] = None
    decision_note: Optional[str] = None


class LocalSchedule(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    team_id: int = Field(index=True)
    task: str = Field(sa_column=Column(Text, nullable=False))
    recurrence: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    timezone: str = "America/New_York"
    next_run_at: Optional[datetime] = Field(default=None, index=True)
    status: str = Field(default="active", index=True)
    require_approval: bool = True
    last_run_at: Optional[datetime] = None
    last_error: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class LocalScheduleRun(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    schedule_id: int = Field(index=True)
    run_id: Optional[int] = Field(default=None, index=True)
    status: str = Field(default="queued", index=True)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error: Optional[str] = Field(default=None, sa_column=Column(Text))


class LocalUsageEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category: str = Field(index=True)
    provider: str = Field(index=True)
    model: Optional[str] = None
    input_units: float = 0
    output_units: float = 0
    estimated_cost_usd: float = 0
    session_id: Optional[int] = Field(default=None, index=True)
    run_id: Optional[int] = Field(default=None, index=True)
    metadata_json: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow, index=True)


class LocalUsageBudget(SQLModel, table=True):
    id: str = Field(default="default", primary_key=True)
    monthly_limit_usd: float = 25
    warning_percent: int = 80
    hard_cap_enabled: bool = False
    updated_at: datetime = Field(default_factory=utcnow)


class LocalLaunchpadWorkflow(SQLModel, table=True):
    id: str = Field(primary_key=True)
    title: str
    description: str = ""
    team_id: int
    category: str = "marketing"
    form_schema: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    prompt_template: str = Field(sa_column=Column(Text, nullable=False))
    enabled: bool = True
