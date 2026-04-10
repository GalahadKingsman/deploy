-- Migration: orders + commissions (payments scaffolding)
-- Created: 2026-04-07

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'RUB',
  status text NOT NULL DEFAULT 'created', -- created|paid|cancelled|failed
  referral_code text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders(user_id);
CREATE INDEX IF NOT EXISTS orders_course_id_idx ON orders(course_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

CREATE TABLE IF NOT EXISTS commissions (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  referral_code text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commissions_order_id_idx ON commissions(order_id);
CREATE INDEX IF NOT EXISTS commissions_referral_code_idx ON commissions(referral_code);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_user_id_fkey') THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_course_id_fkey') THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES courses(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commissions_order_id_fkey') THEN
    ALTER TABLE commissions
      ADD CONSTRAINT commissions_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders(id);
  END IF;
END$$;

