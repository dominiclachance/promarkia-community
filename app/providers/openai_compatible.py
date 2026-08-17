from __future__ import annotations

import httpx


class OpenAICompatibleProvider:
    name = "openai-compatible"

    def __init__(self, *, api_key: str, base_url: str, model: str):
        if not api_key:
            raise ValueError("PROMARKIA_API_KEY is required for the openai-compatible provider")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    def generate(self, *, system: str, prompt: str) -> str:
        with httpx.Client(timeout=60) as client:
            response = client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.4,
                },
            )
            response.raise_for_status()
            payload = response.json()
        try:
            return str(payload["choices"][0]["message"]["content"]).strip()
        except (KeyError, IndexError, TypeError) as error:
            raise RuntimeError("Provider returned an unsupported response shape") from error
