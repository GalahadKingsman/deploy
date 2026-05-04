-- Различаем подпись «промежуточная / итоговая» независимо от привязки к модулю или к курсу.

ALTER TABLE course_attestations
  ADD COLUMN IF NOT EXISTS display_kind text NOT NULL DEFAULT 'final';

UPDATE course_attestations
SET display_kind = 'intermediate'
WHERE module_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_attestations_display_kind_check'
  ) THEN
    ALTER TABLE course_attestations
      ADD CONSTRAINT course_attestations_display_kind_check
      CHECK (display_kind IN ('intermediate', 'final'));
  END IF;
END $$;
