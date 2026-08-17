from __future__ import annotations

import os
import ipaddress
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class Settings:
    data_dir: Path
    provider: str = "mock"
    model: str = "gpt-4.1-mini"
    base_url: str = "https://api.openai.com/v1"
    ollama_url: str = "http://127.0.0.1:11434"
    api_key: str = ""
    host: str = "127.0.0.1"
    port: int = 8788
    fetch_timeout_seconds: float = 10.0
    fetch_max_bytes: int = 1_000_000
    fetch_max_redirects: int = 3
    unsafe_allow_network_bind: bool = False

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            data_dir=Path(os.getenv("PROMARKIA_DATA_DIR", "./data")).resolve(),
            provider=os.getenv("PROMARKIA_PROVIDER", "mock").strip().lower(),
            model=os.getenv("PROMARKIA_MODEL", "gpt-4.1-mini").strip(),
            base_url=os.getenv("PROMARKIA_BASE_URL", "https://api.openai.com/v1").strip(),
            ollama_url=os.getenv("PROMARKIA_OLLAMA_URL", "http://127.0.0.1:11434").strip(),
            api_key=os.getenv("PROMARKIA_API_KEY", "").strip(),
            host=os.getenv("PROMARKIA_HOST", "127.0.0.1").strip(),
            port=int(os.getenv("PROMARKIA_PORT", "8788")),
            unsafe_allow_network_bind=(
                os.getenv("PROMARKIA_UNSAFE_ALLOW_NETWORK_BIND", "").strip() == "1"
            ),
        )

    @property
    def binds_loopback_only(self) -> bool:
        host = self.host.rstrip(".").lower()
        if host == "localhost":
            return True
        try:
            return ipaddress.ip_address(host).is_loopback
        except ValueError:
            return False

    @property
    def database_path(self) -> Path:
        return self.data_dir / "promarkia.db"

    @property
    def campaigns_dir(self) -> Path:
        return self.data_dir / "campaigns"

    def ensure_directories(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.campaigns_dir.mkdir(parents=True, exist_ok=True)
