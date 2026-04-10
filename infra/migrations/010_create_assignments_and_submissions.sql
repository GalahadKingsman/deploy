-- Migration: assignments + submissions (EPIC 10)
-- Created: 2026-04-07

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY,
  lesson_id uuid NOT NULL,
  prompt_md text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS assignments_lesson_id_uidx ON assignments(lesson_id);

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL,
  student_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  text text NULL,
  link text NULL,
  file_key text NULL,
  status text NOT NULL DEFAULT 'submitted', -- submitted|rework|accepted
  decided_at timestamptz NULL,
  decided_by_user_id uuid NULL
);

CREATE INDEX IF NOT EXISTS submissions_assignment_id_idx ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS submissions_student_user_id_idx ON submissions(student_user_id);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions(status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignments_lesson_id_fkey') THEN
    ALTER TABLE assignments
      ADD CONSTRAINT assignments_lesson_id_fkey
      FOREIGN KEY (lesson_id) REFERENCES lessons(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_assignment_id_fkey') THEN
    ALTER TABLE submissions
      ADD CONSTRAINT submissions_assignment_id_fkey
      FOREIGN KEY (assignment_id) REFERENCES assignments(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_student_user_id_fkey') THEN
    ALTER TABLE submissions
      ADD CONSTRAINT submissions_student_user_id_fkey
      FOREIGN KEY (student_user_id) REFERENCES users(id);
  END IF;
END$$;

