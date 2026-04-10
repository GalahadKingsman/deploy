-- Migration: expert_subscriptions (free stub, default row on expert create)
-- Story 5.1: Subscription model (free stub) + default row on expert create
-- expert_id PRIMARY KEY ensures ON CONFLICT (expert_id) DO NOTHING in ensureDefault is valid.

CREATE TABLE IF NOT EXISTS expert_subscriptions (
  expert_id uuid PRIMARY KEY REFERENCES experts(id) ON DELETE CASCADE,
  plan text NOT NULL,
  status text NOT NULL,
  current_period_start timestamptz NULL,
  current_period_end timestamptz NULL,
  price_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expert_subscriptions_status ON expert_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_expert_subscriptions_period_end ON expert_subscriptions(current_period_end);
