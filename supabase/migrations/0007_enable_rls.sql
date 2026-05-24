-- Habilita RLS em todas as tabelas do schema public.
-- O bot acessa via service_role, que ignora RLS — então o acesso server-side
-- segue intacto. Sem policies, anon/authenticated ficam em default-deny, fechando
-- a API pública do PostgREST. Idempotente — ENABLE é no-op se já habilitado.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE _migrations ENABLE ROW LEVEL SECURITY;
