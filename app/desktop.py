from __future__ import annotations

import os
import platform
import threading
import time
from http.client import HTTPConnection
import webbrowser
from pathlib import Path


def _default_data_dir() -> Path:
    system = platform.system()
    if system == "Windows":
        root = Path(os.getenv("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    elif system == "Darwin":
        root = Path.home() / "Library" / "Application Support"
    else:
        root = Path(os.getenv("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return root / "PromarkiaCommunity" / "data"


def _open_when_ready(url: str, port: int) -> None:
    for _ in range(40):
        try:
            connection = HTTPConnection("127.0.0.1", port, timeout=0.5)
            connection.request("GET", "/health")
            response = connection.getresponse()
            if response.status == 200:
                if os.getenv("PROMARKIA_NO_BROWSER") != "1":
                    webbrowser.open(url)
                return
        except OSError:
            time.sleep(0.25)
        finally:
            if "connection" in locals():
                connection.close()


def main() -> None:
    os.environ.setdefault("PROMARKIA_DATA_DIR", str(_default_data_dir()))
    os.environ["PROMARKIA_HOST"] = "127.0.0.1"
    os.environ.setdefault("PROMARKIA_PORT", "8788")

    import uvicorn

    from app.api import app

    port = int(os.environ["PROMARKIA_PORT"])
    url = f"http://127.0.0.1:{port}"
    threading.Thread(target=_open_when_ready, args=(url, port), daemon=True).start()
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        log_config=None,
        access_log=False,
    )


if __name__ == "__main__":
    main()
