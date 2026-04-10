-- Migration: applied_migrations + platform_role
-- Created: 2026-01-31
-- Story 4.1: Platform roles

CREATE TABLE IF NOT EXISTS applied_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS platform_role text NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS users_platform_role_idx ON users(platform_role);
