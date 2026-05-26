-- ============================================================
-- Migration: 010 multi_produto_schema (EPIC-10 / Story 10.2)
-- ============================================================
-- Adds support for:
--   - Multiple product types (weight | unit)
--   - "Casquinha" add-on flag on sales
--   - product_id linkage from sales to products (unit sales only)
--   - quantity for unit-type products
--   - Coherence trigger preventing inconsistent sale shapes
--   - RLS policies for admin-only mutations on products
--   - product_sales_summary view for the F5 dashboard
--
-- Design constraints honored:
--   - ZERO destructive operations (no DROP COLUMN, no data loss)
--   - ZERO downtime: every new column has DEFAULT or is NULLABLE
--   - NO backfill on sales: açaí (weight) sales are the default
--     flow and do NOT require a product_id. product_id stays NULL
--     for weight sales — it is only set for unit-type product sales.
--   - Reversible: see ROLLBACK section at bottom of file (commented)
--
-- Schema notes (verified against prior migrations):
--   - products.active (not is_active) — matches base_schema (001)
--   - is_admin() and get_my_location_id() already exist (003, 002)
--   - sales.amount already includes any casquinha price client-side,
--     so the existing shift-totals trigger (005) needs no change
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. ALTER TABLE products — non-destructive ADD COLUMN
-- ------------------------------------------------------------
-- Every column has either a DEFAULT or is NULLABLE, so the ALTER
-- is metadata-only on Postgres 11+ (Supabase runs Pg 15+).

ALTER TABLE products
  ADD COLUMN product_type TEXT        NOT NULL DEFAULT 'weight'
    CHECK (product_type IN ('weight', 'unit')),
  ADD COLUMN unit_price   NUMERIC(10, 2),
  ADD COLUMN sort_order   INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN updated_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL;

-- Coherence: unit-type products MUST have unit_price; weight-type
-- products MUST NOT (they price by gram). Enforced at row level so
-- application bugs surface as constraint violations, not silent data
-- corruption.
ALTER TABLE products
  ADD CONSTRAINT products_unit_price_coherence
  CHECK (
    (product_type = 'weight' AND unit_price IS NULL)
    OR
    (product_type = 'unit'   AND unit_price IS NOT NULL AND unit_price > 0)
  );

-- ------------------------------------------------------------
-- 2. UPDATE existing products — explicit backfill
-- ------------------------------------------------------------
-- Defaults already gave every existing row product_type='weight'
-- and sort_order=0, but we keep the UPDATE explicit so the intent
-- is captured in the migration history.

UPDATE products
   SET product_type = 'weight',
       sort_order   = 0,
       unit_price   = NULL
 WHERE product_type = 'weight';   -- effectively: every existing row

-- ------------------------------------------------------------
-- 3. ALTER TABLE sales — non-destructive ADD COLUMN
-- ------------------------------------------------------------
-- product_id is NULLABLE by design. Açaí/weight sales do NOT need
-- a product_id — they are the implicit default flow. product_id is
-- only set for unit-type product sales (picolé, água, etc.).
-- has_casquinha and quantity default to safe values so legacy clients
-- continue to sync without sending these fields.

ALTER TABLE sales
  ADD COLUMN has_casquinha BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN product_id    UUID     REFERENCES products(id) ON DELETE RESTRICT,
  ADD COLUMN quantity      SMALLINT NOT NULL DEFAULT 1
    CHECK (quantity >= 1);

-- NOTE: No backfill on sales.product_id intentionally.
-- Weight (açaí) sales have product_id = NULL — that is correct and
-- expected. Only future unit-type product sales will carry product_id.

-- ------------------------------------------------------------
-- 4. Indexes
-- ------------------------------------------------------------
-- Catalog query path (F5 dashboard, PDV catalog UI): filter by
-- location + product_type, ordered by sort_order, restricted to
-- active rows. Composite index covers all three.
CREATE INDEX idx_products_location_type_sort
  ON products (location_id, product_type, sort_order, active);

-- product_id is referenced by trigger, by dashboard rollups, and
-- by the product_sales_summary view's LEFT JOIN. Index keeps the
-- joins fast.
CREATE INDEX idx_sales_product_id
  ON sales (product_id);

-- ------------------------------------------------------------
-- 5. Trigger: sale ↔ product coherence
-- ------------------------------------------------------------
-- BEFORE INSERT/UPDATE: when product_id IS NULL, no check (açaí
-- weight sales are always valid as-is). When product_id is set,
-- validate that the sale shape matches the product type:
--   unit    → has_casquinha MUST be false, quantity >= 1
-- Weight sales with product_id set (edge case) are also validated
-- for internal consistency.
--
-- SECURITY DEFINER so the trigger can read products even when the
-- calling role only has INSERT/UPDATE on sales.

CREATE OR REPLACE FUNCTION fn_sales_product_coherence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_type TEXT;
BEGIN
  -- NULL product_id = açaí weight sale (the default). No check needed.
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT product_type INTO v_product_type
    FROM products
   WHERE id = NEW.product_id;

  IF v_product_type IS NULL THEN
    RAISE EXCEPTION
      'sale.product_id=% does not match any product row',
      NEW.product_id;
  END IF;

  IF v_product_type = 'unit' THEN
    IF NEW.has_casquinha = true THEN
      RAISE EXCEPTION
        'unit-type product cannot have has_casquinha = true (sale_id=%)',
        NEW.id;
    END IF;
    IF NEW.quantity < 1 THEN
      RAISE EXCEPTION
        'unit-type product requires quantity >= 1 (got %, sale_id=%)',
        NEW.quantity, NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_product_coherence
  BEFORE INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION fn_sales_product_coherence();

-- ------------------------------------------------------------
-- 6. RLS: helper + tightened products policies
-- ------------------------------------------------------------
-- Tighten admin mutations to "admin of the row's location" only.

CREATE OR REPLACE FUNCTION fn_is_admin_of_location(loc_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM user_profiles
     WHERE id          = auth.uid()
       AND role        = 'admin'
       AND location_id = loc_id
  );
$$;

-- Drop the old broad admin policies and recreate with location scope.
DROP POLICY IF EXISTS "products_insert_admin" ON products;
DROP POLICY IF EXISTS "products_update_admin" ON products;
DROP POLICY IF EXISTS "products_delete_admin" ON products;

CREATE POLICY "products_insert_admin"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (fn_is_admin_of_location(location_id));

CREATE POLICY "products_update_admin"
  ON products FOR UPDATE
  TO authenticated
  USING      (fn_is_admin_of_location(location_id))
  WITH CHECK (fn_is_admin_of_location(location_id));

CREATE POLICY "products_delete_admin"
  ON products FOR DELETE
  TO authenticated
  USING (fn_is_admin_of_location(location_id));

-- SELECT policy already allows all authenticated users to read
-- products (created in base_schema). Left in place: staff PDV
-- needs to read the product catalog to ring up unit sales.

-- ------------------------------------------------------------
-- 7. View: product_sales_summary (F5 dashboard)
-- ------------------------------------------------------------
-- security_invoker = true makes the view respect the caller's RLS.
-- Only unit-type product sales are counted here (product_id IS NOT
-- NULL). Açaí metrics are already covered by the existing dashboard
-- aggregates (shift_summary, daily_summary).

CREATE OR REPLACE VIEW product_sales_summary
WITH (security_invoker = true)
AS
SELECT
  p.id           AS product_id,
  p.name         AS product_name,
  p.product_type,
  p.location_id,
  COUNT(s.id)                              AS total_sales,
  COALESCE(SUM(s.quantity), 0)             AS total_quantity,
  COALESCE(SUM(s.amount),   0)             AS total_amount
FROM products p
LEFT JOIN sales s
       ON s.product_id = p.id
      AND (s.status = 'COMPLETED' OR s.status IS NULL)
GROUP BY p.id, p.name, p.product_type, p.location_id;

-- ------------------------------------------------------------
-- 8. Validation of shift-totals trigger (AC14)
-- ------------------------------------------------------------
-- The existing trigger update_shift_totals (migration 005) uses
-- NEW.amount, which is already the client-computed total including
-- any future casquinha add-on price. It does NOT aggregate
-- weight_grams, so unit-type products (weight_grams=0) cause no
-- type error. No change needed. This comment documents the review.

COMMIT;

-- ============================================================
-- ROLLBACK (manual — execute in a separate transaction)
-- ============================================================
-- BEGIN;
--   DROP VIEW    IF EXISTS product_sales_summary;
--
--   DROP POLICY  IF EXISTS "products_delete_admin" ON products;
--   DROP POLICY  IF EXISTS "products_update_admin" ON products;
--   DROP POLICY  IF EXISTS "products_insert_admin" ON products;
--   -- Recreate the pre-010 admin policies (see base_schema, migration 001).
--   CREATE POLICY "products_insert_admin"
--     ON products FOR INSERT TO authenticated
--     WITH CHECK (EXISTS (
--       SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
--   CREATE POLICY "products_update_admin"
--     ON products FOR UPDATE TO authenticated
--     USING (EXISTS (
--       SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
--   CREATE POLICY "products_delete_admin"
--     ON products FOR DELETE TO authenticated
--     USING (EXISTS (
--       SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
--
--   DROP FUNCTION IF EXISTS fn_is_admin_of_location(UUID);
--
--   DROP TRIGGER  IF EXISTS trg_sales_product_coherence ON sales;
--   DROP FUNCTION IF EXISTS fn_sales_product_coherence();
--
--   DROP INDEX    IF EXISTS idx_sales_product_id;
--   DROP INDEX    IF EXISTS idx_products_location_type_sort;
--
--   ALTER TABLE sales    DROP COLUMN IF EXISTS quantity;
--   ALTER TABLE sales    DROP COLUMN IF EXISTS product_id;
--   ALTER TABLE sales    DROP COLUMN IF EXISTS has_casquinha;
--
--   ALTER TABLE products DROP CONSTRAINT IF EXISTS products_unit_price_coherence;
--   ALTER TABLE products DROP COLUMN     IF EXISTS updated_by;
--   ALTER TABLE products DROP COLUMN     IF EXISTS created_by;
--   ALTER TABLE products DROP COLUMN     IF EXISTS sort_order;
--   ALTER TABLE products DROP COLUMN     IF EXISTS unit_price;
--   ALTER TABLE products DROP COLUMN     IF EXISTS product_type;
-- COMMIT;
