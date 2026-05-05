-- Referral attribution: who invited a user (first-wins, immutable after first set)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS referred_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_referred_by_user_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_referred_by_user_id_fkey
      FOREIGN KEY (referred_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_referred_by_user_id_idx ON users(referred_by_user_id);

COMMENT ON COLUMN users.referred_by_user_id IS
  'Who invited this user (first successful attribution wins; never overwritten after set).';
COMMENT ON COLUMN users.referred_at IS
  'Timestamp of the first successful referral attribution.';
