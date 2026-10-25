"""Block until a workspace file exists, then print it.

Usage: uv run wait.py <file> [seconds]
Without seconds it waits forever. With seconds it exits 3, printing nothing, if the file has not appeared by then;
lab.workflow.js calls it that way and simply calls it again, so the overall wait still has no end.
Exit 3, not 2: uv itself exits 2 when it cannot start the script, and that must read as an error, not as "not yet".
"""
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
target = Path(sys.argv[1])
deadline = time.monotonic() + float(sys.argv[2]) if len(sys.argv) > 2 else None
while not target.exists():
    if deadline is not None and time.monotonic() > deadline:
        sys.exit(3)
    time.sleep(2)
time.sleep(0.5)
print(target.read_text(encoding="utf-8"))
