"""Router package for the ICAN API (M4, 2026-07-26).

Each module defines an ``APIRouter`` instance; ``app/main.py`` imports them and
calls ``app.include_router(...)``. Keeping them here (rather than a single flat
file) keeps per-domain route code isolated and reviewable.
"""
