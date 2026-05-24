-- Texto livre enviado via /feedback, insumo para a discussão da monografia.
-- Idempotente — seguro reaplicar.

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_user_created_idx
  ON feedback (user_id, created_at DESC);
