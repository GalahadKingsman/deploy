-- Migration: Add ban fields to users and create audit_log table
-- Created: 2026-01-30
-- Story 3.5: ban enforcement

-- Users: banned = banned_at IS NOT NULL
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT NULL;

-- Minimal audit log for denied access (EPIC 4 will extend)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  meta JSONB NULL,
  trace_id TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
