#!/usr/bin/env python
"""Validate YAML files passed by pre-commit.

Local pre-commit helper (M1). Supports multi-document YAML (--allow-multiple-documents).
Pure validation — no file mutation.
"""
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML not available in this venv; install with: pip install pyyaml")
    raise SystemExit(2)


def main() -> int:
    allow_multi = "--allow-multiple-documents" in sys.argv
    paths = [a for a in sys.argv[1:] if not a.startswith("--")]
    bad = 0
    for arg in paths:
        p = Path(arg)
        if not p.is_file():
            continue
        try:
            if allow_multi:
                list(yaml.safe_load_all(p.read_text(encoding="utf-8")))
            else:
                yaml.safe_load(p.read_text(encoding="utf-8"))
        except yaml.YAMLError as e:
            bad += 1
            print(f"invalid YAML: {p}\n  {e}")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
