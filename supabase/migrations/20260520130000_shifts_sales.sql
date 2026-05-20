-- ============================================================
-- Migration: 003 shifts_sales
-- Tables: shifts, sales
-- RLS: enabled on both tables
-- ============================================================

-- ------------------------------------------------------------
-- 0. Helper: get current user's location_id (SECURITY DEFINER)
-- Avoids recursive RLS lookups
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_my_location_id() RETURNS UUID
LANGUAGE SQL SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT location_id FROM user_profiles WHERE id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 1. Create tables
-- ------------------------------------------------------------

CREATE TABLE shifts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID        NOT NULL REFERENCES locations(id),
  shift_number  SMALLINT    NOT NULL CHECK (shift_number IN (1, 2)),
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_by     TEXT        NOT NULL,
  closed_at     TIMESTAMPTZ,
  closed_by     TEXT,
  status        TEXT        NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  total_sales   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_pix     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_card    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_cash    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sale_count    INTEGER     NOT NULL DEFAULT 0
);

CREATE TABLE sales (
  id              UUID        PRIMARY KEY,
  shift_id        UUID        NOT NULL REFERENCES shifts(id),
  location_id     UUID        NOT NULL REFERENCES locations(id),
  weight_grams    NUMERIC(8, 3),
  weight_source   TEXT        NOT NULL CHECK (weight_source IN ('scale', 'manual')),
  price_per_gram  NUMERIC(10, 4) NOT NULL,
  amount          NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  payment_method  TEXT        NOT NULL CHECK (payment_method IN ('pix', 'card', 'cash')),
  amount_received NUMERIC(10, 2),
  change_returned NUMERIC(10, 2),
  sync_reconciled BOOLEAN     NOT NULL DEFAULT false,
  synced_at       TIMESTAMPTZ,
  created_offline BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. Indexes
-- ------------------------------------------------------------

CREATE INDEX idx_shifts_location_status ON shifts (location_id, status);
CREATE INDEX idx_sales_shift_created    ON sales (shift_id, created_at DESC);
CREATE INDEX idx_sales_location_created ON sales (location_id, created_at DESC);

-- ------------------------------------------------------------
-- 3. Enable RLS
-- ------------------------------------------------------------

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales  ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 4. RLS policies — shifts
-- ------------------------------------------------------------

-- Everyone sees their own location's shifts; admins see all
CREATE POLICY "shifts_select"
  ON shifts FOR SELECT
  TO authenticated
  USING (location_id = get_my_location_id() OR is_admin());

-- Staff opens shift for their own location
CREATE POLICY "shifts_insert"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (location_id = get_my_location_id());

-- Admin can manually update shifts (close); service role handles auto-close
CREATE POLICY "shifts_update_admin"
  ON shifts FOR UPDATE
  TO authenticated
  USING (is_admin());

-- ------------------------------------------------------------
-- 5. RLS policies — sales
-- ------------------------------------------------------------

-- Staff sees own location's sales; admins see all
CREATE POLICY "sales_select"
  ON sales FOR SELECT
  TO authenticated
  USING (location_id = get_my_location_id() OR is_admin());

-- Any authenticated user inserts sales for their own location
CREATE POLICY "sales_insert"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (location_id = get_my_location_id());
