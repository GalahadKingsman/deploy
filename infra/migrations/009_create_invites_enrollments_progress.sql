-- Migration: invites + enrollments + lesson progress
-- Created: 2026-04-07
-- EPIC 8/9 core: access distribution + student progress

CREATE TABLE IF NOT EXISTS course_invites (
  id uuid PRIMARY KEY,
  course_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  expires_at timestamptz NULL,
  max_uses integer NULL,
  uses_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz NULL,
  created_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_invites_course_id_idx ON course_invites(course_id);
CREATE INDEX IF NOT EXISTS course_invites_code_idx ON course_invites(code);
CREATE INDEX IF NOT EXISTS course_invites_revoked_at_idx ON course_invites(revoked_at);

CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  access_end timestamptz NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS enrollments_user_id_idx ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS enrollments_course_id_idx ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS enrollments_user_course_idx ON enrollments(user_id, course_id);
CREATE INDEX IF NOT EXISTS enrollments_revoked_at_idx ON enrollments(revoked_at);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS lesson_progress_user_id_idx ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS lesson_progress_lesson_id_idx ON lesson_progress(lesson_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_invites_course_id_fkey') THEN
    ALTER TABLE course_invites
      ADD CONSTRAINT course_invites_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES courses(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_user_id_fkey') THEN
    ALTER TABLE enrollments
      ADD CONSTRAINT enrollments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_course_id_fkey') THEN
    ALTER TABLE enrollments
      ADD CONSTRAINT enrollments_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES courses(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_progress_user_id_fkey') THEN
    ALTER TABLE lesson_progress
      ADD CONSTRAINT lesson_progress_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_progress_lesson_id_fkey') THEN
    ALTER TABLE lesson_progress
      ADD CONSTRAINT lesson_progress_lesson_id_fkey
      FOREIGN KEY (lesson_id) REFERENCES lessons(id);
  END IF;
END$$;

