-- Track last time the user used the web/TG app (visits to GET /me and similar)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_platform_visit_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS users_last_platform_visit_at_idx
  ON users (last_platform_visit_at DESC)
  WHERE last_platform_visit_at IS NOT NULL;
