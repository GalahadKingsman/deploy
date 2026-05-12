-- Platform-wide legal documents (DOCX), managed in admin panel.

CREATE TABLE IF NOT EXISTS platform_legal_documents (
  doc_kind TEXT PRIMARY KEY CHECK (doc_kind IN ('offer', 'privacy', 'personal_data')),
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS platform_legal_documents_uploaded_at_idx
  ON platform_legal_documents (uploaded_at DESC);
