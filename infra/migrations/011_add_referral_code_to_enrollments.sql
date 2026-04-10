-- Migration: add referral_code to enrollments
-- Created: 2026-04-07

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS referral_code text NULL;

CREATE INDEX IF NOT EXISTS enrollments_referral_code_idx ON enrollments(referral_code);

