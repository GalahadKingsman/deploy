-- Paid platform access for users who checkout expert_subscription without an expert workspace (expert_id NULL on order).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS platform_subscription_paid_until TIMESTAMPTZ NULL;

COMMENT ON COLUMN users.platform_subscription_paid_until IS
  'End of paid platform period for student checkout (orders with order_kind=expert_subscription and expert_id IS NULL).';
