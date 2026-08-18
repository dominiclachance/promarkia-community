"""Desktop/CLI launcher for the complete local Promarkia workspace."""

from __future__ import annotations

import argparse
import os
import platform
import threading
import time
import webbrowser
from http.client import HTTPConnection
from pathlib import Path


def default_data_dir() -> Path:
    system = platform.system()
    if system == "Windows":
        root = Path(os.getenv("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    elif system == "Darwin":
        root = Path.home() / "Library" / "Application Support"
    else:
        root = Path(os.getenv("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return root / "PromarkiaCommunity"


def _open_when_ready(url: str, port: int) -> None:
    for _ in range(120):
        try:
            connection = HTTPConnection("127.0.0.1", port, timeout=0.5)
            connection.request("GET", "/api/health")
            if connection.getresponse().status == 200:
                if os.getenv("PROMARKIA_NO_BROWSER") != "1":
                    webbrowser.open(url)
                return
        except OSError:
            time.sleep(0.25)
        finally:
            if "connection" in locals():
                connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(prog="promarkia", description="Promarkia Community local workspace")
    parser.add_argument("command", nargs="?", default="serve", choices=["serve", "doctor"])
    parser.add_argument("--port", type=int, default=int(os.getenv("PROMARKIA_PORT", "8788")))
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    data_dir = Path(os.getenv("PROMARKIA_DATA_DIR", default_data_dir()))
    data_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("AUTOGENSTUDIO_APPDIR", str(data_dir))
    os.environ.setdefault("AUTOGENSTUDIO_AUTH_DISABLED", "true")
    os.environ.setdefault("AUTOGENSTUDIO_HOST", "127.0.0.1")
    os.environ.setdefault("AUTOGENSTUDIO_PORT", str(args.port))
    os.environ.setdefault(
        "PROMARKIA_PUBLIC_ASSET_BASE_URL",
        f"http://127.0.0.1:{args.port}/files/user",
    )
    if args.no_browser:
        os.environ["PROMARKIA_NO_BROWSER"] = "1"

    if args.command == "doctor":
        from .catalog import SQUADS
        print(f"Promarkia Community: local data={data_dir}; squads={len(SQUADS)}; billing=disabled; firestore=disabled")
        return

    from autogenstudio.web.app import app
    import uvicorn

    host = os.getenv("PROMARKIA_HOST", "127.0.0.1")
    if host not in {"127.0.0.1", "localhost", "::1"} and os.getenv("PROMARKIA_UNSAFE_ALLOW_NETWORK_BIND") != "1":
        raise SystemExit("Refusing non-loopback bind without PROMARKIA_UNSAFE_ALLOW_NETWORK_BIND=1")
    url = f"http://127.0.0.1:{args.port}"
    threading.Thread(target=_open_when_ready, args=(url, args.port), daemon=True).start()
    # Windowless PyInstaller executables may expose stdout/stderr as None.
    # Uvicorn's default colour formatter calls ``isatty`` during startup and
    # crashes before serving in that environment, so the desktop launcher
    # deliberately skips terminal-dependent logging configuration.
    uvicorn.run(
        app,
        host=host,
        port=args.port,
        log_level="info",
        log_config=None,
        access_log=False,
    )


if __name__ == "__main__":
    main()
