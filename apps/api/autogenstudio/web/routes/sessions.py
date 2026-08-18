# api/routes/sessions.py
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger

from ...datamodel import Message, Response as DResponse, Run, Session
from ..deps import get_db
from .auth_utils import get_authenticated_user_id

router = APIRouter()


@router.get("/")
async def list_sessions(request: Request, db=Depends(get_db)) -> Dict:
    """List all sessions for the authenticated user"""
    user_id = get_authenticated_user_id(request)
    response = db.get(Session, filters={"user_id": user_id})
    return {"status": True, "data": response.data}


@router.get("/{session_id}")
async def get_session(request: Request, session_id: int, db=Depends(get_db)) -> Dict:
    """Get a specific session"""
    user_id = get_authenticated_user_id(request)
    response = db.get(Session, filters={"id": session_id, "user_id": user_id})
    if not response.status or not response.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": True, "data": response.data[0]}


@router.post("/")
async def create_session(request: Request, session: Session, db=Depends(get_db)) -> DResponse:
    """Create a new session for the authenticated user"""
    try:
        session.user_id = get_authenticated_user_id(request)
        response = db.upsert(session)
        if not response.status:
            return DResponse(status=False, message=f"Failed to create session: {response.message}")
        return DResponse(status=True, data=response.data, message="Session created successfully")
    except Exception as e:
        logger.error(f"Error creating session: {str(e)}")
        return DResponse(status=False, message=f"Failed to create session: {str(e)}")


@router.put("/{session_id}")
async def update_session(request: Request, session_id: int, session: Session, db=Depends(get_db)) -> Dict:
    """Update an existing session"""
    user_id = get_authenticated_user_id(request)
    # First verify the session belongs to user
    existing = db.get(Session, filters={"id": session_id, "user_id": user_id})
    if not existing.status or not existing.data:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update the session
    session.user_id = user_id
    response = db.upsert(session)
    if not response.status:
        raise HTTPException(status_code=400, detail=response.message)

    return {"status": True, "data": response.data, "message": "Session updated successfully"}


@router.delete("/{session_id}")
async def delete_session(request: Request, session_id: int, db=Depends(get_db)) -> Dict:
    """Delete a session"""
    user_id = get_authenticated_user_id(request)
    db.delete(filters={"id": session_id, "user_id": user_id}, model_class=Session)
    return {"status": True, "message": "Session deleted successfully"}


@router.get("/{session_id}/runs")
async def list_session_runs(request: Request, session_id: int, db=Depends(get_db)) -> Dict:
    """Get complete session history organized by runs"""
    user_id = get_authenticated_user_id(request)

    try:
        # 1. Verify session exists and belongs to user
        session = db.get(Session, filters={"id": session_id, "user_id": user_id}, return_json=False)
        if not session.status:
            raise HTTPException(status_code=500, detail="Database error while fetching session")
        if not session.data:
            raise HTTPException(status_code=404, detail="Session not found or access denied")

        # 2. Get ordered runs for session
        runs = db.get(Run, filters={"session_id": session_id}, order="asc", return_json=False)
        if not runs.status:
            raise HTTPException(status_code=500, detail="Database error while fetching runs")

        # 3. Build response with messages per run
        run_data = []
        if runs.data:
            for run in runs.data:
                try:
                    messages = db.get(Message, filters={"run_id": run.id}, order="asc", return_json=False)
                    if not messages.status:
                        logger.error(f"Failed to fetch messages for run {run.id}")
                        messages.data = []

                    run_data.append(
                        {
                            "id": str(run.id),
                            "created_at": run.created_at,
                            "status": run.status,
                            "task": run.task,
                            "team_result": run.team_result,
                            "messages": messages.data or [],
                        }
                    )
                except Exception as e:
                    logger.error(f"Error processing run {run.id}: {str(e)}")
                    run_data.append(
                        {
                            "id": str(run.id),
                            "created_at": run.created_at,
                            "status": "ERROR",
                            "task": run.task,
                            "team_result": None,
                            "messages": [],
                            "error": f"Failed to process run: {str(e)}",
                        }
                    )

        return {"status": True, "data": {"runs": run_data}}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in list_messages: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while fetching session data") from e
