-- Stub tables: refund requests (admin) + partner payout requests (user)
-- Gap plan 2: нет вызовов банка; только учёт заявок и статусы-заглушки

CREATE TABLE IF NOT EXISTS payment_refund_requests (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'stub_in_development',
  created_by_user_id uuid NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_refund_requests_order_id_idx ON payment_refund_requests(order_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_refund_requests_order_id_fkey') THEN
    ALTER TABLE payment_refund_requests
      ADD CONSTRAINT payment_refund_requests_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_refund_requests_created_by_user_id_fkey') THEN
    ALTER TABLE payment_refund_requests
      ADD CONSTRAINT payment_refund_requests_created_by_user_id_fkey
      FOREIGN KEY (created_by_user_id) REFERENCES users(id);
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS partner_payout_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'stub_in_development',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_payout_requests_user_id_idx ON partner_payout_requests(user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_payout_requests_user_id_fkey') THEN
    ALTER TABLE partner_payout_requests
      ADD CONSTRAINT partner_payout_requests_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
END$$;
