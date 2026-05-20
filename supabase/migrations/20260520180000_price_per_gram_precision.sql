-- Aumenta precisão de NUMERIC(10,4) para NUMERIC(10,6)
-- Necessário para preservar preços como 54,99/kg → 0,054990/g sem arredondamento
ALTER TABLE products
  ALTER COLUMN price_per_gram TYPE NUMERIC(10,6);

ALTER TABLE product_price_history
  ALTER COLUMN old_price TYPE NUMERIC(10,6),
  ALTER COLUMN new_price TYPE NUMERIC(10,6);
