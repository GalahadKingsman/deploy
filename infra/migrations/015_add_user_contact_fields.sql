-- Migration: add user contact fields for receipts (54-FZ)
-- Created: 2026-04-07
-- PR I: store buyer contact in DB (email/phone)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email text NULL,
  ADD COLUMN IF NOT EXISTS phone text NULL;

