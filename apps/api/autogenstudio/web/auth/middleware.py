import json
import os
import re

from fastapi import Request, Response, WebSocket
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.status import HTTP_401_UNAUTHORIZED
from starlette.types import ASGIApp

from .exceptions import AuthException
from .manager import AuthManager
from .models import User


SERVICE_AUTH_HEADER = "x-autogen-service-key"
SERVICE_USER_HEADER = "x-autogen-service-user"

# Methods the bridge/service-key path is permitted to use.
# DELETE is intentionally excluded: destructive operations must go through the
# AutoGen Studio UI with a real user JWT, never through the service-key bridge.
_SERVICE_KEY_ALLOWED_METHODS = frozenset({"GET", "POST", "PUT", "PATCH", "HEAD", "OPTIONS"})


def get_service_user_from_headers(headers, method: str = "") -> User | None:
    """Authenticate trusted server-to-server requests via shared secret header.

    Returns None (falls through to normal auth) for:
    - missing or wrong service key
    - destructive HTTP methods (DELETE) — those must use real user auth
    """
    configured_key = (os.getenv("AUTOGEN_SERVICE_KEY") or "").strip()
    if not configured_key:
        return None

    provided_key = (headers.get(SERVICE_AUTH_HEADER) or "").strip()
    if provided_key != configured_key:
        return None

    # Never grant service-key bypass for destructive methods.
    if method.upper() not in _SERVICE_KEY_ALLOWED_METHODS:
        return None

    service_user_id = (headers.get(SERVICE_USER_HEADER) or os.getenv("AUTOGEN_SERVICE_USER_ID") or "service").strip()
    return User(
        id=service_user_id,
        name="Promarkia Service",
        email=service_user_id if "@" in service_user_id else None,
        provider="service",
        roles=["user", "service"],
    )


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware for handling authentication for all routes.
    """

    def __init__(self, app: ASGIApp, auth_manager: AuthManager) -> None:
        super().__init__(app)
        self.auth_manager = auth_manager

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Process each request, authenticating as needed."""
        # Skip auth for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path

        service_user = get_service_user_from_headers(request.headers, method=request.method)
        if service_user is not None:
            request.state.user = service_user
            return await call_next(request)

        if (
            path == "/"
            or path == "/login"
            or path == "/login/"
            or path == "/callback"
            or path == "/images"
            or path.startswith("/page-data/")
            or path in self.auth_manager.config.exclude_paths
            or re.match(r"/[^/]+\.(js|css|png|ico|svg|jpg|webmanifest|json)$", path)
            or re.match(r".*\.(js\.map|svg)$", path)
            or re.match(r"/(build|callback|gallery|deploy|labs|lite|settings|mcp|workflow)/?$", path)
        ):
            return await call_next(request)

        # Skip auth if disabled
        if self.auth_manager.config.type == "none":
            request.state.user = await self.auth_manager.authenticate_request(request)
            return await call_next(request)

        # WebSocket handling (special case)
        if request.url.path.startswith("/api/ws") or request.url.path.startswith("/api/maker") or request.url.path.startswith("/api/workflows/workflow/ws"):
            # For WebSockets, we'll add auth in the WebSocket accept handler
            # Just pass through here
            return await call_next(request)

        # Handle authentication for all other requests
        try:
            user = await self.auth_manager.authenticate_request(request)
            # Add user to request state for use in route handlers
            request.state.user = user
            return await call_next(request)

        except AuthException as e:
            # Handle authentication errors
            return Response(
                status_code=HTTP_401_UNAUTHORIZED,
                content=json.dumps({"status": False, "detail": e.detail}),
                media_type="application/json",
                headers=e.headers or {},
            )
        except Exception as e:
            # Log unexpected errors
            logger.error(f"Unexpected error in auth middleware: {str(e)}")
            return Response(
                status_code=HTTP_401_UNAUTHORIZED,
                content=json.dumps({"status": False, "detail": "Authentication failed"}),
                media_type="application/json",
            )


class WebSocketAuthMiddleware:
    """
    Helper for authenticating WebSocket connections.
    Not a middleware in the traditional sense - used in WebSocket endpoint.
    """

    def __init__(self, auth_manager: AuthManager) -> None:
        self.auth_manager = auth_manager

    async def authenticate(self, websocket: WebSocket) -> bool:
        """
        Authenticate a WebSocket connection.
        Returns True if authenticated, False otherwise.
        """
        if self.auth_manager.config.type == "none":
            return True

        service_user = get_service_user_from_headers(websocket.headers, method="GET")
        if service_user is not None:
            websocket.state.user = service_user
            return True

        try:
            # Extract token from query params or cookies
            token = None
            if "token" in websocket.query_params:
                token = websocket.query_params["token"]
            elif "authorization" in websocket.headers:
                auth_header = websocket.headers["authorization"]
                if auth_header.startswith("Bearer "):
                    token = auth_header.replace("Bearer ", "")

            if not token:
                logger.warning("No token found for WebSocket connection")
                return False

            # Validate token
            valid = self.auth_manager.is_valid_token(token)
            if not valid:
                logger.warning("Invalid token for WebSocket connection")
                return False

            return True

        except Exception as e:
            logger.error(f"WebSocket auth error: {str(e)}")
            return False
