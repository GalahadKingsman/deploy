-- Migration: assignment files + submission grading (score/comment)
-- Created: 2026-04-17

CREATE TABLE IF NOT EXISTS assignment_files (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL,
  file_key text NOT NULL,
  filename text NOT NULL,
  content_type text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS assignment_files_file_key_uidx ON assignment_files(file_key);
CREATE INDEX IF NOT EXISTS assignment_files_assignment_id_idx ON assignment_files(assignment_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignment_files_assignment_id_fkey') THEN
    ALTER TABLE assignment_files
      ADD CONSTRAINT assignment_files_assignment_id_fkey
      FOREIGN KEY (assignment_id) REFERENCES assignments(id);
  END IF;
END$$;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS score int NULL,
  ADD COLUMN IF NOT EXISTS reviewer_comment text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_score_check') THEN
    ALTER TABLE submissions
      ADD CONSTRAINT submissions_score_check
      CHECK (score IS NULL OR (score >= 1 AND score <= 5));
  END IF;
END$$;

