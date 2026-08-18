# api/routes/teams.py
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request

from ...datamodel import Team
from ...gallery.builder import create_default_gallery
from ..deps import get_db
from .auth_utils import get_authenticated_user_id

router = APIRouter()


@router.get("/")
async def list_teams(request: Request, db=Depends(get_db)) -> Dict:
    """List all teams for the authenticated user"""
    user_id = get_authenticated_user_id(request)
    response = db.get(Team, filters={"user_id": user_id})

    if not response.data or len(response.data) == 0:
        default_gallery = create_default_gallery()
        default_team = Team(user_id=user_id, component=default_gallery.components.teams[0].model_dump())
        db.upsert(default_team)
        response = db.get(Team, filters={"user_id": user_id})

    return {"status": True, "data": response.data}


@router.get("/{team_id}")
async def get_team(request: Request, team_id: int, db=Depends(get_db)) -> Dict:
    """Get a specific team"""
    user_id = get_authenticated_user_id(request)
    response = db.get(Team, filters={"id": team_id, "user_id": user_id})
    if not response.status or not response.data:
        raise HTTPException(status_code=404, detail="Team not found")
    return {"status": True, "data": response.data[0]}


@router.post("/")
async def create_team(request: Request, team: Team, db=Depends(get_db)) -> Dict:
    """Create a new team for the authenticated user"""
    user_id = get_authenticated_user_id(request)
    team.user_id = user_id  # Always use the authenticated user, ignore any provided value
    response = db.upsert(team)
    if not response.status:
        raise HTTPException(status_code=400, detail=response.message)
    return {"status": True, "data": response.data}


@router.delete("/{team_id}")
async def delete_team(request: Request, team_id: int, db=Depends(get_db)) -> Dict:
    """Delete a team"""
    user_id = get_authenticated_user_id(request)
    db.delete(filters={"id": team_id, "user_id": user_id}, model_class=Team)
    return {"status": True, "message": "Team deleted successfully"}
