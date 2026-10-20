-- Loja de um operador só (Ponto Mix): um turno por dia, aberto e fechado pela
-- atendente, com o nome de quem abriu (o dono quer saber se foi a atendente
-- ou a filha). Lojas existentes ficam com single_operator = false: nada muda
-- para o AçaiMix.
--
-- Staff também cadastra e edita produto AVULSO da própria loja (o dono não tem
-- tempo). O preço do açaí (por peso) continua só com o admin.

BEGIN;

ALTER TABLE locations ADD COLUMN single_operator BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE shifts ADD COLUMN operator_name TEXT CHECK (char_length(operator_name) <= 60);

UPDATE locations SET single_operator = true WHERE id = '62b38ff7-dd1a-43ab-8857-6aed83b7f34c';

CREATE POLICY "products_insert_unit_own_location" ON products FOR INSERT TO authenticated
  WITH CHECK (location_id = get_my_location_id() AND product_type = 'unit');

CREATE POLICY "products_update_unit_own_location" ON products FOR UPDATE TO authenticated
  USING (location_id = get_my_location_id() AND product_type = 'unit')
  WITH CHECK (location_id = get_my_location_id() AND product_type = 'unit');

COMMIT;
