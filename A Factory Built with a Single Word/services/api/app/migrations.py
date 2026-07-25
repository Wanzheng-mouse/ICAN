from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config


def alembic_config() -> Config:
    api_root = Path(__file__).resolve().parents[1]
    return Config(str(api_root / "alembic.ini"))


def upgrade_database() -> None:
    command.upgrade(alembic_config(), "head")
