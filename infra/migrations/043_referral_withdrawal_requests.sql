-- Заявки на вывод реферальных начислений (без реальных платежей; учёт через суммы + статусы).

CREATE TABLE IF NOT EXISTS referral_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  card_pan text NOT NULL,
  phone text NOT NULL,
  bank_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz NULL,
  decided_by_user_id uuid NULL REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_referral_withdrawal_requests_user_id
  ON referral_withdrawal_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referral_withdrawal_requests_status_created
  ON referral_withdrawal_requests (status, created_at DESC);

-- Не более одной заявки «на рассмотрении» на пользователя.
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_withdrawal_one_pending_per_user
  ON referral_withdrawal_requests (user_id)
  WHERE status = 'pending';
