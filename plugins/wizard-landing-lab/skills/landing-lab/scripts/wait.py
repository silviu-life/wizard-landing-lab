"""Block until a workspace file exists, then print it.

Usage: uv run wait.py <file> [seconds]
Without seconds it waits forever. With seconds it exits 2, printing nothing, if the file has not appeared by then;
lab.workflow.js calls it that way and simply calls it again, so the overall wait still has no end.
"""
import sys
import time
from pathlib import Path

target = Path(sys.argv[1])
deadline = time.monotonic() + float(sys.argv[2]) if len(sys.argv) > 2 else None
while not target.exists():
    if deadline is not None and time.monotonic() > deadline:
        sys.exit(2)
    time.sleep(2)
time.sleep(0.5)
print(target.read_text())
