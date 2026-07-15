-- ============================================================
-- Smoke test manual — EPIC-11 (Perfil Owner Multi-Loja)
-- NÃO é uma migration. NÃO aplicar em produção.
--
-- Referência: docs/architecture/epic11-owner-multiloja-tech-decisions.md,
-- seção 8.1 (T1-T13).
--
-- Como rodar:
--   1. Em ambiente de STAGING com dump real do banco de produção
--      (nunca rodar contra produção diretamente).
--   2. Preencher as variáveis \set abaixo com UUIDs reais de staging:
--      - :admin_loja1 / :admin_loja2 → os 2 usuários admin já existentes
--        (dump de produção).
--      - :loja1 / :loja2 → os location_id correspondentes.
--      - :owner_user → UUID de um usuário de teste criado em staging com
--        role='owner' e vinculado a loja1+loja2 (via seed da Story 11.5
--        ou INSERT manual em staging, NUNCA em produção).
--      - :loja3_fake → um location_id fictício criado em staging e
--        propositalmente NÃO vinculado ao owner de teste (para T6/T12).
--   3. Rodar via: psql "$STAGING_DB_URL" -f supabase/tests/epic11_rls_smoke.sql
--
-- Cada teste roda em sua própria transação com ROLLBACK ao final — não
-- deixa efeito colateral no banco de staging.
--
-- IMPORTANTE sobre T2: este teste é o único com resultado esperado
-- "vaza" (DEBT-EPIC11-01, aceito conscientemente — ver seção 3.4 do doc
-- de arquitetura). Um resultado "não vazou mais" aqui não é bug a menos —
-- na verdade indicaria que alguém corrigiu is_admin() sem atualizar este
-- script; se isso acontecer, promova T2 para bloqueante e atualize o
-- doc de arquitetura antes de dar baixa nesse item.
-- ============================================================

\set admin_loja1  '00000000-0000-0000-0000-000000000101'
\set admin_loja2  '00000000-0000-0000-0000-000000000102'
\set owner_user   '00000000-0000-0000-0000-000000000201'
\set loja1        'a0000000-0000-0000-0000-000000000001'
\set loja2        'a0000000-0000-0000-0000-000000000002'
\set loja3_fake   'a0000000-0000-0000-0000-000000000003'

-- Helper: simula a sessão autenticada de um usuário específico.
-- auth.uid() no Supabase lê request.jwt.claims->>'sub'.
-- (repetir este bloco de 2 linhas no início de cada teste, trocando o uid)

-- ------------------------------------------------------------
-- T1 — Admin loja 1 lê `locations` — deve ver TODAS (is_admin preservado)
-- ------------------------------------------------------------
\echo '--- T1: admin loja1 SELECT locations (esperado: todas, via is_admin) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'admin_loja1')::text, true);
  SELECT count(*) AS total_locations_visiveis FROM locations;
  -- PASS se total >= 2 (loja1 + loja2, e quaisquer outras cadastradas)
ROLLBACK;

-- ------------------------------------------------------------
-- T2 — Admin loja 1 lê `shifts` da loja 2 — ESPERADO VAZAR (DEBT-EPIC11-01)
-- ------------------------------------------------------------
\echo '--- T2: admin loja1 SELECT shifts da loja2 (esperado: VAZA — aceito, DEBT-EPIC11-01) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'admin_loja1')::text, true);
  SELECT count(*) AS shifts_loja2_visiveis_para_admin_loja1
    FROM shifts WHERE location_id = :'loja2';
  -- "PASS" aqui significa: resultado > 0 é o comportamento ACEITO hoje.
  -- Se este teste passar a retornar 0, DEBT-EPIC11-01 foi resolvida em
  -- algum lugar sem atualizar este script — investigar antes de comemorar.
ROLLBACK;

-- ------------------------------------------------------------
-- T3 — Admin loja 1 abre turno na própria loja — deve funcionar (zero regressão)
-- ------------------------------------------------------------
\echo '--- T3: admin loja1 INSERT shifts na loja1 (esperado: sucesso, sem alteração) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'admin_loja1')::text, true);
  INSERT INTO shifts (location_id, shift_number, opened_by)
  VALUES (:'loja1', 1, 'smoke-test-T3');
  -- PASS se não lançar erro.
ROLLBACK;

-- ------------------------------------------------------------
-- T4 — Admin loja 1 tenta abrir turno na loja 2 — deve falhar (RLS, sem alteração)
-- ------------------------------------------------------------
\echo '--- T4: admin loja1 INSERT shifts na loja2 (esperado: falha por RLS) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'admin_loja1')::text, true);
  INSERT INTO shifts (location_id, shift_number, opened_by)
  VALUES (:'loja2', 1, 'smoke-test-T4');
  -- PASS se lançar erro 42501 (new row violates row-level security policy)
ROLLBACK;

-- ------------------------------------------------------------
-- T5 — Owner lê `shifts` — deve ver só loja1 e loja2 (vinculadas)
-- ------------------------------------------------------------
\echo '--- T5: owner SELECT shifts (esperado: só loja1+loja2) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'owner_user')::text, true);
  SELECT DISTINCT location_id FROM shifts;
  -- PASS se todo location_id retornado for loja1 ou loja2, nunca loja3_fake
  -- nem qualquer outra loja não vinculada.
ROLLBACK;

-- ------------------------------------------------------------
-- T6 — Owner tenta ler `shifts` da loja3 (não vinculada) — deve vir vazio
-- ------------------------------------------------------------
\echo '--- T6: owner SELECT shifts WHERE location_id=loja3_fake (esperado: vazio) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'owner_user')::text, true);
  SELECT count(*) AS deve_ser_zero FROM shifts WHERE location_id = :'loja3_fake';
  -- PASS se count = 0
ROLLBACK;

-- ------------------------------------------------------------
-- T7 — Owner chama switch_active_location para loja NÃO vinculada — deve falhar
-- ------------------------------------------------------------
\echo '--- T7: owner switch_active_location(loja3_fake nao vinculada) (esperado: excecao) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'owner_user')::text, true);
  SELECT switch_active_location(:'loja3_fake'::uuid);
  -- PASS se lançar exceção "location % not linked to current owner"
ROLLBACK;

-- ------------------------------------------------------------
-- T8 — Owner troca para loja2 (vinculada) via RPC, depois abre turno lá — deve funcionar
-- ------------------------------------------------------------
\echo '--- T8: owner switch_active_location(loja2) + INSERT shifts loja2 (esperado: sucesso) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'owner_user')::text, true);
  SELECT switch_active_location(:'loja2'::uuid);
  INSERT INTO shifts (location_id, shift_number, opened_by)
  VALUES (:'loja2', 1, 'smoke-test-T8');
  -- PASS se ambos os passos executarem sem erro.
ROLLBACK;

-- ------------------------------------------------------------
-- T9 — Staff hipotético (loja1) lê `products` da loja2 — deve vir vazio (brecha fechada)
-- ------------------------------------------------------------
\echo '--- T9: staff-hipotetico loja1 SELECT products da loja2 (esperado: vazio, brecha fechada) ---'
-- Requer um usuario de teste role='staff' vinculado a loja1 em staging
-- (nao existe em producao hoje). Ajustar :staff_loja1 antes de rodar.
\set staff_loja1 '00000000-0000-0000-0000-000000000301'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'staff_loja1')::text, true);
  SELECT count(*) AS deve_ser_zero FROM products WHERE location_id = :'loja2';
  -- PASS se count = 0 (antes desta migration, esperado > 0 — era a brecha)
ROLLBACK;

-- ------------------------------------------------------------
-- T10 — Qualquer autenticado tenta se auto-promover a owner — deve falhar
-- ------------------------------------------------------------
\echo '--- T10: admin loja1 UPDATE role para owner (esperado: excecao) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'admin_loja1')::text, true);
  UPDATE user_profiles SET role = 'owner' WHERE id = :'admin_loja1'::uuid;
  -- PASS se lançar excecao (trigger de guarda, sem escape hatch para role)
ROLLBACK;

-- ------------------------------------------------------------
-- T11 — Owner tenta contornar a RPC com UPDATE direto, mesmo para loja vinculada
-- ------------------------------------------------------------
\echo '--- T11: owner UPDATE location_id direto (loja2, vinculada) sem passar pela RPC (esperado: excecao) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'owner_user')::text, true);
  UPDATE user_profiles SET location_id = :'loja2'::uuid WHERE id = :'owner_user'::uuid;
  -- PASS se lançar excecao "location_id change requires switch_active_location()"
  -- Prova que a RPC e obrigatoria mesmo para uma loja legitimamente vinculada.
ROLLBACK;

-- ------------------------------------------------------------
-- T12 — Owner tenta setar location_id de loja NAO vinculada via UPDATE direto
-- ------------------------------------------------------------
\echo '--- T12: owner UPDATE location_id direto (loja3_fake, nao vinculada) (esperado: excecao) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'owner_user')::text, true);
  UPDATE user_profiles SET location_id = :'loja3_fake'::uuid WHERE id = :'owner_user'::uuid;
  -- PASS se lançar excecao (bloqueado pelo trigger, independente da RPC)
ROLLBACK;

-- ------------------------------------------------------------
-- T13 — Owner tenta alterar o proprio role
-- ------------------------------------------------------------
\echo '--- T13: owner UPDATE role para admin (esperado: excecao) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'owner_user')::text, true);
  UPDATE user_profiles SET role = 'admin' WHERE id = :'owner_user'::uuid;
  -- PASS se lançar excecao (trigger bloqueia incondicionalmente, sem
  -- escape hatch para role em lugar nenhum do sistema)
ROLLBACK;

-- ------------------------------------------------------------
-- T14 — Admin loja 1 continua editando a PRÓPRIA loja (zero regressão)
-- ------------------------------------------------------------
\echo '--- T14: admin loja1 UPDATE locations (propria loja1) (esperado: sucesso, sem alteracao) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'admin_loja1')::text, true);
  UPDATE locations SET name = name WHERE id = :'loja1'::uuid;
  -- PASS se não lançar erro. Este é o único fluxo real que os 2 admins
  -- usam hoje (AdminSettings.tsx > LocationCard) — precisa continuar OK.
ROLLBACK;

-- ------------------------------------------------------------
-- T15 — Admin loja 1 tenta editar a loja 2 (achado novo do @data-engineer)
-- ------------------------------------------------------------
\echo '--- T15: admin loja1 UPDATE locations (loja2, alheia) (esperado: excecao — antes desta migration: sucesso) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'admin_loja1')::text, true);
  UPDATE locations SET name = name WHERE id = :'loja2'::uuid;
  -- PASS se lançar erro 42501. Nenhum admin real faz isso hoje — a
  -- mudança de comportamento aqui é intencional (fecha a brecha), não
  -- uma regressão real.
ROLLBACK;

-- ------------------------------------------------------------
-- T16 — Owner com loja2 ativa tenta editar loja1 (vinculada, mas NÃO ativa)
-- ------------------------------------------------------------
\echo '--- T16: owner (ativo em loja2) UPDATE locations (loja1, vinculada mas nao ativa) (esperado: excecao) ---'
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', :'owner_user')::text, true);
  SELECT switch_active_location(:'loja2'::uuid);
  UPDATE locations SET name = name WHERE id = :'loja1'::uuid;
  -- PASS se lançar erro 42501 — owner só pode editar a loja ATIVA no
  -- momento, não qualquer loja vinculada (consistente com "opera como
  -- admin dentro da loja em que está agora").
ROLLBACK;

-- ============================================================
-- Resumo esperado (checklist para @qa preencher em staging):
--   [ ] T1  PASS — admin le todas as locations (is_admin preservado)
--   [ ] T2  PASS = "vaza" (aceito, DEBT-EPIC11-01) — NAO bloqueante
--   [ ] T3  PASS — admin abre turno na propria loja (zero regressao)
--   [ ] T4  PASS — admin bloqueado na loja alheia (zero regressao)
--   [ ] T5  PASS — owner ve so lojas vinculadas
--   [ ] T6  PASS — owner nao ve loja nao vinculada
--   [ ] T7  PASS — RPC recusa loja nao vinculada
--   [ ] T8  PASS — troca de loja + escrita funcionam
--   [ ] T9  PASS — staff hipotetico nao ve produto de outra loja (brecha fechada)
--   [ ] T10 PASS — auto-elevacao de role bloqueada
--   [ ] T11 PASS — UPDATE direto bloqueado mesmo para loja vinculada
--   [ ] T12 PASS — UPDATE direto bloqueado para loja nao vinculada
--   [ ] T13 PASS — owner nao altera o proprio role
--   [ ] T14 PASS — admin continua editando a propria loja (zero regressao)
--   [ ] T15 PASS — admin bloqueado ao editar loja alheia (achado novo, fechado)
--   [ ] T16 PASS — owner bloqueado ao editar loja vinculada mas nao ativa
--
-- T1, T3, T4, T14 sao os testes de "zero regressao" dos 2 admins reais —
-- rodar tambem com os UUIDs REAIS de producao (só em staging, com dump
-- real) antes de qualquer story que toque RLS/schema ser considerada
-- Done, conforme secao 4.2 do epic.
-- ============================================================
