-- Migration: course pricing + orders provider fields
-- Created: 2026-04-07
-- PR H: pricing + payment provider scaffolding for Tinkoff

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'RUB';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'tinkoff',
  ADD COLUMN IF NOT EXISTS provider_payment_id text NULL,
  ADD COLUMN IF NOT EXISTS provider_status text NULL,
  ADD COLUMN IF NOT EXISTS pay_url text NULL,
  ADD COLUMN IF NOT EXISTS receipt_email text NULL,
  ADD COLUMN IF NOT EXISTS receipt_phone text NULL;

CREATE INDEX IF NOT EXISTS orders_provider_payment_id_idx ON orders(provider_payment_id);
CREATE INDEX IF NOT EXISTS orders_provider_status_idx ON orders(provider_status);

