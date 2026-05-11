-- Checkout product / billing metadata on orders (server-calculated amounts; do not trust client)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS checkout_product text NULL,
  ADD COLUMN IF NOT EXISTS billing_period text NULL,
  ADD COLUMN IF NOT EXISTS subscription_period_days integer NULL;

COMMENT ON COLUMN orders.checkout_product IS 'platform_entry | expert_pro — тариф лендинга.';
COMMENT ON COLUMN orders.billing_period IS 'monthly | yearly — период оплаты.';
COMMENT ON COLUMN orders.subscription_period_days IS 'Дней подписки, начисляемых при успешной оплате (30 или 365).';

CREATE INDEX IF NOT EXISTS orders_user_checkout_created_idx
  ON orders (user_id, checkout_product, billing_period, status)
  WHERE order_kind = 'expert_subscription' AND status = 'created';

-- User-level Tinkoff recurrent + UI «автопродление»
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_auto_renew boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tinkoff_customer_key text NULL,
  ADD COLUMN IF NOT EXISTS tinkoff_rebill_id text NULL,
  ADD COLUMN IF NOT EXISTS last_subscription_checkout_product text NULL,
  ADD COLUMN IF NOT EXISTS last_subscription_billing_period text NULL,
  ADD COLUMN IF NOT EXISTS last_subscription_billed_amount_cents integer NULL;

COMMENT ON COLUMN users.subscription_auto_renew IS 'Автопродление подписки (рекуррент Charge).';
COMMENT ON COLUMN users.tinkoff_customer_key IS 'CustomerKey для Init/Charge (стабильный id покупателя).';
COMMENT ON COLUMN users.tinkoff_rebill_id IS 'RebillId из уведомления Tinkoff после первой оплаты с Recurrent=Y.';
COMMENT ON COLUMN users.last_subscription_billed_amount_cents IS 'Последняя успешно списанная сумма (копейки) для повторного Charge.';
