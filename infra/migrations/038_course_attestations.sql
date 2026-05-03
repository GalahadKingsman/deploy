-- Migration: course attestations (modular and course-level)
-- Created: 2026-05-03
--
-- Adds attestation entities to courses. An attestation belongs to a course and
-- optionally to a module (NULL module_id = course-level / final attestation).
-- Each attestation has questions and per-question options; a single option per
-- question is marked correct (single-choice / radio).
-- Student submissions are persisted as attempts (unlimited retakes).

CREATE TABLE IF NOT EXISTS course_attestations (
  id uuid PRIMARY KEY,
  course_id uuid NOT NULL,
  module_id uuid NULL,
  position integer NOT NULL DEFAULT 0,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_attestations_course_id_idx ON course_attestations(course_id);
CREATE INDEX IF NOT EXISTS course_attestations_course_module_idx ON course_attestations(course_id, module_id);
CREATE INDEX IF NOT EXISTS course_attestations_course_id_deleted_at_idx ON course_attestations(course_id, deleted_at);

CREATE TABLE IF NOT EXISTS attestation_questions (
  id uuid PRIMARY KEY,
  attestation_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attestation_questions_attestation_idx ON attestation_questions(attestation_id);
CREATE INDEX IF NOT EXISTS attestation_questions_attestation_position_idx ON attestation_questions(attestation_id, position);

CREATE TABLE IF NOT EXISTS attestation_question_options (
  id uuid PRIMARY KEY,
  question_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attestation_question_options_question_idx ON attestation_question_options(question_id);
CREATE INDEX IF NOT EXISTS attestation_question_options_question_position_idx ON attestation_question_options(question_id, position);

CREATE TABLE IF NOT EXISTS attestation_attempts (
  id uuid PRIMARY KEY,
  attestation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  answers jsonb NOT NULL,
  correct_count integer NOT NULL,
  question_count integer NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attestation_attempts_user_idx ON attestation_attempts(user_id);
CREATE INDEX IF NOT EXISTS attestation_attempts_attestation_user_idx
  ON attestation_attempts(attestation_id, user_id, submitted_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_attestations_course_id_fkey') THEN
    ALTER TABLE course_attestations
      ADD CONSTRAINT course_attestations_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES courses(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_attestations_module_id_fkey') THEN
    ALTER TABLE course_attestations
      ADD CONSTRAINT course_attestations_module_id_fkey
      FOREIGN KEY (module_id) REFERENCES course_modules(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attestation_questions_attestation_id_fkey') THEN
    ALTER TABLE attestation_questions
      ADD CONSTRAINT attestation_questions_attestation_id_fkey
      FOREIGN KEY (attestation_id) REFERENCES course_attestations(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attestation_question_options_question_id_fkey') THEN
    ALTER TABLE attestation_question_options
      ADD CONSTRAINT attestation_question_options_question_id_fkey
      FOREIGN KEY (question_id) REFERENCES attestation_questions(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attestation_attempts_attestation_id_fkey') THEN
    ALTER TABLE attestation_attempts
      ADD CONSTRAINT attestation_attempts_attestation_id_fkey
      FOREIGN KEY (attestation_id) REFERENCES course_attestations(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attestation_attempts_user_id_fkey') THEN
    ALTER TABLE attestation_attempts
      ADD CONSTRAINT attestation_attempts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
END$$;
