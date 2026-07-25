"""Persist resource-center cases and learning content."""

from alembic import op

from app.database import Base
from app.models import LearningResource, ResourceCase  # noqa: F401


revision = "20260719_0002"
down_revision = "20260718_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    for name in ("resource_cases", "learning_resources"):
        Base.metadata.tables[name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for name in ("learning_resources", "resource_cases"):
        Base.metadata.tables[name].drop(bind=bind, checkfirst=True)
