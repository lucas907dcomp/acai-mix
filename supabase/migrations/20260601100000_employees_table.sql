-- ============================================================
-- Migration: employees
-- Funcionárias da loja sem vínculo com autenticação
-- ============================================================

CREATE TABLE employees (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID        NOT NULL REFERENCES locations(id),
  name        TEXT        NOT NULL,
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_admin_all"
  ON employees FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND location_id = employees.location_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND location_id = employees.location_id
    )
  );

-- Ajustar employee_consumptions: trocar user_id por employee_id
-- A policy ec_staff_select_own depende de user_id, então precisa ser removida antes
DROP POLICY IF EXISTS "ec_staff_select_own" ON employee_consumptions;

ALTER TABLE employee_consumptions
  DROP COLUMN user_id,
  ADD COLUMN employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE;
