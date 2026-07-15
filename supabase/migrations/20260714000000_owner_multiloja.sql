-- ============================================================
-- Migration: 014 owner_multiloja (EPIC-11)
-- Tables: user_locations (nova)
-- Alters: user_profiles (role CHECK ampliado para incluir 'owner')
-- Functions: is_owner(), is_owner_of_location(), switch_active_location(),
--            fn_guard_user_profiles_update()
-- RLS: 2 policies ADITIVAS em shifts/sales (owner); 3 policies SUBSTITUÍDAS
--      (locations SELECT, products SELECT — DA-5; locations UPDATE — achado
--      adicional do @data-engineer, mesma classe de problema do DA-5)
--
-- Referência: docs/architecture/epic11-owner-multiloja-tech-decisions.md
-- Referência: docs/stories/EPIC-11-perfil-dono-multi-loja.md
--
-- Design constraints honored (restrição não-negociável do usuário):
--   - ZERO impacto nos 2 admins reais em produção — ver seção "AUTO-CHECAGEM"
--     ao final deste arquivo, policy por policy e coluna por coluna.
--   - ZERO downtime: toda alteração é ADD (tabela, coluna, policy, função,
--     trigger), exceto as 2 substituições de policy do passo 7, que
--     preservam o comportamento observável de quem já é admin
--     (is_admin() mantido, sem escopo — decisão DA-2).
--   - Reversível: ver ROLLBACK comentado ao final.
--   - Confirmado por grep em todo `src/`: o front NUNCA faz UPDATE/INSERT
--     em `user_profiles` hoje — só leitura, em `useAuth.ts` e
--     `AuthProvider.tsx`. O trigger do passo 5 não aciona em nenhum fluxo
--     existente.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Tabela user_locations (vínculo N:N usuário↔loja)
-- ------------------------------------------------------------

CREATE TABLE user_locations (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID        NOT NULL REFERENCES locations(id)   ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, location_id)
);

-- Discriminador de loja primeiro em ambos os índices, conforme restrição
-- do epic ("nenhuma query nova sem índice iniciando pelo location_id" —
-- idx_user_locations_location cobre isso; idx_user_locations_user cobre
-- o padrão inverso, usado por is_owner_of_location() e pelo seletor de
-- loja do front, que busca "todas as lojas do usuário logado").
CREATE INDEX idx_user_locations_user     ON user_locations (user_id, location_id);
CREATE INDEX idx_user_locations_location ON user_locations (location_id, user_id);

ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- Owner só enxerga os próprios vínculos. Sem policy de INSERT/UPDATE/DELETE
-- para `authenticated` nesta fase — gestão de vínculo é só via seed/service
-- role (Story 11.5). Uma tela de gestão de vínculos (admin vinculando
-- lojas a um owner) fica para epic futuro, fora de escopo do EPIC-11.
CREATE POLICY "user_locations_select_own"
  ON user_locations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- 2. user_profiles.role — amplia CHECK para incluir 'owner'
-- ------------------------------------------------------------
-- Nome da constraint NÃO é assumido: localizado dinamicamente via
-- information_schema para não quebrar a migration caso o nome real
-- divirja do padrão de geração automática do Postgres
-- (`user_profiles_role_check`). Hoje existe exatamente 1 CHECK constraint
-- na coluna `role` (CHECK inline declarado em
-- 20260520105118_base_schema.sql, linha 23 — sem NOT NULL contabilizado
-- aqui, pois NOT NULL não aparece como CHECK constraint nomeado).

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT tc.constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
   AND tc.table_schema    = ccu.table_schema
  WHERE tc.table_schema     = 'public'
    AND tc.table_name       = 'user_profiles'
    AND tc.constraint_type  = 'CHECK'
    AND ccu.column_name     = 'role';

  IF v_constraint_name IS NULL THEN
    RAISE EXCEPTION
      'Nenhum CHECK constraint encontrado em user_profiles.role — abortando para evitar CHECK duplicado ou órfão. Verifique manualmente antes de reexecutar esta migration.';
  END IF;

  EXECUTE format('ALTER TABLE user_profiles DROP CONSTRAINT %I', v_constraint_name);
END $$;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'staff', 'owner'));

-- Aditivo: os 2 admins e o modelo `staff` (não usado hoje) continuam
-- válidos sem qualquer UPDATE de linha — ALTER ... DROP/ADD CONSTRAINT
-- é metadado puro quando os dados já satisfazem a nova regra.

-- ------------------------------------------------------------
-- 3. Funções SECURITY DEFINER (padrão já validado no projeto:
--    is_admin(), get_my_location_id(), fn_is_admin_of_location())
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_owner() RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION is_owner_of_location(loc_id UUID) RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN user_locations ul ON ul.user_id = up.id
    WHERE up.id = auth.uid() AND up.role = 'owner' AND ul.location_id = loc_id
  );
$$;

-- ------------------------------------------------------------
-- 4. RPC guardado: troca de loja ativa (owner)
-- ------------------------------------------------------------
-- Único caminho permitido para alterar user_profiles.location_id de um
-- owner. Valida vínculo ANTES do UPDATE (RAISE aborta a transação sem
-- tocar em nada caso a loja não esteja vinculada). Usa um GUC de sessão
-- ('app.allow_location_switch') como escape hatch que o trigger de
-- guarda (passo 5) exige para permitir a troca — nenhum outro caminho
-- neste epic seta esse GUC.

CREATE OR REPLACE FUNCTION switch_active_location(p_location_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_owner_of_location(p_location_id) THEN
    RAISE EXCEPTION 'location % not linked to current owner', p_location_id
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.allow_location_switch', 'true', true);
  UPDATE user_profiles SET location_id = p_location_id WHERE id = auth.uid();
END;
$$;

-- ------------------------------------------------------------
-- 5. Trigger de guarda em user_profiles
-- ------------------------------------------------------------
-- Impede, incondicionalmente e sem exceção, que qualquer UPDATE mude
-- `role` (fecha a vulnerabilidade de auto-elevação encontrada durante o
-- diagnóstico do @analyst: `user_profiles_update_own` não restringe
-- coluna nenhuma). Impede que `location_id` mude fora do caminho da RPC
-- do passo 4, identificado pelo GUC de sessão setado só ali dentro.

CREATE OR REPLACE FUNCTION fn_guard_user_profiles_update() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role change not allowed via direct update; role is immutable by the user'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.location_id IS DISTINCT FROM OLD.location_id
     AND coalesce(current_setting('app.allow_location_switch', true), 'false') <> 'true'
  THEN
    RAISE EXCEPTION 'location_id change requires switch_active_location()'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_profiles_update ON user_profiles;
CREATE TRIGGER trg_guard_user_profiles_update
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_guard_user_profiles_update();

-- ------------------------------------------------------------
-- 6. RLS aditiva: owner lê shifts/sales das lojas vinculadas
-- ------------------------------------------------------------
-- ADITIVA: policies novas, somadas via OR às policies existentes
-- (shifts_select, sales_select), que permanecem intocadas — sem DROP,
-- sem CREATE OR REPLACE de policy existente. Owner NÃO precisa de policy
-- de escrita: ao trocar de loja ativa (passo 4), get_my_location_id()
-- passa a retornar a loja escolhida, e as policies de INSERT existentes
-- (shifts_insert, sales_insert — location_id = get_my_location_id())
-- já autorizam a escrita automaticamente, sem alteração.

CREATE POLICY "shifts_select_owner"
  ON shifts FOR SELECT
  TO authenticated
  USING (is_owner_of_location(location_id));

CREATE POLICY "sales_select_owner"
  ON sales FOR SELECT
  TO authenticated
  USING (is_owner_of_location(location_id));

-- ------------------------------------------------------------
-- 7. RLS: fechamento das brechas herdadas (DA-5) — locations/products
-- ------------------------------------------------------------
-- ÚNICA mudança não-aditiva desta migration. Substitui SELECT
-- USING (true) por uma policy que preserva EXATAMENTE o acesso de quem
-- já é admin (is_admin() mantido, sem escopo de loja — decisão DA-2),
-- soma o owner, e só restringe quem hoje não deveria ter acesso nenhum.
-- Nenhum usuário real cai nesse caso hoje: não há `staff` em uso em
-- produção, e os 2 admins reais continuam cobertos por `is_admin()`.
--
-- NOTA (DEBT-EPIC11-01, ver seção 3.4 do doc de arquitetura): esta
-- mudança NÃO é replicada para shifts/sales — is_admin() ali continua
-- com bypass global, por decisão consciente de não mexer em policy viva
-- dos 2 admins reais neste epic.

DROP POLICY "locations_select_authenticated" ON locations;
CREATE POLICY "locations_select_own_or_privileged"
  ON locations FOR SELECT
  TO authenticated
  USING (
    id = get_my_location_id()
    OR is_admin()
    OR is_owner_of_location(id)
  );

DROP POLICY "products_select_authenticated" ON products;
CREATE POLICY "products_select_own_or_privileged"
  ON products FOR SELECT
  TO authenticated
  USING (
    location_id = get_my_location_id()
    OR is_admin()
    OR is_owner_of_location(location_id)
  );

-- ------------------------------------------------------------
-- 7b. RLS: fechamento adicional — locations_update_admin (achado durante
--     inventário do @data-engineer, mesma classe de problema do DA-5)
-- ------------------------------------------------------------
-- `locations_update_admin` (base_schema, migration 001) permite que
-- QUALQUER admin dê UPDATE em QUALQUER location, sem checar location —
-- o mesmo problema de escopo que as 2 SELECT policies acima tinham,
-- só que do lado da escrita. Nunca foi coberto pela migration 010
-- (que só apertou `products`). Corrigido aqui reaproveitando
-- `fn_is_admin_of_location()` (já existente, migration 010) — mesmo
-- padrão já usado e validado, sem função nova.
--
-- Owner também ganha permissão de UPDATE, mas só na loja ATIVA no
-- momento (id = get_my_location_id()), não em qualquer loja vinculada —
-- consistente com o modelo "owner opera como admin dentro da loja em
-- que está no momento" (seção 2.4 do doc de arquitetura).
--
-- Impacto real para os 2 admins reais: NENHUM — cada um só atualiza a
-- própria loja hoje (`AdminSettings.tsx` via `useLocationData()`, que já
-- filtra pela própria location_id). O único comportamento que deixa de
-- existir é um admin conseguir editar a loja DO OUTRO via API forjada —
-- que nunca foi usado, mas era possível.

DROP POLICY "locations_update_admin" ON locations;
CREATE POLICY "locations_update_admin_or_owner"
  ON locations FOR UPDATE
  TO authenticated
  USING (
    fn_is_admin_of_location(id)
    OR (is_owner_of_location(id) AND id = get_my_location_id())
  )
  WITH CHECK (
    fn_is_admin_of_location(id)
    OR (is_owner_of_location(id) AND id = get_my_location_id())
  );

COMMIT;

-- ============================================================
-- AUTO-CHECAGEM — o que muda para um usuário com role = 'admin'
-- (exigida pela restrição não-negociável de zero impacto em produção)
-- ============================================================
-- user_locations (tabela nova):        Admin nunca lê/escreve. RLS própria
--                                       não referencia admin em lugar
--                                       nenhum (só user_id = auth.uid()).
-- user_profiles.role (CHECK ampliado): Valores existentes ('admin',
--                                       'staff') continuam válidos, sem
--                                       reescrita de linha — ALTER
--                                       DROP/ADD CONSTRAINT é só metadado.
-- user_profiles (trigger de guarda):   Só dispara em UPDATE. Confirmado
--                                       via grep em `src/`: admin nunca
--                                       sofre UPDATE nesta tabela hoje.
-- is_owner() / is_owner_of_location(): Retornam FALSE para admin sempre
--                                       (checam role = 'owner') — não
--                                       alteram nenhum comportamento dele.
-- switch_active_location():            Admin nunca chama esta RPC — só é
--                                       exposta pelo seletor de loja no
--                                       front, visível apenas para owner.
-- shifts_select_owner / sales_select_owner:
--                                       Policies ADITIVAS somadas via OR.
--                                       shifts_select/sales_select
--                                       originais continuam ativas e
--                                       inalteradas; admin já satisfaz a
--                                       policy original (location_id =
--                                       get_my_location_id() OR
--                                       is_admin()) — a policy nova nunca
--                                       precisa ser avaliada para ele.
-- locations_select_own_or_privileged / products_select_own_or_privileged:
--                                       Admin satisfaz sempre via
--                                       is_admin(), preservado idêntico à
--                                       policy antiga — leitura de TODAS
--                                       as lojas/produtos continua
--                                       exatamente como hoje.
-- locations_update_admin_or_owner:     ÚNICA mudança com comportamento
--                                       observável em teoria: admin deixa
--                                       de poder dar UPDATE em location
--                                       de OUTRA loja via API forjada
--                                       (fn_is_admin_of_location(id) exige
--                                       ser admin DAQUELA loja). Para os 2
--                                       admins reais, impacto é ZERO:
--                                       cada um só atualiza a própria loja
--                                       hoje (AdminSettings.tsx via
--                                       useLocationData(), já filtrado por
--                                       location_id) — nenhum fluxo real
--                                       tenta editar a loja alheia.
--
-- CONCLUSÃO: nenhuma mudança de comportamento OBSERVÁVEL para role =
-- 'admin' nos fluxos reais de produção, exceto a existência de uma
-- tabela nova que ele nunca toca. A única mudança teórica (locations
-- UPDATE cross-loja) fecha uma porta que nunca foi usada pelos 2 admins
-- reais, mas que era tecnicamente explorável via API direta.
-- ============================================================

-- ============================================================
-- ROLLBACK (manual — executar em uma transação separada)
-- ============================================================
-- BEGIN;
--   DROP POLICY IF EXISTS "locations_update_admin_or_owner" ON locations;
--   CREATE POLICY "locations_update_admin"
--     ON locations FOR UPDATE TO authenticated
--     USING (EXISTS (
--       SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
--
--   DROP POLICY IF EXISTS "products_select_own_or_privileged" ON products;
--   CREATE POLICY "products_select_authenticated"
--     ON products FOR SELECT TO authenticated USING (true);
--
--   DROP POLICY IF EXISTS "locations_select_own_or_privileged" ON locations;
--   CREATE POLICY "locations_select_authenticated"
--     ON locations FOR SELECT TO authenticated USING (true);
--
--   DROP POLICY IF EXISTS "sales_select_owner"  ON sales;
--   DROP POLICY IF EXISTS "shifts_select_owner" ON shifts;
--
--   DROP TRIGGER  IF EXISTS trg_guard_user_profiles_update ON user_profiles;
--   DROP FUNCTION IF EXISTS fn_guard_user_profiles_update();
--   DROP FUNCTION IF EXISTS switch_active_location(UUID);
--   DROP FUNCTION IF EXISTS is_owner_of_location(UUID);
--   DROP FUNCTION IF EXISTS is_owner();
--
--   -- NOTA: rollback do CHECK falha se alguma linha já tiver
--   -- role='owner' criada após esta migration (ex.: seed da Story 11.5
--   -- já executado). Nesse caso, remover/realocar essas linhas ANTES de
--   -- rodar o rollback do CHECK abaixo.
--   ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
--   ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
--     CHECK (role IN ('admin', 'staff'));
--
--   DROP INDEX IF EXISTS idx_user_locations_location;
--   DROP INDEX IF EXISTS idx_user_locations_user;
--   DROP TABLE IF EXISTS user_locations;
-- COMMIT;
