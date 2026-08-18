import os
import re
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from sqlmodel import Session, select

from autogenstudio.datamodel.types import EnvironmentVariable
from .models import LocalSecret


class LocalVault:
    """Encrypt local secrets at rest with an installation-specific key."""

    def __init__(self, app_root: Path):
        self.key_path = app_root / "vault.key"
        self.key_path.parent.mkdir(parents=True, exist_ok=True)
        if self.key_path.exists():
            key = self.key_path.read_bytes().strip()
        else:
            key = Fernet.generate_key()
            fd = os.open(self.key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as handle:
                handle.write(key)
        self._fernet = Fernet(key)

    def encrypt(self, value: str) -> str:
        return self._fernet.encrypt(value.encode("utf-8")).decode("ascii")

    def decrypt(self, value: str) -> str:
        try:
            return self._fernet.decrypt(value.encode("ascii")).decode("utf-8")
        except (InvalidToken, ValueError) as exc:
            raise ValueError("Stored credential could not be decrypted") from exc

    @staticmethod
    def masked(value: str) -> str:
        if not value:
            return ""
        if len(value) <= 8:
            return "••••••••"
        return f"{value[:3]}••••{value[-3:]}"


def runtime_environment(db_manager, app_root: Path, existing=None):
    """Merge encrypted provider keys into the per-run environment list."""
    merged = {item.name: item for item in (existing or [])}
    vault = LocalVault(app_root)
    with Session(db_manager.engine) as session:
        rows = session.exec(select(LocalSecret)).all()
        for row in rows:
            if not re.fullmatch(r"[A-Z][A-Z0-9_]{2,127}", row.name):
                continue
            merged[row.name] = EnvironmentVariable(
                name=row.name,
                value=vault.decrypt(row.encrypted_value),
                type="secret",
            )
    aliases = {
        "GEMINI_API_KEY": "GOOGLE_API_KEY",
        "FAL_KEY": "FAL_API_KEY",
    }
    for source, target in aliases.items():
        if source in merged and target not in merged:
            merged[target] = EnvironmentVariable(
                name=target, value=merged[source].value, type="secret"
            )
    return list(merged.values())
