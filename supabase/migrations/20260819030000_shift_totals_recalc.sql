-- Totais do turno: recalcular em vez de incrementar.
--
-- O trigger anterior só existia em INSERT e somava (total_sales + NEW.amount).
-- Isso deixava dois buracos:
--   • cancelar uma venda não descontava no banco — o front descontava só na
--     tela, e o fechamento do turno recontava a venda cancelada de volta;
--   • editar o valor de uma venda não mexia no total.
--
-- Agora o total é RECALCULADO a partir das vendas do turno, sempre ignorando
-- canceladas, em INSERT, UPDATE e DELETE. Como recalcula do zero, é
-- autocorretivo: qualquer divergência acumulada some na próxima operação.
--
-- Custo: uma agregação por venda registrada. Com dezenas de vendas por turno,
-- é irrelevante — e vale a troca por não depender mais de contabilidade
-- incremental, que já saiu errada duas vezes.

CREATE OR REPLACE FUNCTION recalc_shift_totals_for(p_shift_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE shifts s SET
    sale_count  = t.cnt,
    total_sales = t.total,
    total_pix   = t.pix,
    total_card  = t.card,
    total_cash  = t.cash
  FROM (
    SELECT
      COALESCE(SUM(amount), 0)                                                     AS total,
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'pix'), 0)               AS pix,
      COALESCE(SUM(amount) FILTER (WHERE payment_method IN ('credit','debit')), 0) AS card,
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cash'), 0)              AS cash,
      COUNT(*)                                                                     AS cnt
    FROM sales
    WHERE shift_id = p_shift_id
      AND status <> 'CANCELLED'
  ) t
  WHERE s.id = p_shift_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_shift_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalc_shift_totals_for(OLD.shift_id);
    RETURN OLD;
  END IF;

  PERFORM recalc_shift_totals_for(NEW.shift_id);

  -- Venda movida de turno: o turno de origem também precisa ser refeito.
  IF TG_OP = 'UPDATE' AND OLD.shift_id IS DISTINCT FROM NEW.shift_id THEN
    PERFORM recalc_shift_totals_for(OLD.shift_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_shift_totals ON sales;

CREATE TRIGGER trg_update_shift_totals
AFTER INSERT OR UPDATE OR DELETE ON sales
FOR EACH ROW EXECUTE FUNCTION update_shift_totals();
