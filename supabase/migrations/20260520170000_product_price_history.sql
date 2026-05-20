-- product_price_history: audit trail for price changes
CREATE TABLE IF NOT EXISTS product_price_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price    NUMERIC(10,4) NOT NULL,
  new_price    NUMERIC(10,4) NOT NULL,
  changed_by   UUID REFERENCES auth.users(id),
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: admin can view history for their location's products
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin can view own location price history"
  ON product_price_history FOR SELECT
  USING (
    product_id IN (
      SELECT id FROM products
      WHERE location_id IN (
        SELECT location_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- Trigger: auto-record every price change
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price_per_gram IS DISTINCT FROM NEW.price_per_gram THEN
    INSERT INTO product_price_history (product_id, old_price, new_price, changed_by)
    VALUES (NEW.id, OLD.price_per_gram, NEW.price_per_gram, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS price_change_trigger ON products;
CREATE TRIGGER price_change_trigger
  AFTER UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION record_price_change();

-- Performance index
CREATE INDEX IF NOT EXISTS idx_price_history_product ON product_price_history (product_id, changed_at DESC);
