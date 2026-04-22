-- Migration: email+password auth and telegram linking
-- Created: 2026-04-22
--
-- 1) Allow email/password users without Telegram
-- 2) Store password hash
-- 3) Enforce case-insensitive uniqueness for email
--

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash text NULL;

-- telegram_user_id is required for TG-first accounts, but must be nullable for email-first accounts.
ALTER TABLE users
  ALTER COLUMN telegram_user_id DROP NOT NULL;

-- Email must be unique (case-insensitive), but allow NULLs
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq ON users (LOWER(email)) WHERE email IS NOT NULL;

