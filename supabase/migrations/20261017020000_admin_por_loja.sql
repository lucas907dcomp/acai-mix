-- Admin enxerga só a própria loja (fecha o DEBT-EPIC11-01).
--
-- is_admin() não olha a loja: com um cliente só era inofensivo, mas o banco
-- vai receber outra açaiteria e o admin de uma leria vendas, turnos, lojas,
-- produtos e usuários da outra. Troca por escopo de loja.
--
-- Quem não muda: o admin de cada loja já só usa a própria (o front filtra por
-- location_id); o owner continua vendo as lojas dele pelas policies *_owner e
-- is_owner_of_location, que não dependem de is_admin().

BEGIN;

DROP POLICY "sales_select" ON sales;
CREATE POLICY "sales_select" ON sales FOR SELECT TO authenticated
  USING (location_id = get_my_location_id());

DROP POLICY "shifts_select" ON shifts;
CREATE POLICY "shifts_select" ON shifts FOR SELECT TO authenticated
  USING (location_id = get_my_location_id());

DROP POLICY "shifts_update_admin" ON shifts;
CREATE POLICY "shifts_update_admin" ON shifts FOR UPDATE TO authenticated
  USING (fn_is_admin_of_location(location_id))
  WITH CHECK (fn_is_admin_of_location(location_id));

DROP POLICY "sales_update_cancel_admin" ON sales;
CREATE POLICY "sales_update_cancel_admin" ON sales FOR UPDATE TO authenticated
  USING (fn_is_admin_of_location(location_id) AND can_cancel_sale(id))
  WITH CHECK (
    fn_is_admin_of_location(location_id)
    AND status        = 'CANCELLED'
    AND cancelled_at IS NOT NULL
    AND cancelled_by  = auth.uid()
  );

DROP POLICY "locations_select_own_or_privileged" ON locations;
CREATE POLICY "locations_select_own_or_privileged" ON locations FOR SELECT TO authenticated
  USING (id = get_my_location_id() OR is_owner_of_location(id));

DROP POLICY "products_select_own_or_privileged" ON products;
CREATE POLICY "products_select_own_or_privileged" ON products FOR SELECT TO authenticated
  USING (location_id = get_my_location_id() OR is_owner_of_location(location_id));

DROP POLICY "user_profiles_select_admin" ON user_profiles;
CREATE POLICY "user_profiles_select_admin" ON user_profiles FOR SELECT TO authenticated
  USING (is_admin() AND location_id = get_my_location_id());

DROP POLICY "user_profiles_insert_admin" ON user_profiles;
CREATE POLICY "user_profiles_insert_admin" ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (fn_is_admin_of_location(location_id));

COMMIT;
