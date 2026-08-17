from __future__ import annotations

from urllib.parse import urlsplit

import httpx


class OllamaProvider:
    name = "ollama"

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        parsed = urlsplit(base_url)
        if parsed.scheme not in {"http", "https"} or parsed.hostname not in {
            "127.0.0.1",
            "::1",
            "localhost",
        }:
            raise ValueError("PROMARKIA_OLLAMA_URL must use a loopback Ollama endpoint")
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.transport = transport

    def generate(self, *, system: str, prompt: str) -> str:
        with httpx.Client(timeout=120, transport=self.transport) as client:
            response = client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "stream": False,
                    "think": False,
                    "options": {"temperature": 0.4},
                },
            )
            response.raise_for_status()
            payload = response.json()
        try:
            content = str(payload["message"]["content"]).strip()
        except (KeyError, TypeError) as error:
            raise RuntimeError("Ollama returned an unsupported response shape") from error
        if not content:
            raise RuntimeError("Ollama returned an empty response")
        return content

