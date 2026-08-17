import json

import httpx
import pytest

from app.config import Settings
from app.providers.factory import create_provider
from app.providers.ollama import OllamaProvider


def test_ollama_provider_uses_native_non_streaming_chat_api():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["payload"] = json.loads(request.content)
        return httpx.Response(200, json={"message": {"role": "assistant", "content": "Draft"}})

    provider = OllamaProvider(
        base_url="http://127.0.0.1:11434",
        model="llama3.1:8b",
        transport=httpx.MockTransport(handler),
    )
    assert provider.generate(system="System", prompt="Prompt") == "Draft"
    assert captured["url"] == "http://127.0.0.1:11434/api/chat"
    assert captured["payload"]["stream"] is False
    assert captured["payload"]["think"] is False
    assert captured["payload"]["messages"][0]["role"] == "system"


def test_ollama_provider_rejects_non_loopback_endpoint():
    with pytest.raises(ValueError, match="loopback"):
        OllamaProvider(base_url="https://ollama.example", model="model")


def test_factory_selects_ollama_without_api_key(tmp_path):
    provider = create_provider(
        Settings(data_dir=tmp_path, provider="ollama", model="gemma3:12b")
    )
    assert provider.name == "ollama"
    assert provider.model == "gemma3:12b"
