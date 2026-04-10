-- Migration: courses + course_modules + lessons
-- Created: 2026-04-07
-- EPIC 6: Course authoring core (draft/publish) + modules + lessons

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY,
  expert_id uuid NOT NULL,
  title text NOT NULL,
  description text NULL,
  cover_url text NULL,
  status text NOT NULL DEFAULT 'draft', -- draft|published|archived
  visibility text NOT NULL DEFAULT 'private', -- private|public
  published_at timestamptz NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS courses_expert_id_idx ON courses(expert_id);
CREATE INDEX IF NOT EXISTS courses_expert_id_status_idx ON courses(expert_id, status);
CREATE INDEX IF NOT EXISTS courses_expert_id_deleted_at_idx ON courses(expert_id, deleted_at);

CREATE TABLE IF NOT EXISTS course_modules (
  id uuid PRIMARY KEY,
  course_id uuid NOT NULL,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_modules_course_id_idx ON course_modules(course_id);
CREATE INDEX IF NOT EXISTS course_modules_course_id_position_idx ON course_modules(course_id, position);
CREATE INDEX IF NOT EXISTS course_modules_course_id_deleted_at_idx ON course_modules(course_id, deleted_at);

CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY,
  module_id uuid NOT NULL,
  title text NOT NULL,
  content_md text NULL,
  position integer NOT NULL DEFAULT 0,
  video jsonb NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lessons_module_id_idx ON lessons(module_id);
CREATE INDEX IF NOT EXISTS lessons_module_id_position_idx ON lessons(module_id, position);
CREATE INDEX IF NOT EXISTS lessons_module_id_deleted_at_idx ON lessons(module_id, deleted_at);

-- Foreign keys (added at end for clarity; no cascade delete because we use soft-delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_expert_id_fkey'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_expert_id_fkey
      FOREIGN KEY (expert_id) REFERENCES experts(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_modules_course_id_fkey'
  ) THEN
    ALTER TABLE course_modules
      ADD CONSTRAINT course_modules_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES courses(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lessons_module_id_fkey'
  ) THEN
    ALTER TABLE lessons
      ADD CONSTRAINT lessons_module_id_fkey
      FOREIGN KEY (module_id) REFERENCES course_modules(id);
  END IF;
END$$;

