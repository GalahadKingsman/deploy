-- Migration: expert submission views (homework inbox status)
-- Created: 2026-04-23
--
-- Global “opened” state for expert homework review UI:
-- - New: not opened yet
-- - Unchecked: opened but not accepted
-- - Checked: accepted (from submissions.status)

CREATE TABLE IF NOT EXISTS expert_submission_views (
  submission_id uuid PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
  first_opened_at timestamptz NOT NULL DEFAULT now(),
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS expert_submission_views_last_opened_at_idx
  ON expert_submission_views(last_opened_at DESC);

