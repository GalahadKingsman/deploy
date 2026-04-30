-- Migration: course difficulty level
-- Created: 2026-04-30
--
-- Optional marketing field used in course preview card.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS difficulty_level text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_difficulty_level_check') THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_difficulty_level_check
      CHECK (difficulty_level IS NULL OR difficulty_level IN ('easy', 'medium', 'hard'));
  END IF;
END $$;

