"""Local-only token/cost ledger and optional safety cap."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, func, select

from .models import LocalProfile, LocalUsageBudget, LocalUsageEvent


def _month_start() -> datetime:
    current = datetime.now(timezone.utc)
    return current.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def assert_budget(db_manager) -> None:
    with Session(db_manager.engine) as session:
        budget = session.get(LocalUsageBudget, "default") or LocalUsageBudget()
        if not budget.hard_cap_enabled or budget.monthly_limit_usd <= 0:
            return
        total = session.exec(
            select(func.coalesce(func.sum(LocalUsageEvent.estimated_cost_usd), 0.0))
            .where(LocalUsageEvent.created_at >= _month_start())
        ).one()
        if float(total) >= budget.monthly_limit_usd:
            raise RuntimeError(
                f"Local monthly safety cap reached (${float(total):.2f} / ${budget.monthly_limit_usd:.2f})"
            )


def record_team_usage(db_manager, team_result: dict[str, Any], run_id: int) -> None:
    task_result = team_result.get("task_result") if isinstance(team_result, dict) else None
    messages = (task_result or {}).get("messages") if isinstance(task_result, dict) else []
    input_tokens = 0.0
    output_tokens = 0.0
    for message in messages or []:
        if not isinstance(message, dict):
            continue
        usage = message.get("models_usage") or message.get("model_usage") or {}
        if not isinstance(usage, dict):
            continue
        input_tokens += float(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
        output_tokens += float(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
    if input_tokens == 0 and output_tokens == 0:
        return
    with Session(db_manager.engine) as session:
        profile = session.get(LocalProfile, "local") or LocalProfile()
        prefs = profile.preferences or {}
        provider = str(prefs.get("model_provider") or "openai")
        model = str(prefs.get("model") or "default")
        input_rate = float(prefs.get("input_cost_per_million") or 0)
        output_rate = float(prefs.get("output_cost_per_million") or 0)
        estimate = (input_tokens * input_rate + output_tokens * output_rate) / 1_000_000
        session.add(LocalUsageEvent(
            category="model",
            provider=provider,
            model=model,
            input_units=input_tokens,
            output_units=output_tokens,
            estimated_cost_usd=estimate,
            run_id=run_id,
        ))
        session.commit()
