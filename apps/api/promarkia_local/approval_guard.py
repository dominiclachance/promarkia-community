"""Fail-closed approval boundary for local tools that mutate external systems."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from .models import LocalApproval


class ApprovalRequired(RuntimeError):
    pass


_SENSITIVE = ("secret", "token", "password", "api_key", "apikey", "authorization", "cookie")


def _safe(value: Any, key: str = "", depth: int = 0) -> Any:
    if any(marker in key.lower() for marker in _SENSITIVE):
        return "[redacted]"
    if depth > 5:
        return "[truncated]"
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return value[:4000]
    if isinstance(value, dict):
        return {str(k)[:120]: _safe(v, str(k), depth + 1) for k, v in list(value.items())[:100]}
    if isinstance(value, (list, tuple, set)):
        return [_safe(v, key, depth + 1) for v in list(value)[:100]]
    return repr(value)[:1000]


def _fingerprint(action: str, provider: str, payload: dict[str, Any]) -> str:
    encoded = json.dumps(
        {"action": action, "provider": provider, "payload": payload},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def require_approval(action: str, provider: str, arguments: dict[str, Any]) -> None:
    """Consume a matching approval or queue a review request and stop the tool.

    The user approves the preview in the local UI, then retries the action. The
    next identical invocation consumes that one-time approval and may execute.
    """
    from autogenstudio.web import deps

    db = deps._db_manager
    if db is None:
        raise ApprovalRequired("Local approval service is unavailable; external action blocked")

    payload = _safe({k: v for k, v in arguments.items() if k != "self"})
    fingerprint = _fingerprint(action, provider, payload)
    with Session(db.engine) as session:
        rows = session.exec(
            select(LocalApproval)
            .where(LocalApproval.action == action)
            .order_by(LocalApproval.requested_at.desc())
        ).all()
        matching = next(
            (row for row in rows if (row.preview or {}).get("fingerprint") == fingerprint),
            None,
        )
        if matching and matching.status == "approved":
            matching.status = "executed"
            matching.decided_at = datetime.now(timezone.utc)
            session.add(matching)
            session.commit()
            return
        if matching and matching.status == "rejected":
            raise ApprovalRequired(f"External action '{action}' was rejected (approval #{matching.id})")
        if matching and matching.status == "pending":
            raise ApprovalRequired(f"External action '{action}' awaits approval #{matching.id}")

        row = LocalApproval(
            action=action,
            provider=provider,
            payload=payload,
            preview={
                "fingerprint": fingerprint,
                "summary": f"Allow {action} through {provider}",
                "arguments": payload,
                "instructions": "Review, approve, then retry the same action.",
            },
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        raise ApprovalRequired(f"External action '{action}' blocked pending approval #{row.id}")
