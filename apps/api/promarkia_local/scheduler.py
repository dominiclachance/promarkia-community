import asyncio
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from loguru import logger
from sqlmodel import Session as DBSession, select

from autogenstudio.datamodel import Run, RunStatus, Session as ChatSession, Team
from autogenstudio.web.deps import get_db, get_websocket_manager

from .models import LocalSchedule, LocalScheduleRun


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def next_occurrence(schedule: LocalSchedule, current: datetime) -> Optional[datetime]:
    recurrence = schedule.recurrence or {"type": "once"}
    kind = recurrence.get("type", "once")
    every = max(int(recurrence.get("every") or 1), 1)
    if kind == "once":
        return None
    if kind == "hourly":
        return current + timedelta(hours=every)
    if kind == "daily":
        return current + timedelta(days=every)
    if kind == "weekly":
        return current + timedelta(weeks=every)
    if kind == "random_n_weeks":
        window = recurrence.get("window") or {}
        candidate = current + timedelta(weeks=every)
        candidate = candidate.replace(
            hour=secrets.randbelow(int(window.get("hourEnd", 18)) - int(window.get("hourStart", 8)) + 1)
            + int(window.get("hourStart", 8)),
            minute=secrets.randbelow(60), second=0, microsecond=0,
        )
        return candidate
    if kind == "custom_cron":
        try:
            from croniter import croniter
            return croniter(recurrence["expression"], current).get_next(datetime)
        except Exception as exc:
            raise ValueError(f"Invalid cron recurrence: {exc}") from exc
    raise ValueError(f"Unsupported recurrence: {kind}")


class LocalScheduler:
    def __init__(self, poll_seconds: int = 20):
        self.poll_seconds = poll_seconds
        self._stop = asyncio.Event()
        self._task: Optional[asyncio.Task] = None

    def start(self) -> None:
        if not self._task or self._task.done():
            self._task = asyncio.create_task(self._loop(), name="promarkia-local-scheduler")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            await self._task

    async def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                await self.run_due()
            except Exception as exc:
                logger.exception(f"Local scheduler cycle failed: {exc}")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.poll_seconds)
            except asyncio.TimeoutError:
                pass

    async def run_due(self) -> None:
        db = await get_db()
        now = utcnow()
        with DBSession(db.engine) as session:
            due = session.exec(
                select(LocalSchedule)
                .where(LocalSchedule.status == "active")
                .where(LocalSchedule.next_run_at != None)  # noqa: E711
                .where(LocalSchedule.next_run_at <= now)
                .order_by(LocalSchedule.next_run_at)
                .limit(5)
            ).all()
            due_ids = [row.id for row in due if row.id is not None]
        for schedule_id in due_ids:
            await self._execute(schedule_id)

    async def _execute(self, schedule_id: int) -> None:
        db = await get_db()
        ws_manager = await get_websocket_manager()
        with DBSession(db.engine) as session:
            schedule = session.get(LocalSchedule, schedule_id)
            if not schedule or schedule.status != "active":
                return
            team = session.get(Team, schedule.team_id)
            if not team:
                schedule.last_error = f"Squad {schedule.team_id} is not installed"
                schedule.next_run_at = next_occurrence(schedule, schedule.next_run_at or utcnow())
                session.add(schedule)
                session.commit()
                return
            chat_session = ChatSession(
                team_id=schedule.team_id,
                name=f"Scheduled: {schedule.name}",
                user_id="guestuser@gmail.com",
            )
            session.add(chat_session)
            session.commit()
            session.refresh(chat_session)
            run = Run(
                session_id=chat_session.id,
                status=RunStatus.CREATED,
                user_id="guestuser@gmail.com",
                task={}, team_result={},
            )
            session.add(run)
            session.commit()
            session.refresh(run)
            schedule_run = LocalScheduleRun(
                schedule_id=schedule_id, run_id=run.id, status="active", started_at=utcnow(),
            )
            session.add(schedule_run)
            session.commit()
            session.refresh(schedule_run)
            task_text = schedule.task
            team_config = team.component

        await ws_manager.start_stream(run.id, task_text, team_config, headless=True)

        with DBSession(db.engine) as session:
            schedule = session.get(LocalSchedule, schedule_id)
            run = session.get(Run, run.id)
            schedule_run = session.get(LocalScheduleRun, schedule_run.id)
            finished = utcnow()
            if schedule_run:
                schedule_run.status = run.status.value if run else "error"
                schedule_run.error = run.error_message if run else "Run disappeared"
                schedule_run.finished_at = finished
                session.add(schedule_run)
            if schedule:
                schedule.last_run_at = finished
                schedule.last_error = run.error_message if run and run.status == RunStatus.ERROR else None
                schedule.next_run_at = next_occurrence(schedule, schedule.next_run_at or finished)
                if schedule.next_run_at is None:
                    schedule.status = "complete" if run and run.status == RunStatus.COMPLETE else "error"
                session.add(schedule)
            session.commit()


local_scheduler = LocalScheduler()
