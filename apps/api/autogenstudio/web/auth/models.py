from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel


class AuthConfig(BaseModel):
    """Authentication configuration model for the application."""

    type: Literal["none"] = "none"
    jwt_secret: Optional[str] = None
    token_expiry_minutes: int = 60
    exclude_paths: List[str] = [
        "/",  # root for serving frontend
        "/api/health",
        "/api/version",
        "/api/auth/login-url",
        "/api/auth/callback-handler",
        "/api/auth/callback",
        "/api/auth/type",
    ]

class User(BaseModel):
    """User model for authenticated users."""

    id: str
    name: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    provider: Optional[str] = None
    roles: List[str] = ["user"]
    metadata: Optional[Dict[str, Any]] = None
