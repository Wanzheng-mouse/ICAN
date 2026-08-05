"""Pytest configuration for the API service (M8, 2026-07-26).

Goals:
- Isolate the test run from the developer's **active** ``ican.db`` so tests
  never contend with a running backend process and never pollute the real
  database (the previous behaviour ran against ``sqlite:///./ican.db``).
- Use a throwaway temp SQLite file cleaned up at interpreter exit.
- Mirror the dev affordance of exposing the reset token during tests.

This module is imported by pytest **before** any ``app.*`` module, so setting
``ICAN_DATABASE_URL`` here takes effect before ``app.core.config.settings`` is
first instantiated.
"""
from __future__ import annotations

import atexit
import os
import tempfile

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False, prefix="ican-test-")
_tmp.close()
os.environ["ICAN_DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["ICAN_EXPOSE_RESET_TOKEN"] = "true"


def _cleanup_temp_db() -> None:
    try:
        os.unlink(_tmp.name)
    except OSError:
        pass


atexit.register(_cleanup_temp_db)
