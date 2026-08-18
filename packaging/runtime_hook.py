"""Provide valid output streams for the windowless desktop executable."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path


if sys.stdout is None or sys.stderr is None:
    log_dir = Path(os.getenv("PROMARKIA_DATA_DIR", tempfile.gettempdir()))
    log_dir.mkdir(parents=True, exist_ok=True)
    startup_log = open(
        log_dir / "promarkia-community-startup.log",
        "a",
        encoding="utf-8",
        buffering=1,
    )
    if sys.stdout is None:
        sys.stdout = startup_log
    if sys.stderr is None:
        sys.stderr = startup_log
