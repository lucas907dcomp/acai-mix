-- ============================================================
-- Seed sintético — EPIC-11 (Perfil Owner Multi-Loja)
-- Ambiente: SOMENTE stack local do Supabase CLI (supabase start).
-- NÃO é o seed.sql de produção (esse continua intocado).
-- NUNCA rodar este arquivo contra o projeto de produção.
--
-- Referência: docs/stories/11.0.story.md (T2)
-- Referência: supabase/tests/epic11_rls_smoke.sql (usa os mesmos UUIDs)
--
-- Como rodar (ambiente local, depois de `supabase start`):
--   docker exec -i supabase_db_acai-mix psql -U postgres -d postgres \
--     -f - < supabase/tests/epic11_seed_staging.sql
--
-- Idempotente: todo INSERT usa ON CONFLICT DO NOTHING, então pode ser
-- rodado mais de uma vez sem duplicar dados (útil após `supabase db reset`
-- automático ou reexecução manual).
--
-- Senha de todos os usuários de teste: Test@1234
-- (Decisão de implementação: `supabase` CLI (v2.99.0, ambiente local) não
-- expõe subcomando de auth admin, e a API REST do GoTrue não permite
-- especificar o UUID do usuário na criação — mas o smoke test EXIGE UUIDs
-- fixos. Por isso, os usuários são criados via INSERT direto em
-- auth.users + auth.identities, usando pgcrypto para o hash de senha.
-- Este é o padrão documentado pela comunidade Supabase para seed local
-- quando UUIDs estáveis são necessários; os usuários resultantes são reais
-- e autenticáveis via GoTrue local, e não apenas linhas soltas para
-- satisfazer FK.)
-- ============================================================

\set admin_loja1  '00000000-0000-0000-0000-000000000101'
\set admin_loja2  '00000000-0000-0000-0000-000000000102'
\set owner_user   '00000000-0000-0000-0000-000000000201'
\set staff_loja1  '00000000-0000-0000-0000-000000000301'
\set loja1        'a0000000-0000-0000-0000-000000000001'
\set loja2        'a0000000-0000-0000-0000-000000000002'
\set loja3_fake   'a0000000-0000-0000-0000-000000000003'

-- ------------------------------------------------------------
-- 1. auth.users — 4 usuários de teste (senha: Test@1234)
-- ------------------------------------------------------------

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
)
VALUES
  ('00000000-0000-0000-0000-000000000000', :'admin_loja1', 'authenticated', 'authenticated',
   'admin-loja1@epic11.test', crypt('Test@1234', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', :'admin_loja2', 'authenticated', 'authenticated',
   'admin-loja2@epic11.test', crypt('Test@1234', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', :'owner_user', 'authenticated', 'authenticated',
   'owner@epic11.test', crypt('Test@1234', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', :'staff_loja1', 'authenticated', 'authenticated',
   'staff-loja1@epic11.test', crypt('Test@1234', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. auth.identities — necessário para login via GoTrue (provider email)
-- ------------------------------------------------------------

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'admin_loja1', :'admin_loja1',
   json_build_object('sub', :'admin_loja1', 'email', 'admin-loja1@epic11.test', 'email_verified', true)::jsonb,
   'email', now(), now()),
  (gen_random_uuid(), :'admin_loja2', :'admin_loja2',
   json_build_object('sub', :'admin_loja2', 'email', 'admin-loja2@epic11.test', 'email_verified', true)::jsonb,
   'email', now(), now()),
  (gen_random_uuid(), :'owner_user', :'owner_user',
   json_build_object('sub', :'owner_user', 'email', 'owner@epic11.test', 'email_verified', true)::jsonb,
   'email', now(), now()),
  (gen_random_uuid(), :'staff_loja1', :'staff_loja1',
   json_build_object('sub', :'staff_loja1', 'email', 'staff-loja1@epic11.test', 'email_verified', true)::jsonb,
   'email', now(), now())
ON CONFLICT (provider_id, provider) DO NOTHING;

-- ------------------------------------------------------------
-- 3. locations — loja1 já existe via supabase/seed.sql (produção,
--    reaproveitado aqui pelo mesmo UUID); loja2 e loja3_fake são novas.
--    loja3_fake é propositalmente NÃO vinculada a ninguém (T6/T7/T12).
-- ------------------------------------------------------------

INSERT INTO locations (id, name, address, active)
VALUES
  (:'loja1',      'Loja 1 (teste EPIC-11)', NULL, true),
  (:'loja2',      'Loja 2 (teste EPIC-11)', NULL, true),
  (:'loja3_fake', 'Loja 3 fictícia — NÃO vinculada (teste EPIC-11)', NULL, true)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 4. user_profiles — 2 admin, 1 owner, 1 staff
-- ------------------------------------------------------------

INSERT INTO user_profiles (id, location_id, role, display_name)
VALUES
  (:'admin_loja1', :'loja1', 'admin', 'Admin Loja 1 (teste)'),
  (:'admin_loja2', :'loja2', 'admin', 'Admin Loja 2 (teste)'),
  (:'owner_user',  :'loja1', 'owner', 'Owner (teste)'),
  (:'staff_loja1', :'loja1', 'staff', 'Staff Loja 1 (teste)')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 5. user_locations — owner vinculado a loja1 e loja2 (NÃO a loja3_fake)
-- ------------------------------------------------------------

INSERT INTO user_locations (user_id, location_id)
VALUES
  (:'owner_user', :'loja1'),
  (:'owner_user', :'loja2')
ON CONFLICT (user_id, location_id) DO NOTHING;

-- ------------------------------------------------------------
-- 6. Auto-checagem — confere se os UUIDs esperados pelo smoke test existem
-- ------------------------------------------------------------

\echo '--- Verificação: contagem esperada por tabela ---'
SELECT 'auth.users'      AS tabela, count(*) AS total FROM auth.users
  WHERE id IN (:'admin_loja1', :'admin_loja2', :'owner_user', :'staff_loja1')
UNION ALL
SELECT 'locations',        count(*) FROM locations
  WHERE id IN (:'loja1', :'loja2', :'loja3_fake')
UNION ALL
SELECT 'user_profiles',    count(*) FROM user_profiles
  WHERE id IN (:'admin_loja1', :'admin_loja2', :'owner_user', :'staff_loja1')
UNION ALL
SELECT 'user_locations',   count(*) FROM user_locations
  WHERE user_id = :'owner_user';
-- Esperado: auth.users=4, locations=3, user_profiles=4, user_locations=2
