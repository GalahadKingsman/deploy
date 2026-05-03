-- Migration: orders support expert subscription (no course purchase flow)
-- course_id becomes nullable; expert_id + order_kind for subscription checkouts.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_kind text NOT NULL DEFAULT 'course',
  ADD COLUMN IF NOT EXISTS expert_id uuid NULL REFERENCES experts(id) ON DELETE SET NULL;

ALTER TABLE orders ALTER COLUMN course_id DROP NOT NULL;

COMMENT ON COLUMN orders.order_kind IS 'course = legacy student course order; expert_subscription = expert platform subscription';
COMMENT ON COLUMN orders.expert_id IS 'Set when order_kind = expert_subscription (workspace expert paying subscription)';
