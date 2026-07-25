"""backfill legacy runtime JSON into the runtime state table

Revision ID: 20260721_0008
Revises: 20260721_0007
"""

from copy import deepcopy
from datetime import datetime

from alembic import op
import sqlalchemy as sa


revision = "20260721_0008"
down_revision = "20260721_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()
    runs = sa.Table("simulation_runs", metadata, autoload_with=bind)
    states = sa.Table("simulation_runtime_states", metadata, autoload_with=bind)
    existing = {row[0] for row in bind.execute(sa.select(states.c.simulation_id))}
    for row in bind.execute(sa.select(runs.c.id, runs.c.config)):
        config = deepcopy(row.config or {})
        runtime = config.pop("runtime_snapshot", None)
        initial = config.pop("initial_runtime_snapshot", None) or runtime
        if not runtime:
            continue
        if row.id in existing:
            bind.execute(states.update().where(states.c.simulation_id == row.id).values(runtime=runtime, initial_runtime=initial))
        else:
            bind.execute(states.insert().values(simulation_id=row.id, runtime=runtime, initial_runtime=initial, revision=0, updated_at=datetime.utcnow()))
        bind.execute(runs.update().where(runs.c.id == row.id).values(config=config))


def downgrade() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()
    runs = sa.Table("simulation_runs", metadata, autoload_with=bind)
    states = sa.Table("simulation_runtime_states", metadata, autoload_with=bind)
    for row in bind.execute(sa.select(states.c.simulation_id, states.c.runtime, states.c.initial_runtime)):
        run = bind.execute(sa.select(runs.c.config).where(runs.c.id == row.simulation_id)).first()
        if run is None:
            continue
        config = deepcopy(run.config or {})
        config["runtime_snapshot"] = row.runtime
        config["initial_runtime_snapshot"] = row.initial_runtime
        bind.execute(runs.update().where(runs.c.id == row.simulation_id).values(config=config))
