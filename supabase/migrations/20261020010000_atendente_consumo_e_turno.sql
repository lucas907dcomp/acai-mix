-- Atendente (staff) do Ponto Mix: só PDV e consumo de funcionário.
--
-- Até aqui toda loja usava login admin, então staff nunca precisou de nada
-- além de vender. Agora staff precisa:
--   1. ver a lista de funcionários e registrar consumo da PRÓPRIA loja
--      (não cadastra funcionário nem apaga consumo: isso fica com o admin);
--   2. encerrar o turno da própria loja. UPDATE direto em shifts deixaria
--      staff mexer nos totais, então o encerramento vira uma função que só
--      muda status/closed_at/closed_by.

BEGIN;

CREATE POLICY "employees_select_own_location" ON employees FOR SELECT TO authenticated
  USING (location_id = get_my_location_id());

CREATE POLICY "ec_select_own_location" ON employee_consumptions FOR SELECT TO authenticated
  USING (location_id = get_my_location_id());

CREATE POLICY "ec_insert_own_location" ON employee_consumptions FOR INSERT TO authenticated
  WITH CHECK (location_id = get_my_location_id() AND created_by = auth.uid());

CREATE OR REPLACE FUNCTION close_my_shift(p_shift_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE shifts
     SET status = 'closed', closed_at = now(), closed_by = auth.uid()::text
   WHERE id = p_shift_id
     AND status = 'open'
     AND location_id = get_my_location_id();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno não encontrado ou já encerrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION close_my_shift(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION close_my_shift(UUID) TO authenticated;

COMMIT;
