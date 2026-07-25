"""Persist simulation runtime checkpoints and queryable task/cargo projections."""

from alembic import op

from app.database import Base
import app.models  # noqa: F401 - register mapped tables


revision = "20260721_0004"
down_revision = "20260719_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    for table_name in ("simulation_snapshots", "simulation_task_records", "simulation_cargo_records"):
        Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table_name in ("simulation_cargo_records", "simulation_task_records", "simulation_snapshots"):
        Base.metadata.tables[table_name].drop(bind=bind, checkfirst=True)
