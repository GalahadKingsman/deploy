ALTER TABLE platform_legal_documents
  ADD COLUMN IF NOT EXISTS pdf_storage_key TEXT NULL,
  ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN platform_legal_documents.pdf_storage_key IS 'S3 key for generated PDF (public download)';
COMMENT ON COLUMN platform_legal_documents.pdf_generated_at IS 'When PDF was generated from DOCX';
