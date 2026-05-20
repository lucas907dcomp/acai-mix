-- Seed: initial data for AçaiMix
-- Run after migration 001_base_schema

-- Initial location
INSERT INTO locations (id, name, address, active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Loja Principal',
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Initial product: Açaí (R$65/kg = R$0.065/g)
INSERT INTO products (location_id, name, price_per_gram, active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Açaí',
  0.0650,
  true
)
ON CONFLICT DO NOTHING;

-- NOTE: Create the first admin user via Supabase Dashboard:
-- 1. Authentication > Users > Invite user (enter email)
-- 2. After user accepts invite, insert into user_profiles:
--    INSERT INTO user_profiles (id, location_id, role, display_name)
--    VALUES ('<user-uuid-from-auth>', 'a0000000-0000-0000-0000-000000000001', 'admin', 'Admin');
