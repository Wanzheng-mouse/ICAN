"""Persist the link from an AI generation job to its selected scenario."""

from alembic import op
from sqlalchemy import Column, String, inspect


revision = "20260721_0005"
down_revision = "20260721_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {item["name"] for item in inspect(bind).get_columns("generation_jobs")}
    with op.batch_alter_table("generation_jobs") as batch:
        if "selected_candidate_id" not in columns:
            batch.add_column(Column("selected_candidate_id", String(96), nullable=True))
        if "scenario_id" not in columns:
            batch.add_column(Column("scenario_id", String(36), nullable=True))
    indexes = {item["name"] for item in inspect(bind).get_indexes("generation_jobs")}
    if "ix_generation_jobs_selected_candidate_id" not in indexes:
        op.create_index("ix_generation_jobs_selected_candidate_id", "generation_jobs", ["selected_candidate_id"])
    if "ix_generation_jobs_scenario_id" not in indexes:
        op.create_index("ix_generation_jobs_scenario_id", "generation_jobs", ["scenario_id"])


def downgrade() -> None:
    op.drop_index("ix_generation_jobs_scenario_id", table_name="generation_jobs")
    op.drop_index("ix_generation_jobs_selected_candidate_id", table_name="generation_jobs")
    with op.batch_alter_table("generation_jobs") as batch:
        batch.drop_column("scenario_id")
        batch.drop_column("selected_candidate_id")
