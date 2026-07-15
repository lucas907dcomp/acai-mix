-- ============================================================
-- Seed — Owner real vinculado às 2 lojas de produção (EPIC-11, F5)
-- Story 11.5.
--
-- ATENÇÃO: este script é destinado a rodar em PRODUÇÃO, mas SÓ depois de:
--   1. Ter sido testado no ambiente local da Story 11.0 com UUIDs
--      sintéticos (T2 desta story).
--   2. Confirmação explícita do usuário: e-mail do owner + os 2
--      location_id REAIS (nunca assumir os UUIDs de exemplo do
--      seed.sql nem os UUIDs sintéticos de epic11_seed_staging.sql).
--   3. O usuário owner já ter sido criado via Supabase Dashboard
--      (Authentication > Users > Invite user) — auth.users NÃO aceita
--      INSERT direto com senha usável em produção (mesma observação já
--      registrada em supabase/seed.sql).
--
-- Como obter os 2 location_id reais (rodar ANTES de preencher \set abaixo):
--   SELECT id, name FROM locations;
--
-- Como obter o UUID do owner (depois de criar via Dashboard):
--   SELECT id, email FROM auth.users WHERE email = '<email-do-owner>';
--
-- Idempotente: seguro rodar mais de uma vez (ON CONFLICT DO NOTHING em
-- ambos os INSERTs) — não duplica vínculo, não sobrescreve role/location_id
-- de um profile já existente.
-- ============================================================

-- PREENCHER ANTES DE RODAR (nunca deixar os placeholders abaixo):
-- Confirmado pelo usuário em 2026-07-15: marcos@admin.com, já criado
-- via Dashboard, UUID abaixo. AçaiMix / AçaiMix Barra são os 2
-- location_id reais confirmados (SELECT id, name FROM locations).
\set owner_user_id  '4e95e64f-f00b-47b1-a5db-34d80857d0b4'
-- AçaiMix (loja 1):
\set loja1_real     'a0000000-0000-0000-0000-000000000001'
-- AçaiMix Barra (loja 2):
\set loja2_real     '5e4b73af-2ff8-4fdc-87d9-8f0d0ba98f6f'
\set owner_display_name 'Dono'

-- ------------------------------------------------------------
-- 1. user_profiles — vincula o owner a uma loja inicial (loja1_real)
--    ON CONFLICT DO NOTHING: se o profile já existir (reexecução
--    acidental), não sobrescreve role/location_id — evita o mesmo
--    risco que o trigger de guarda da Story 11.1 já bloqueia por
--    UPDATE, aqui aplicado também no INSERT inicial.
-- ------------------------------------------------------------

INSERT INTO user_profiles (id, location_id, role, display_name)
VALUES (:'owner_user_id', :'loja1_real', 'owner', :'owner_display_name')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. user_locations — vínculo N:N às 2 lojas reais
-- ------------------------------------------------------------

INSERT INTO user_locations (user_id, location_id)
VALUES
  (:'owner_user_id', :'loja1_real'),
  (:'owner_user_id', :'loja2_real')
ON CONFLICT (user_id, location_id) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Verificação pós-seed
-- ------------------------------------------------------------

\echo '--- Verificação: owner criado e vinculado ---'
SELECT up.id, up.role, up.location_id AS loja_ativa_inicial
  FROM user_profiles up WHERE up.id = :'owner_user_id';

SELECT ul.location_id, l.name
  FROM user_locations ul
  JOIN locations l ON l.id = ul.location_id
  WHERE ul.user_id = :'owner_user_id';
-- Esperado: 1 linha em user_profiles (role='owner'), 2 linhas em
-- user_locations (loja1_real e loja2_real).
