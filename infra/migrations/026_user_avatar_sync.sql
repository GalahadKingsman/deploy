-- Migration: user avatar sync fields
-- Created: 2026-04-26
-- Description: Store last time we synced user's avatar from Telegram

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_synced_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS users_avatar_synced_at_idx ON users(avatar_synced_at);

