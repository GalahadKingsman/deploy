-- Topics + course_topics (EPIC 6.8)
-- Optional seed rows for empty installs (stable ids for predictable UX).

CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS topics_slug_idx ON topics(slug);

CREATE TABLE IF NOT EXISTS course_topics (
  course_id uuid NOT NULL,
  topic_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, topic_id)
);

CREATE INDEX IF NOT EXISTS course_topics_topic_id_idx ON course_topics(topic_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_topics_course_id_fkey') THEN
    ALTER TABLE course_topics
      ADD CONSTRAINT course_topics_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_topics_topic_id_fkey') THEN
    ALTER TABLE course_topics
      ADD CONSTRAINT course_topics_topic_id_fkey
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
  END IF;
END$$;

INSERT INTO topics (id, slug, title) VALUES
  ('b1111111-1111-4111-8111-111111111101', 'common', 'Общее'),
  ('b1111111-1111-4111-8111-111111111102', 'development', 'Разработка'),
  ('b1111111-1111-4111-8111-111111111103', 'design', 'Дизайн'),
  ('b1111111-1111-4111-8111-111111111104', 'marketing', 'Маркетинг')
ON CONFLICT (slug) DO NOTHING;
