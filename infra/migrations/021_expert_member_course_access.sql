-- Migration: per-course access for expert team members (non-owner)
-- Created: 2026-04-23

CREATE TABLE IF NOT EXISTS expert_member_course_access (
  expert_id uuid NOT NULL REFERENCES experts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expert_id, user_id, course_id)
);

CREATE INDEX IF NOT EXISTS expert_member_course_access_expert_user_idx
  ON expert_member_course_access (expert_id, user_id);
CREATE INDEX IF NOT EXISTS expert_member_course_access_course_idx
  ON expert_member_course_access (course_id);

-- Backfill: non-owner members get access to all non-deleted courses of their expert (owners use bypass, no rows)
INSERT INTO expert_member_course_access (expert_id, user_id, course_id, created_at)
SELECT em.expert_id, em.user_id, c.id, now()
FROM expert_members em
INNER JOIN courses c ON c.expert_id = em.expert_id AND c.deleted_at IS NULL
WHERE em.role <> 'owner'
ON CONFLICT (expert_id, user_id, course_id) DO NOTHING;
