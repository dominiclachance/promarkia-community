"""Small cross-platform stand-in for the subset of ``fcntl`` used by legacy tools."""

from __future__ import annotations

import threading


class _FcntlCompat:
    LOCK_EX = 1
    LOCK_UN = 2

    def __init__(self) -> None:
        self._lock = threading.RLock()

    def flock(self, _handle, operation: int) -> None:
        if operation == self.LOCK_EX:
            self._lock.acquire()
        elif operation == self.LOCK_UN:
            try:
                self._lock.release()
            except RuntimeError:
                pass


fcntl = _FcntlCompat()
