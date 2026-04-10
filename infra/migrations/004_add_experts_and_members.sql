-- Migration: experts + expert_members
-- Created: 2026-01-31
-- Story 4.2: Expert accounts + expert members (Owner/Manager/Reviewer/Support)

CREATE TABLE IF NOT EXISTS experts (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  slug text NULL UNIQUE,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS experts_created_by_user_id_idx ON experts(created_by_user_id);

CREATE TABLE IF NOT EXISTS expert_members (
  expert_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(expert_id, user_id)
);

CREATE INDEX IF NOT EXISTS expert_members_expert_id_idx ON expert_members(expert_id);
CREATE INDEX IF NOT EXISTS expert_members_user_id_idx ON expert_members(user_id);
CREATE INDEX IF NOT EXISTS expert_members_expert_id_role_idx ON expert_members(expert_id, role);
