"""Add template recommendation telemetry and persisted generation jobs."""

from alembic import op
from sqlalchemy import Boolean, Column, Integer, JSON, inspect

from app.database import Base
from app.models import GenerationJob, TemplateEvent  # noqa: F401


revision = "20260719_0003"
down_revision = "20260719_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.tables["template_events"].create(bind=bind, checkfirst=True)
    Base.metadata.tables["generation_jobs"].create(bind=bind, checkfirst=True)
    columns = {column["name"] for column in inspect(bind).get_columns("templates")}
    with op.batch_alter_table("templates") as batch:
        if "profile" not in columns:
            batch.add_column(Column("profile", JSON(), nullable=False, server_default="{}"))
        if "quality_score" not in columns:
            batch.add_column(Column("quality_score", Integer(), nullable=False, server_default="60"))
        if "published" not in columns:
            batch.add_column(Column("published", Boolean(), nullable=False, server_default="1"))
    indexes = {item["name"] for item in inspect(bind).get_indexes("templates")}
    if "ix_templates_published" not in indexes:
        op.create_index("ix_templates_published", "templates", ["published"], unique=False)


def downgrade() -> None:
    indexes = {item["name"] for item in inspect(op.get_bind()).get_indexes("templates")}
    if "ix_templates_published" in indexes:
        op.drop_index("ix_templates_published", table_name="templates")
    with op.batch_alter_table("templates") as batch:
        batch.drop_column("published")
        batch.drop_column("quality_score")
        batch.drop_column("profile")
    bind = op.get_bind()
    Base.metadata.tables["generation_jobs"].drop(bind=bind, checkfirst=True)
    Base.metadata.tables["template_events"].drop(bind=bind, checkfirst=True)
