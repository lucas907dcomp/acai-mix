-- ============================================================
-- Migration: 001 base_schema
-- Tables: locations, user_profiles, products
-- RLS: enabled on all three tables
-- NOTE: all tables created before policies (cross-table refs)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create all tables
-- ------------------------------------------------------------

CREATE TABLE locations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  address     TEXT,
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_profiles (
  id           UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id  UUID  REFERENCES locations(id),
  role         TEXT  NOT NULL CHECK (role IN ('admin', 'staff')),
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID          REFERENCES locations(id),
  name           TEXT          NOT NULL,
  price_per_gram NUMERIC(10,4) NOT NULL CHECK (price_per_gram > 0),
  active         BOOLEAN       NOT NULL DEFAULT true,
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. Enable RLS on all tables
-- ------------------------------------------------------------

ALTER TABLE locations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3. RLS policies — locations
-- ------------------------------------------------------------

CREATE POLICY "locations_select_authenticated"
  ON locations FOR SELECT
  TO authenticated
  USING (true);

-- References user_profiles — must be created after that table exists
CREATE POLICY "locations_update_admin"
  ON locations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ------------------------------------------------------------
-- 4. RLS policies — user_profiles
-- ------------------------------------------------------------

CREATE POLICY "user_profiles_select_own"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "user_profiles_select_admin"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY "user_profiles_update_own"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "user_profiles_insert_admin"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- ------------------------------------------------------------
-- 5. RLS policies — products
-- ------------------------------------------------------------

CREATE POLICY "products_select_authenticated"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "products_insert_admin"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "products_update_admin"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "products_delete_admin"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
