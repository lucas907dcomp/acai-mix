-- Trigger: atualiza totais do turno a cada venda inserida
-- Garante que shifts.total_sales, total_pix, total_card, total_cash e sale_count
-- estejam sempre atualizados no banco, independente de reload ou polling.

CREATE OR REPLACE FUNCTION update_shift_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shifts SET
    sale_count  = sale_count + 1,
    total_sales = total_sales + NEW.amount,
    total_pix   = total_pix   + CASE WHEN NEW.payment_method = 'pix'                          THEN NEW.amount ELSE 0 END,
    total_card  = total_card  + CASE WHEN NEW.payment_method IN ('credit', 'debit')            THEN NEW.amount ELSE 0 END,
    total_cash  = total_cash  + CASE WHEN NEW.payment_method = 'cash'                          THEN NEW.amount ELSE 0 END
  WHERE id = NEW.shift_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_shift_totals
AFTER INSERT ON sales
FOR EACH ROW EXECUTE FUNCTION update_shift_totals();
