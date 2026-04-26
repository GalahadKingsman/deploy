-- Migration: add user streak fields
-- Created: 2026-04-26
-- Description: Track daily login streak for users (UTC days)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS streak_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_last_day date NULL;

CREATE INDEX IF NOT EXISTS users_streak_last_day_idx ON users(streak_last_day);

