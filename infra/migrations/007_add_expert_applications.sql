-- Migration: expert_applications (Story 5.6)
-- Student can submit one application to become expert. Status: pending | approved | rejected.

CREATE TABLE IF NOT EXISTS expert_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text NULL,
  admin_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz NULL,
  decided_by_user_id uuid NULL REFERENCES users(id),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_expert_applications_status_created_at
  ON expert_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_applications_user_id
  ON expert_applications(user_id);
