"""Add distributed runtime leases and persistent simulation events."""

from alembic import op

from app.database import Base
import app.models  # noqa: F401


revision = "20260721_0006"
down_revision = "20260721_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    for name in ("simulation_runtime_leases", "simulation_event_records"):
        Base.metadata.tables[name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for name in ("simulation_event_records", "simulation_runtime_leases"):
        Base.metadata.tables[name].drop(bind=bind, checkfirst=True)
