CREATE TABLE IF NOT EXISTS user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_events_user_created_idx
  ON user_events (user_id, created_at DESC);

-- Trilha append-only: bloqueia UPDATE/DELETE para garantir a integridade dos
-- dados de pesquisa. Em produção a tabela nunca deve sofrer mutação após o INSERT.
CREATE OR REPLACE FUNCTION prevent_user_events_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'user_events é append-only: % não é permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_events_no_mutation ON user_events;
CREATE TRIGGER user_events_no_mutation
  BEFORE UPDATE OR DELETE ON user_events
  FOR EACH ROW EXECUTE FUNCTION prevent_user_events_mutation();

-- Snapshot diário: estado de retenção por usuário ao fim de cada dia.
-- UNIQUE (user_id, snapshot_date) torna o fechamento diário idempotente (ver Fase 2).
CREATE TABLE IF NOT EXISTS daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  current_streak integer NOT NULL,
  success_reserve numeric(12, 2) NOT NULL,
  daily_limit numeric(12, 2) NOT NULL,
  total_spent numeric(12, 2) NOT NULL,
  had_activity boolean NOT NULL,
  close_result text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS daily_snapshots_user_date_idx
  ON daily_snapshots (user_id, snapshot_date DESC);
