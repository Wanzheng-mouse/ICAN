"""Create the ICAN baseline schema and upgrade pre-Alembic SQLite databases."""

from alembic import op
from sqlalchemy import inspect, text

from app.database import Base
import app.models  # noqa: F401


revision = "20260718_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    if bind.dialect.name != "sqlite":
        return

    inspector = inspect(bind)
    project_columns = {column["name"] for column in inspector.get_columns("projects")}
    if "updated_at" not in project_columns:
        bind.execute(text("ALTER TABLE projects ADD COLUMN updated_at DATETIME"))
        bind.execute(text("UPDATE projects SET updated_at = created_at WHERE updated_at IS NULL"))
    if "archived_at" not in project_columns:
        bind.execute(text("ALTER TABLE projects ADD COLUMN archived_at DATETIME"))

    token_columns = {column["name"] for column in inspector.get_columns("auth_tokens")}
    if "expires_at" not in token_columns:
        bind.execute(text("ALTER TABLE auth_tokens ADD COLUMN expires_at DATETIME"))
    bind.execute(text("DELETE FROM auth_tokens WHERE expires_at IS NULL"))

    evolution_columns = {column["name"] for column in inspector.get_columns("evolutions")}
    if "applied_scenario_id" not in evolution_columns:
        bind.execute(text("ALTER TABLE evolutions ADD COLUMN applied_scenario_id VARCHAR(36)"))


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
