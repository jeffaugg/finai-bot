-- Lacunas de capacidade: pedidos sobre finanças que o agente não conseguiu atender.
-- Insumo estruturado para mapear gaps e evoluir as tools. Idempotente.

CREATE TABLE IF NOT EXISTS capability_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  input_text text NOT NULL,
  intent text NOT NULL,
  reason text NOT NULL,
  suggestion text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS capability_gaps_created_idx
  ON capability_gaps (created_at DESC);

ALTER TABLE capability_gaps ENABLE ROW LEVEL SECURITY;
