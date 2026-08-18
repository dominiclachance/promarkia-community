from fastapi import HTTPException, Request


def get_authenticated_user_id(request: Request) -> str:
    """Get the authenticated user ID from the JWT-set request state."""
    if not hasattr(request.state, "user"):
        raise HTTPException(status_code=401, detail="Authentication required")
    return request.state.user.id
