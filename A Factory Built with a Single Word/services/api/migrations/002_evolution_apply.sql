-- Revision: 002
-- Application startup performs this additive migration only when the column
-- is missing. For managed SQLite maintenance windows, inspect the table first.

ALTER TABLE evolutions ADD COLUMN applied_scenario_id VARCHAR(36);

