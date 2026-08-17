from __future__ import annotations

import re
import subprocess
import sys


base = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
commits = subprocess.check_output(
    ["git", "rev-list", f"{base}..HEAD"], text=True, encoding="utf-8"
).splitlines()
missing = []
pattern = re.compile(r"^Signed-off-by:\s+.+\s+<[^<>\s]+@[^<>\s]+>$", re.MULTILINE)
for commit in commits:
    body = subprocess.check_output(
        ["git", "show", "-s", "--format=%B", commit], text=True, encoding="utf-8"
    )
    if not pattern.search(body):
        missing.append(commit)
if missing:
    print("Commits missing a valid DCO sign-off:")
    print("\n".join(missing))
    raise SystemExit(1)
print(f"DCO check passed for {len(commits)} commit(s)")
