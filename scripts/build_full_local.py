"""Build the cloud-parity React UI into the local Python server package."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
TARGET = ROOT / "apps" / "api" / "autogenstudio" / "web" / "ui"


def main() -> None:
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm:
        raise SystemExit("npm is required to build the local UI")
    subprocess.run([npm, "ci", "--legacy-peer-deps"], cwd=WEB, check=True)
    subprocess.run([npm, "run", "build"], cwd=WEB, check=True)
    source = WEB / "dist"
    if not (source / "index.html").exists():
        raise SystemExit("Frontend build did not produce index.html")
    TARGET.mkdir(parents=True, exist_ok=True)
    # Generated UI content is reproducible; replace stale framework assets.
    for child in TARGET.iterdir():
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()
    shutil.copytree(source, TARGET, dirs_exist_ok=True)
    print(f"Built full local UI into {TARGET}")


if __name__ == "__main__":
    main()
