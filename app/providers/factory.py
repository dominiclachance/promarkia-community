from __future__ import annotations

from ..config import Settings
from .mock import MockProvider
from .ollama import OllamaProvider
from .openai_compatible import OpenAICompatibleProvider


def create_provider(settings: Settings):
    if settings.provider == "mock":
        return MockProvider()
    if settings.provider in {"openai", "openai-compatible"}:
        return OpenAICompatibleProvider(
            api_key=settings.api_key,
            base_url=settings.base_url,
            model=settings.model,
        )
    if settings.provider == "ollama":
        return OllamaProvider(base_url=settings.ollama_url, model=settings.model)
    raise ValueError(f"Unsupported provider: {settings.provider}")
