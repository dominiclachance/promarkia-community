# /api/runs routes
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ...datamodel import Message, Run, RunStatus, Session
from ..deps import get_db
from .auth_utils import get_authenticated_user_id

router = APIRouter()


class CreateRunRequest(BaseModel):
    session_id: int
@router.post("/")
async def create_run(
    request: Request,
    create_request: CreateRunRequest,
    db=Depends(get_db),
) -> Dict:
    """Create a new run with initial state"""
    user_id = get_authenticated_user_id(request)

    session_response = db.get(
        Session, filters={"id": create_request.session_id, "user_id": user_id}, return_json=False
    )
    if not session_response.status or not session_response.data:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        # Create run with default state
        run = db.upsert(
            Run(
                session_id=create_request.session_id,
                status=RunStatus.CREATED,
                user_id=user_id,
                task={},
                team_result={},
            ),
            return_json=False,
        )
        return {"status": run.status, "data": {"run_id": run.data.id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/{run_id}")
async def get_run(request: Request, run_id: int, db=Depends(get_db)) -> Dict:
    """Get run details including task and result"""
    user_id = get_authenticated_user_id(request)

    run = db.get(Run, filters={"id": run_id, "user_id": user_id}, return_json=False)
    if not run.status or not run.data:
        raise HTTPException(status_code=404, detail="Run not found")

    return {"status": True, "data": run.data[0]}


@router.get("/{run_id}/messages")
async def get_run_messages(request: Request, run_id: int, db=Depends(get_db)) -> Dict:
    """Get all messages for a run"""
    user_id = get_authenticated_user_id(request)

    # First verify the run belongs to the authenticated user
    run = db.get(Run, filters={"id": run_id, "user_id": user_id}, return_json=False)
    if not run.status or not run.data:
        raise HTTPException(status_code=404, detail="Run not found")

    messages = db.get(Message, filters={"run_id": run_id}, order="asc", return_json=False)
    return {"status": True, "data": messages.data}
