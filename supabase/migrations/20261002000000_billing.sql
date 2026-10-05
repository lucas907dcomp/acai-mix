-- Mensalidade do sistema: sem pagamento, o PDV para nas duas lojas.
--
-- Tabela própria, e não coluna em locations, de propósito: owner e admin têm
-- UPDATE em locations e poderiam empurrar a data e se desbloquear. Aqui não
-- existe policy de escrita — só a service role (o webhook da Asaas) grava.
--
-- Linha única (id = 1): as duas lojas são do mesmo cliente e pagam uma conta.
-- paid_until NULL = nunca bloqueia, então criar a tabela não para ninguém.

CREATE TABLE IF NOT EXISTS billing (
  id          INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  paid_until  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO billing (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_select_authenticated"
  ON billing FOR SELECT TO authenticated USING (true);

COMMENT ON COLUMN billing.paid_until IS
  'Fim do período pago (dia 20, 23h59 BRT). O app bloqueia 5 dias depois. NULL = não bloqueia.';
