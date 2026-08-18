from abc import ABC, abstractmethod

from .models import User


class AuthProvider(ABC):
    """Authentication provider interface retained for UI compatibility."""

    @abstractmethod
    async def get_login_url(self) -> str:
        raise NotImplementedError

    @abstractmethod
    async def process_callback(self, code: str | None = None, state: str | None = None) -> User:
        raise NotImplementedError

    @abstractmethod
    async def validate_token(self, token: str) -> bool:
        raise NotImplementedError


class NoAuthProvider(AuthProvider):
    """Single-user local identity used by Promarkia Community."""

    def __init__(self):
        self.default_user = User(
            id="local@promarkia.community",
            name="Local Owner",
            email="local@promarkia.community",
            provider="none",
        )

    async def get_login_url(self) -> str:
        return "/api/auth/callback?automatic=true"

    async def process_callback(self, code: str | None = None, state: str | None = None) -> User:
        return self.default_user

    async def validate_token(self, token: str) -> bool:
        return True
