-- Fix: infinite recursion in user_profiles SELECT policy
-- The original policy queried user_profiles from within a user_profiles policy,
-- causing PostgreSQL to detect infinite recursion and fail all SELECT queries.
-- Solution: SECURITY DEFINER function runs without RLS, breaking the cycle.

DROP POLICY IF EXISTS "user_profiles_select_admin" ON user_profiles;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE POLICY "user_profiles_select_admin"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_admin());
