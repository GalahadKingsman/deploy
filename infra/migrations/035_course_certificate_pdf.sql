-- Migration: course certificate PDF
-- Created: 2026-05-01
--
-- Optional PDF certificate for a course; a single file per course (replace by re-upload).
-- Stored in S3 under prefix `course-certificates/{course_id}/...`.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS certificate_pdf_key text NULL,
  ADD COLUMN IF NOT EXISTS certificate_original_filename text NULL,
  ADD COLUMN IF NOT EXISTS certificate_uploaded_at timestamptz NULL;
