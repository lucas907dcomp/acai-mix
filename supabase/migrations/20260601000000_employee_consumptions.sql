-- ============================================================
-- Migration: employee_consumptions
-- Registra consumos de funcionárias para desconto em folha
-- ============================================================

CREATE TABLE employee_consumptions (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  location_id  UUID          NOT NULL REFERENCES locations(id),
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  description  TEXT,
  consumed_at  DATE          NOT NULL DEFAULT CURRENT_DATE,
  created_by   UUID          NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE employee_consumptions ENABLE ROW LEVEL SECURITY;

-- Admin vê e gerencia consumos da própria loja
CREATE POLICY "ec_admin_all"
  ON employee_consumptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND location_id = employee_consumptions.location_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND location_id = employee_consumptions.location_id
    )
  );

-- Funcionária vê apenas os próprios registros
CREATE POLICY "ec_staff_select_own"
  ON employee_consumptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
