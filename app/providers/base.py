from __future__ import annotations

from typing import Protocol


class Provider(Protocol):
    name: str
    model: str

    def generate(self, *, system: str, prompt: str) -> str: ...
