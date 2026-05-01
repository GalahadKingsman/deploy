-- Migration: support message routing
-- Created: 2026-05-02
--
-- Maps a bot's outbound message in the support supergroup back to the customer's
-- Telegram user ID. When an admin replies (Telegram Reply) to that message in the
-- group, the bot looks up the customer here and forwards the answer to the user's
-- private chat with the bot. Persisting in DB keeps routing alive across bot restarts.

CREATE TABLE IF NOT EXISTS support_message_routing (
  support_group_id     bigint      NOT NULL,
  outbound_message_id  bigint      NOT NULL,
  customer_telegram_id bigint      NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (support_group_id, outbound_message_id)
);

CREATE INDEX IF NOT EXISTS support_message_routing_customer_idx
  ON support_message_routing (customer_telegram_id);
