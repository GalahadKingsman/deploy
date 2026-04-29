-- Public-facing course author line (фамилия и имя), задаётся экспертом в настройках курса.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS author_display_name text NULL;
