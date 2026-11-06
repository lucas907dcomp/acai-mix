-- Estoque / Financeiro (esboço, 06/11/2026): lançar compras de mercadoria e
-- comparar com as vendas do PDV. Só aparece em loja com finance_enabled = true;
-- o default false mantém AçaiMix e Power Mix exatamente como estão.

BEGIN;

ALTER TABLE locations ADD COLUMN finance_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE purchases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category      TEXT NOT NULL CHECK (char_length(category) BETWEEN 1 AND 40),
  item          TEXT NOT NULL CHECK (char_length(item) BETWEEN 1 AND 80),
  quantity      NUMERIC(10,3) CHECK (quantity > 0),
  unit          TEXT CHECK (char_length(unit) <= 10),
  amount        NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  supplier      TEXT CHECK (char_length(supplier) <= 80),
  created_by    UUID DEFAULT auth.uid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX purchases_location_date_idx ON purchases (location_id, purchase_date);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases_admin_own_location" ON purchases FOR ALL TO authenticated
  USING (fn_is_admin_of_location(location_id))
  WITH CHECK (fn_is_admin_of_location(location_id));

COMMIT;
