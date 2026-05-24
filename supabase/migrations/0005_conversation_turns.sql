-- Buffer de turnos recentes por usuário, injetado no contexto do agente para
-- permitir follow-up (ex.: pedir o valor quando o usuário só diz "gastei no mercado").
-- Idempotente — seguro reaplicar.

CREATE TABLE IF NOT EXISTS conversation_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'model')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_turns_user_created_idx
  ON conversation_turns (user_id, created_at DESC);
