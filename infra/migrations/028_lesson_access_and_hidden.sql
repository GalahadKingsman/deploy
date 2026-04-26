-- Course lesson access mode (sequential = unlock next; open = all visible at once) + hide lesson from students

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS lesson_access_mode text NOT NULL DEFAULT 'sequential';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_lesson_access_mode_check'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_lesson_access_mode_check
      CHECK (lesson_access_mode IN ('sequential', 'open'));
  END IF;
END$$;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS hidden_from_students boolean NOT NULL DEFAULT false;
