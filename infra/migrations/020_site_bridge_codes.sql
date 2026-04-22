-- Migration: persist site-bridge one-time codes (for marketing login + telegram link)
-- Created: 2026-04-22

CREATE TABLE IF NOT EXISTS auth_site_bridge_codes (
  code text PRIMARY KEY,
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_site_bridge_codes_expires_at_idx ON auth_site_bridge_codes(expires_at);
CREATE INDEX IF NOT EXISTS auth_site_bridge_codes_consumed_at_idx ON auth_site_bridge_codes(consumed_at);

