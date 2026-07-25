-- Revision: 001
-- Existing databases are upgraded safely at application startup through
-- SQLAlchemy create_all plus ensure_schema. This file documents the release
-- schema delta for operators that manage SQLite manually.

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  action VARCHAR(64) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(64) NOT NULL,
  detail JSON NOT NULL DEFAULT '{}',
  created_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at);

