#!/usr/bin/env python
"""Strip trailing whitespace and ensure a final newline.

Local pre-commit helper (M1). Operates only on the files passed by
pre-commit via argv (the staged/modified files), never the whole tree.
Pure content edit — no deletion — so it is safe under the host's
safe-delete wrapper.
"""
import sys
from pathlib import Path

FIXABLE_EXT = {".py", ".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".yml", ".yaml", ".md", ".toml"}


def fix(path: Path) -> bool:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return False
    lines = text.splitlines()
    stripped = [ln.rstrip() for ln in lines]
    # ensure single trailing newline
    new_text = "\n".join(stripped)
    if not new_text.endswith("\n"):
        new_text += "\n"
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        return True
    return False


def main() -> int:
    changed = 0
    for arg in sys.argv[1:]:
        p = Path(arg)
        if p.suffix.lower() in FIXABLE_EXT and p.is_file():
            if fix(p):
                changed += 1
                print(f"fixed: {p}")
    # Non-zero tells pre-commit the hook modified files (re-stage needed).
    return 1 if changed else 0


if __name__ == "__main__":
    raise SystemExit(main())
