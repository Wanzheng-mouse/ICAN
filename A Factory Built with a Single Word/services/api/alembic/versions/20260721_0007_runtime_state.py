"""move mutable simulation runtime out of run config

Revision ID: 20260721_0007
Revises: 20260721_0006
"""

from alembic import op

from app.database import Base
import app.models  # noqa: F401

revision = "20260721_0007"
down_revision = "20260721_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.tables["simulation_runtime_states"].create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    Base.metadata.tables["simulation_runtime_states"].drop(bind=op.get_bind(), checkfirst=True)
