"""Convert a local database export into secret-free bundled squad configs."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ALLOWED_IDS = {1, 9, 10, 11, 12, 16, 17, 18, 19, 20, 21, 33, 36, 37, 38, 39, 40, 41}
SECRET_KEY = re.compile(r"(?:api[_-]?key|secret|password|credential|access[_-]?token|refresh[_-]?token|private[_-]?key)", re.I)
SECRET_VALUE = re.compile(r"(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|AIza[A-Za-z0-9_-]{20,})")
SOURCE_SECRET_ASSIGNMENT = re.compile(
    r"(?im)\b([A-Za-z][A-Za-z0-9_]*(?:API_KEY|WEB_KEY|ACCESS_TOKEN|REFRESH_TOKEN|SECRET|PASSWORD))"
    r"\s*=\s*(['\"])[^'\"\r\n]+\2"
)
SOURCE_SERPER_HEADER = re.compile(
    r"(?i)(['\"]X-API-KEY['\"]\s*:\s*)(['\"])[^'\"\r\n]+\2"
)

CLOUD_REPLACEMENTS = {
    "https://apis.promarkia.com/api/files/user": "PROMARKIA_LOCAL_ASSET_BASE",
    "https://apis.promarkia.com/api/": "PROMARKIA_LOCAL_ASSET_BASE/",
    "/home/ubuntu/.autogenstudio/files/user": "/PROMARKIA_LOCAL_DATA/files/user",
    "/home/ubuntu/.autogenstudio": "/PROMARKIA_LOCAL_DATA",
    "/home/ubuntu/promarkia_apis/files/user": "/PROMARKIA_LOCAL_DATA/files/user",
    "/home/ubuntu/promarkia_apis": "/PROMARKIA_LOCAL_DATA",
    "/home/ubuntu": "/PROMARKIA_LOCAL_DATA/legacy-home",
}


def sanitize(value, path="root"):
    if isinstance(value, dict):
        cleaned = {}
        for key, child in value.items():
            if SECRET_KEY.search(str(key)):
                continue
            cleaned[key] = sanitize(child, f"{path}.{key}")
        return cleaned
    if isinstance(value, list):
        return [sanitize(child, f"{path}[]") for child in value]
    if isinstance(value, str):
        value = SECRET_VALUE.sub("PROMARKIA_LOCAL_SECRET", value)
        value = SOURCE_SECRET_ASSIGNMENT.sub(
            lambda match: (
                f'{match.group(1)} = __import__("os").environ.get('
                f'"{match.group(1).upper()}", "")'
            ),
            value,
        )
        value = SOURCE_SERPER_HEADER.sub(
            r'\1__import__("os").environ.get("SERPER_API_KEY", "")',
            value,
        )
        value = value.replace("dlachance@agentixlabs.com", "local@promarkia.local")
        value = value.replace("guestuser@gmail.com", "local@promarkia.local")
        value = re.sub(
            r"os\.environ\[['\"]GOOGLE_APPLICATION_CREDENTIALS['\"]\]\s*=\s*['\"][^'\"]+['\"]",
            "if not os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'):\n        raise RuntimeError('Set GOOGLE_APPLICATION_CREDENTIALS for the local Google Analytics integration')",
            value,
        )
        for old, new in CLOUD_REPLACEMENTS.items():
            value = value.replace(old, new)
        value = value.replace("wisdomprompt-70290", "promarkia-local")
    return value


def main(source: Path, target: Path) -> None:
    rows = json.loads(source.read_text(encoding="utf-8-sig"))
    output = []
    for row in rows:
        team_id = int(row["id"])
        if team_id not in ALLOWED_IDS:
            continue
        component = sanitize(row["component"], f"team[{team_id}]")
        output.append({"id": team_id, "component": component})
    ids = {row["id"] for row in output}
    if ids != ALLOWED_IDS:
        raise ValueError(f"Squad export is incomplete; missing={sorted(ALLOWED_IDS - ids)}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
