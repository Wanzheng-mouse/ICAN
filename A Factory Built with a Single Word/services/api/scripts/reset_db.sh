#!/usr/bin/env bash
# Reset the ICAN SQLite database via Alembic.
# Keeps the migration history intact — never hand-edit the schema.
# Usage: bash services/api/scripts/reset_db.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .venv/Scripts/python.exe ]; then
  PY=.venv/Scripts/python.exe
elif [ -f .venv/bin/python ]; then
  PY=.venv/bin/python
else
  PY=python
fi

echo "Removing existing ican.db ..."
rm -f ican.db

echo "Applying Alembic migrations to head ..."
"$PY" -m alembic upgrade head

echo "Database reset complete (via Alembic)."
