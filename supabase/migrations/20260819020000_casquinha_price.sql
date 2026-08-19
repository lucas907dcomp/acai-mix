-- Preço da casquinha, por loja.
--
-- Nasceu fixo em R$ 1,00 no código (CASQUINHA_PRICE), por decisão de produto,
-- quando havia uma loja só. A AçaiMix Barra cobra R$ 2,00.
--
-- DEFAULT 1.00 preserva o preço praticado até aqui: nenhuma loja existente
-- muda de valor por causa desta migration.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS casquinha_price NUMERIC(10,2) NOT NULL DEFAULT 1.00
  CHECK (casquinha_price > 0);

COMMENT ON COLUMN locations.casquinha_price IS
  'Preço do adicional casquinha nesta loja. Default 1.00 = valor praticado antes da coluna.';
