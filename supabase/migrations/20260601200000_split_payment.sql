-- ============================================================
-- Migration: split_payment
-- Adiciona suporte a pagamento dividido entre dois meios
-- ============================================================

ALTER TABLE sales ADD COLUMN payment_split JSONB;

-- ─── INSERT trigger ───────────────────────────────────────────────────────────
-- Quando payment_split está preenchido, distribui os valores pelos buckets
-- corretos em vez de usar payment_method para tudo.

CREATE OR REPLACE FUNCTION update_shift_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_split IS NOT NULL THEN
    UPDATE shifts SET
      sale_count  = sale_count + 1,
      total_sales = total_sales + NEW.amount,
      total_pix   = total_pix   + COALESCE(
        (SELECT SUM((e->>'amount')::numeric)
         FROM jsonb_array_elements(NEW.payment_split) e
         WHERE e->>'method' = 'pix'), 0),
      total_card  = total_card  + COALESCE(
        (SELECT SUM((e->>'amount')::numeric)
         FROM jsonb_array_elements(NEW.payment_split) e
         WHERE e->>'method' = ANY(ARRAY['credit','debit'])), 0),
      total_cash  = total_cash  + COALESCE(
        (SELECT SUM((e->>'amount')::numeric)
         FROM jsonb_array_elements(NEW.payment_split) e
         WHERE e->>'method' = 'cash'), 0)
    WHERE id = NEW.shift_id;
  ELSE
    UPDATE shifts SET
      sale_count  = sale_count + 1,
      total_sales = total_sales + NEW.amount,
      total_pix   = total_pix   + CASE WHEN NEW.payment_method = 'pix'                THEN NEW.amount ELSE 0 END,
      total_card  = total_card  + CASE WHEN NEW.payment_method IN ('credit', 'debit') THEN NEW.amount ELSE 0 END,
      total_cash  = total_cash  + CASE WHEN NEW.payment_method = 'cash'               THEN NEW.amount ELSE 0 END
    WHERE id = NEW.shift_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── UPDATE trigger (cancelamento) ───────────────────────────────────────────
-- Reverte os totais corretos ao cancelar uma venda com split.

CREATE OR REPLACE FUNCTION update_shift_totals_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'COMPLETED' AND NEW.status = 'CANCELLED' THEN
    IF OLD.payment_split IS NOT NULL THEN
      UPDATE shifts SET
        sale_count  = GREATEST(sale_count  - 1, 0),
        total_sales = GREATEST(total_sales - OLD.amount, 0),
        total_pix   = GREATEST(total_pix   - COALESCE(
          (SELECT SUM((e->>'amount')::numeric)
           FROM jsonb_array_elements(OLD.payment_split) e
           WHERE e->>'method' = 'pix'), 0), 0),
        total_card  = GREATEST(total_card  - COALESCE(
          (SELECT SUM((e->>'amount')::numeric)
           FROM jsonb_array_elements(OLD.payment_split) e
           WHERE e->>'method' = ANY(ARRAY['credit','debit'])), 0), 0),
        total_cash  = GREATEST(total_cash  - COALESCE(
          (SELECT SUM((e->>'amount')::numeric)
           FROM jsonb_array_elements(OLD.payment_split) e
           WHERE e->>'method' = 'cash'), 0), 0)
      WHERE id = OLD.shift_id;
    ELSE
      UPDATE shifts SET
        sale_count  = GREATEST(sale_count  - 1, 0),
        total_sales = GREATEST(total_sales - OLD.amount, 0),
        total_pix   = GREATEST(total_pix
                      - CASE WHEN OLD.payment_method = 'pix'                THEN OLD.amount ELSE 0 END, 0),
        total_card  = GREATEST(total_card
                      - CASE WHEN OLD.payment_method IN ('credit','debit') THEN OLD.amount ELSE 0 END, 0),
        total_cash  = GREATEST(total_cash
                      - CASE WHEN OLD.payment_method = 'cash'              THEN OLD.amount ELSE 0 END, 0)
      WHERE id = OLD.shift_id;
    END IF;
  ELSIF OLD.status = 'CANCELLED' AND NEW.status = 'COMPLETED' THEN
    RAISE EXCEPTION
      'Uncancelling a sale is not supported (sale_id=%, shift_id=%)',
      OLD.id, OLD.shift_id;
  END IF;
  RETURN NEW;
END;
$$;
