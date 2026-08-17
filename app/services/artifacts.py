from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


ARTIFACT_NAMES = (
    "research.md",
    "positioning.md",
    "landing-page.md",
    "email-sequence.md",
    "social-posts.md",
    "ad-concepts.md",
    "content-calendar.csv",
    "qa-report.md",
    "receipt.json",
)


class ArtifactStore:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def campaign_dir(self, campaign_id: str) -> Path:
        if not campaign_id or any(character not in "0123456789abcdef-" for character in campaign_id.lower()):
            raise ValueError("Invalid campaign ID")
        path = (self.root / campaign_id).resolve()
        if path.parent != self.root.resolve():
            raise ValueError("Invalid campaign path")
        path.mkdir(parents=True, exist_ok=True)
        return path

    def write_text(self, campaign_id: str, name: str, content: str) -> Path:
        if name not in ARTIFACT_NAMES:
            raise ValueError("Unsupported artifact")
        target = self.campaign_dir(campaign_id) / name
        with target.open("w", encoding="utf-8", newline="\n") as output:
            output.write(content.strip() + "\n")
        return target

    def write_json(self, campaign_id: str, name: str, payload: dict[str, Any]) -> Path:
        return self.write_text(campaign_id, name, json.dumps(payload, indent=2, ensure_ascii=False))

    def read_path(self, campaign_id: str, name: str) -> Path:
        if name not in ARTIFACT_NAMES:
            raise ValueError("Unsupported artifact")
        target = self.campaign_dir(campaign_id) / name
        if not target.is_file():
            raise FileNotFoundError(name)
        return target

    def list(self, campaign_id: str) -> list[dict[str, Any]]:
        directory = self.campaign_dir(campaign_id)
        artifacts = []
        for name in ARTIFACT_NAMES:
            path = directory / name
            if not path.is_file():
                continue
            content = path.read_bytes()
            artifacts.append(
                {
                    "name": name,
                    "bytes": len(content),
                    "sha256": hashlib.sha256(content).hexdigest(),
                }
            )
        return artifacts
