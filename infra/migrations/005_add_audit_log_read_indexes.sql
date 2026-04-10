-- Migration: Add indexes for admin audit read (cursor + filters)
-- Story 4.4: GET /admin/audit with cursor pagination and filters

-- Cursor pagination: ORDER BY created_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at_id_desc
  ON audit_log (created_at DESC, id DESC);

-- Filter by trace_id
CREATE INDEX IF NOT EXISTS idx_audit_log_trace_id ON audit_log (trace_id) WHERE trace_id IS NOT NULL;

-- Filter by actor_user_id
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON audit_log (actor_user_id) WHERE actor_user_id IS NOT NULL;

-- Filter by entity_type + entity_id
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type_id ON audit_log (entity_type, entity_id);
