from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from .models import ACTIVE_STATUSES, CampaignCreate, CampaignStatus, utc_now


class Database:
    def __init__(self, path: Path):
        self.path = path

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS campaigns (
                    id TEXT PRIMARY KEY,
                    company_url TEXT NOT NULL,
                    goal TEXT NOT NULL,
                    audience TEXT NOT NULL DEFAULT '',
                    offer TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL,
                    current_stage TEXT NOT NULL,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    approved_at TEXT
                );
                CREATE TABLE IF NOT EXISTS stage_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    campaign_id TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
                );
                """
            )

    def create_campaign(self, campaign_id: str, request: CampaignCreate) -> dict[str, Any]:
        now = utc_now()
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO campaigns
                (id, company_url, goal, audience, offer, status, current_stage, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    campaign_id,
                    str(request.company_url),
                    request.goal.strip(),
                    request.audience.strip(),
                    request.offer.strip(),
                    CampaignStatus.QUEUED,
                    CampaignStatus.QUEUED,
                    now,
                    now,
                ),
            )
        return self.get_campaign(campaign_id)

    def get_campaign(self, campaign_id: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            row = connection.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()
        return dict(row) if row else None

    def list_campaigns(self, limit: int = 50) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM campaigns ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(row) for row in rows]

    def transition(
        self,
        campaign_id: str,
        status: CampaignStatus,
        *,
        error: str | None = None,
        approved: bool = False,
    ) -> dict[str, Any]:
        now = utc_now()
        with self.connect() as connection:
            connection.execute(
                """
                UPDATE campaigns
                SET status = ?, current_stage = ?, error = ?, updated_at = ?,
                    approved_at = CASE WHEN ? THEN ? ELSE approved_at END
                WHERE id = ?
                """,
                (status, status, error, now, 1 if approved else 0, now, campaign_id),
            )
            connection.execute(
                "INSERT INTO stage_events (campaign_id, stage, created_at) VALUES (?, ?, ?)",
                (campaign_id, status, now),
            )
        return self.get_campaign(campaign_id)

    def recover_interrupted(self) -> int:
        statuses = tuple(str(status) for status in ACTIVE_STATUSES)
        if len(statuses) != 5:
            raise RuntimeError("Interrupted-campaign recovery status set changed unexpectedly")
        with self.connect() as connection:
            cursor = connection.execute(
                """
                UPDATE campaigns SET status = ?, current_stage = ?,
                    error = ?, updated_at = ? WHERE status IN (?, ?, ?, ?, ?)
                """,
                (
                    CampaignStatus.FAILED,
                    CampaignStatus.FAILED,
                    "The local worker stopped before this campaign completed. Retry it.",
                    utc_now(),
                    *statuses,
                ),
            )
        return cursor.rowcount
