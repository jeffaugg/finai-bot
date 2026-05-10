-- Phase 0: baseline schema
-- Idempotent — safe to run on databases where these tables already exist.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE,
  monthly_income numeric(12, 2) NOT NULL DEFAULT 0,
  fixed_expenses numeric(12, 2) NOT NULL DEFAULT 0,
  saving_percentage numeric(5, 2) NOT NULL DEFAULT 20,
  daily_limit numeric(12, 2) NOT NULL DEFAULT 0,
  success_reserve numeric(12, 2) NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  max_streak integer NOT NULL DEFAULT 0,
  snooze_until timestamptz,
  last_closed_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_telegram_id_idx ON users (telegram_id);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  category text NOT NULL,
  type text NOT NULL CHECK (type IN ('EXPENSE', 'INFLOW')),
  raw_text text NOT NULL DEFAULT '',
  date timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON transactions (user_id, date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS transactions_user_category_idx
  ON transactions (user_id, category)
  WHERE deleted_at IS NULL;
