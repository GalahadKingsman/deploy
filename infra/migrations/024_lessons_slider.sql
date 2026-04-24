-- Migration: add lessons.slider jsonb
-- Created: 2026-04-24
-- Description: Store lesson image slider (ordered list of image keys)

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS slider jsonb NULL;

