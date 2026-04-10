-- Migration: add referral_code to users
-- Created: 2026-04-07

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code text NULL;

-- Referral codes must be unique, but allow NULLs
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_uq ON users(referral_code);

