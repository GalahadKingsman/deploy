-- Lesson presentation (PPTX + generated PDF)
-- Created: 2026-04-27
-- Description: Store lesson presentation file keys (pptx/pdf) for rendering in lesson view

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS presentation jsonb NULL;

