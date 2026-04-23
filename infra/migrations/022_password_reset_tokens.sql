-- Migration: one-time password reset tokens + session invalidation
-- Created: 2026-04-23
--
-- 1) Store one-time reset tokens (hashed), with TTL and auditing
-- 2) Add users.auth_invalid_before to invalidate existing JWT sessions after password change

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_invalid_before timestamptz NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_by_admin_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_uq
  ON password_reset_tokens(token_hash);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
  ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx
  ON password_reset_tokens(expires_at);

