-- Migration: lesson material files (expert uploads visible to students)
-- Created: 2026-04-28

CREATE TABLE IF NOT EXISTS lesson_material_files (
  id uuid PRIMARY KEY,
  lesson_id uuid NOT NULL,
  file_key text NOT NULL,
  filename text NOT NULL,
  content_type text NULL,
  size_bytes bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lesson_material_files_file_key_uidx ON lesson_material_files(file_key);
CREATE INDEX IF NOT EXISTS lesson_material_files_lesson_id_idx ON lesson_material_files(lesson_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_material_files_lesson_id_fkey') THEN
    ALTER TABLE lesson_material_files
      ADD CONSTRAINT lesson_material_files_lesson_id_fkey
      FOREIGN KEY (lesson_id) REFERENCES lessons(id);
  END IF;
END$$;

