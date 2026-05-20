# AçaíPro — Fase 2: Decisões Técnicas (Architecture)

**Documento:** Decisões técnicas para EPIC-09 (Fase 2)
**Autor:** Aria (@architect)
**Data:** 2026-05-20
**Status:** APROVADO para sharding em stories
**Predecessor:** `docs/stories/EPIC-09-fase2.md`
**Inputs analisados:** migrations 001-008, `saleStore`, `shiftStore`, `syncStore`, `DexieDatabase`, `ShiftSalesTable`, `PaymentBreakdown`, `types/index.ts`, `types/supabase.ts`

---

## Sumário Executivo

Esta nota técnica resolve as 3 decisões em aberto (DA-1, DA-2, DA-3) do EPIC-09. Em uma linha:

> **DA-1:** Adicionar 3 colunas a `sales` (`status`, `cancelled_at`, `cancelled_by`), atualizar views para filtrar `status='COMPLETED'`, adicionar trigger AFTER UPDATE que decrementa totais, e usar função SECURITY DEFINER `can_cancel_sale(sale_id)` para RLS de UPDATE.
> **DA-2:** **Opção A confirmada** — venda offline ainda em `pending_sales` é removida do Dexie ao cancelar (nunca chega ao Supabase). Adicionar guarda contra race com drain em curso.
> **DA-3:** Manter `updateTotals` atual + adicionar `reverseTotals(amount, paymentMethod)` separada. Não sobrecarregar a função existente com `sign: 1 | -1`.

**Migrações novas:** 1 SQL file (`20260521000000_sale_cancellation.sql`), aproximadamente 90 linhas. Reversível.

---

## 1. Estado Atual do Schema (baseline)

Antes de propor mudanças, mapeio o que existe hoje (Map-Before-Modify):

### 1.1. Tabela `sales` (estado atual)

```
sales (
  id              UUID PK
  shift_id        UUID NOT NULL → shifts(id)
  location_id     UUID NOT NULL → locations(id)
  weight_grams    NUMERIC(8,3)
  weight_source   TEXT CHECK IN ('scale', 'manual')
  price_per_gram  NUMERIC(10,6)
  amount          NUMERIC(10,2) CHECK > 0
  payment_method  TEXT CHECK IN ('pix', 'credit', 'debit', 'cash')
  amount_received NUMERIC(10,2)
  change_returned NUMERIC(10,2)
  sync_reconciled BOOLEAN
  synced_at       TIMESTAMPTZ
  created_offline BOOLEAN
  created_at      TIMESTAMPTZ
)
```

**Não existe** `status` em `sales`. Confirmado lendo `types/supabase.ts:136-208`. A coluna `status` só existe em `shifts`. → **DA-2 resolvida: precisa migration.**

### 1.2. Trigger `update_shift_totals`

Hoje (migration 005, linha 1-21): trigger AFTER INSERT que **incrementa** `shifts.total_sales`, `total_pix`, `total_card`, `total_cash`, `sale_count` baseado em `NEW.amount` e `NEW.payment_method`. **Não há AFTER UPDATE**.

→ Implicação: se cancelarmos uma venda via UPDATE de `status`, os totais ficam errados. Precisamos estender o trigger.

### 1.3. Views `shift_summary` e `daily_summary`

Migration 006, linhas 4-46: agregam `sales` via `LEFT JOIN` sem nenhum filtro de status (porque a coluna não existe). Após adicionar `status`, **precisam** filtrar `status='COMPLETED'` ou os totais agregados ficarão incoerentes com `shifts.total_*` mantidos pelo trigger.

### 1.4. RLS pattern estabelecido

- `is_admin()` SECURITY DEFINER, STABLE, `SET search_path = public` (migration 002).
- `get_my_location_id()` SECURITY DEFINER, STABLE (migration 003).
- Gotcha já documentado: queries recursivas em policies de tabelas self-referenced causam erro 42P17. **Toda nova policy que precisa checar atributos de outra linha de `sales`, `shifts` ou `user_profiles` deve usar função SECURITY DEFINER.**

### 1.5. Offline (Dexie)

- `pending_sales`: linhas com `synced: false` aguardando drain.
- `drain()` envia batch para Edge Function `sync-sales`.
- `provisional_shifts`: turnos criados offline durante virada (16h/23h).
- Drain só roda quando `isOnline=true` e `isSyncing=false`. Não há lock atômico, apenas o flag `isSyncing` em memória do Zustand.

---

## 2. DA-1: Schema de Cancelamento

### 2.1. Decisão

**Adicionar 3 colunas a `sales`:**

| Coluna | Tipo | Nullable | Default | Justificativa |
|--------|------|----------|---------|---------------|
| `status` | `TEXT` | `NOT NULL` | `'COMPLETED'` | Enum-style com CHECK; default cobre vendas existentes (backfill grátis) |
| `cancelled_at` | `TIMESTAMPTZ` | `NULL` | — | Timestamp da operação; usado em auditoria e ordenação |
| `cancelled_by` | `UUID` | `NULL` | — | FK para `auth.users(id)` ON DELETE SET NULL; quem cancelou |

### 2.2. Justificativa das alternativas rejeitadas

| Alternativa | Por que rejeitada |
|-------------|-------------------|
| **Apenas `cancelled_at IS NULL` (sem `status`)** | Soft-delete por nulabilidade funciona, mas dificulta CHECK constraints, leitura de queries (`WHERE cancelled_at IS NULL` em todo lugar) e impede expansão futura (`REFUNDED`, `VOIDED`). Coluna `status` explícita é mais legível e extensível. |
| **Tabela `sales_audit` separada (sugestão PM DA-3)** | Para escala atual (single-tenant, ~500 vendas/mês) é overkill. Adiciona join em toda query. Mantém histórico via `cancelled_at`/`cancelled_by` no próprio `sales`. **Confirmamos a recomendação do PM.** Se no futuro precisarmos log de eventos múltiplos por venda (reabertura, refund parcial), criamos `sales_events` em fase 3. |
| **DELETE físico** | Inaceitável: perde rastro fiscal, dificulta conciliação bancária retroativa. EPIC-09 D5 já decidiu soft-delete. |
| **Enum PostgreSQL nativo (`CREATE TYPE ...`)** | Adicionar valor exige `ALTER TYPE`, que é mais rígido. CHECK em TEXT é trivialmente extensível e já é o padrão do projeto (vide `payment_method`, `weight_source`, `shifts.status`). Mantém consistência. |

### 2.3. DDL exato — Migration `20260521000000_sale_cancellation.sql`

```sql
-- ============================================================
-- Migration: 009 sale_cancellation
-- Adds soft-delete capability to sales table.
-- Updates shift_totals trigger to handle status transitions.
-- Updates dashboard views to filter COMPLETED sales only.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add columns to sales
-- ------------------------------------------------------------
ALTER TABLE sales
  ADD COLUMN status        TEXT        NOT NULL DEFAULT 'COMPLETED'
    CHECK (status IN ('COMPLETED', 'CANCELLED')),
  ADD COLUMN cancelled_at  TIMESTAMPTZ,
  ADD COLUMN cancelled_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Consistency: if status='CANCELLED' then cancelled_at and cancelled_by MUST be set.
ALTER TABLE sales
  ADD CONSTRAINT sales_cancellation_fields_consistency
  CHECK (
    (status = 'COMPLETED' AND cancelled_at IS NULL AND cancelled_by IS NULL)
    OR
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL)
    -- Note: cancelled_by allowed to be NULL on CANCELLED to survive
    -- ON DELETE SET NULL of auth.users without breaking historical rows.
  );

-- ------------------------------------------------------------
-- 2. Indexes
-- ------------------------------------------------------------

-- Partial index: most queries filter status='COMPLETED'; index only those rows
-- to keep it small and selective. Catches dashboard, exports, history filters.
CREATE INDEX idx_sales_completed_location_created
  ON sales (location_id, created_at DESC)
  WHERE status = 'COMPLETED';

-- Cancellation queries (audit, "show cancelled in period"): smaller subset
CREATE INDEX idx_sales_cancelled_at
  ON sales (cancelled_at DESC)
  WHERE status = 'CANCELLED';

-- ------------------------------------------------------------
-- 3. Extend trigger to handle UPDATE (cancellation reversal)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_shift_totals_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- COMPLETED → CANCELLED : subtract from shift totals
  IF OLD.status = 'COMPLETED' AND NEW.status = 'CANCELLED' THEN
    UPDATE shifts SET
      sale_count  = GREATEST(sale_count - 1, 0),
      total_sales = GREATEST(total_sales - OLD.amount, 0),
      total_pix   = GREATEST(total_pix
                    - CASE WHEN OLD.payment_method = 'pix'                  THEN OLD.amount ELSE 0 END, 0),
      total_card  = GREATEST(total_card
                    - CASE WHEN OLD.payment_method IN ('credit','debit')    THEN OLD.amount ELSE 0 END, 0),
      total_cash  = GREATEST(total_cash
                    - CASE WHEN OLD.payment_method = 'cash'                 THEN OLD.amount ELSE 0 END, 0)
    WHERE id = OLD.shift_id;

  -- CANCELLED → COMPLETED : not supported in Phase 2 (no "uncancel").
  -- If a CHECK or future migration allows it, raise to make the gap explicit.
  ELSIF OLD.status = 'CANCELLED' AND NEW.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'Uncancelling a sale is not supported in Phase 2 (sale_id=%)', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_shift_totals_on_update
  AFTER UPDATE OF status ON sales
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_shift_totals_on_update();

-- ------------------------------------------------------------
-- 4. Update views: filter status='COMPLETED' in aggregates
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW shift_summary
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.location_id,
  s.shift_number,
  s.opened_at,
  s.closed_at,
  s.status,
  s.opened_by,
  COUNT(sl.id) FILTER (WHERE sl.status = 'COMPLETED')                                       AS total_sales,
  COALESCE(SUM(sl.amount) FILTER (WHERE sl.status = 'COMPLETED'), 0)                        AS total_amount,
  CASE WHEN COUNT(sl.id) FILTER (WHERE sl.status = 'COMPLETED') > 0
    THEN ROUND(
      (SUM(sl.amount) FILTER (WHERE sl.status = 'COMPLETED')
       / COUNT(sl.id) FILTER (WHERE sl.status = 'COMPLETED'))::numeric, 2)
    ELSE 0
  END                                                                                       AS avg_ticket,
  COALESCE(SUM(sl.amount) FILTER (WHERE sl.status = 'COMPLETED' AND sl.payment_method = 'pix'),                        0) AS total_pix,
  COALESCE(SUM(sl.amount) FILTER (WHERE sl.status = 'COMPLETED' AND sl.payment_method IN ('credit','debit')),          0) AS total_card,
  COALESCE(SUM(sl.amount) FILTER (WHERE sl.status = 'COMPLETED' AND sl.payment_method = 'cash'),                       0) AS total_cash,
  EXTRACT(EPOCH FROM (COALESCE(s.closed_at, now()) - s.opened_at)) / 60                     AS duration_minutes
FROM shifts s
LEFT JOIN sales sl ON sl.shift_id = s.id
GROUP BY s.id, s.location_id, s.shift_number, s.opened_at, s.closed_at, s.status, s.opened_by;

CREATE OR REPLACE VIEW daily_summary
WITH (security_invoker = true)
AS
SELECT
  DATE(sl.created_at AT TIME ZONE 'America/Sao_Paulo')                                      AS sale_date,
  sl.location_id,
  COUNT(*)                                                                                  AS total_sales,
  COALESCE(SUM(sl.amount), 0)                                                               AS total_amount,
  CASE WHEN COUNT(*) > 0
    THEN ROUND((SUM(sl.amount) / COUNT(*))::numeric, 2)
    ELSE 0
  END                                                                                       AS avg_ticket,
  COUNT(DISTINCT sl.shift_id)                                                               AS total_shifts,
  COALESCE(SUM(CASE WHEN sl.payment_method = 'pix'                        THEN sl.amount ELSE 0 END), 0) AS total_pix,
  COALESCE(SUM(CASE WHEN sl.payment_method IN ('credit','debit')           THEN sl.amount ELSE 0 END), 0) AS total_card,
  COALESCE(SUM(CASE WHEN sl.payment_method = 'cash'                       THEN sl.amount ELSE 0 END), 0) AS total_cash
FROM sales sl
WHERE sl.status = 'COMPLETED'  -- Excludes cancelled from dashboard daily metrics
GROUP BY sale_date, sl.location_id;

-- ------------------------------------------------------------
-- 5. RLS: helper function + policy for UPDATE (cancellation)
-- ------------------------------------------------------------

-- SECURITY DEFINER: avoid recursion when policy of `sales` needs to inspect
-- `shifts` (which itself has RLS). Pattern follows is_admin() in migration 002.
CREATE OR REPLACE FUNCTION can_cancel_sale(p_sale_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM sales s
    JOIN shifts sh ON sh.id = s.shift_id
    WHERE s.id = p_sale_id
      AND s.status = 'COMPLETED'                  -- not already cancelled
      AND sh.status = 'open'                       -- shift still active
      AND sh.location_id = get_my_location_id()    -- same location
  );
$$;

CREATE POLICY "sales_update_cancel_admin"
  ON sales FOR UPDATE
  TO authenticated
  USING (is_admin() AND can_cancel_sale(id))
  WITH CHECK (
    is_admin()
    AND status = 'CANCELLED'
    AND cancelled_at IS NOT NULL
    AND cancelled_by = auth.uid()
  );

-- ------------------------------------------------------------
-- 6. (Optional but recommended) Backfill safety
-- ------------------------------------------------------------
-- Existing rows already get status='COMPLETED' via DEFAULT on ALTER TABLE.
-- No data migration needed. Trigger above handles forward transitions only.
```

### 2.4. Impacto nos componentes do app (apenas leitura, sem implementar)

| Componente | Mudança necessária | Severidade |
|------------|--------------------|------------|
| `ShiftSalesTable.tsx` | Filtrar/exibir status; novo badge para `CANCELLED`; novo botão "Cancelar" gated por admin | Média |
| `SalesHistoryTable` (a criar — F2) | Filtro de status; visual atenuado em canceladas | Nova |
| Dashboard cards (4 cards) | **Nenhuma mudança** — usam `shift_summary` e `daily_summary`, já filtram via views | Nenhuma ✓ |
| `PaymentBreakdown.tsx` | **Nenhuma mudança** — recebe `pix/card/cash/total` já filtrados pela view | Nenhuma ✓ |
| `saleStore.confirmSale` | Inserir explicitamente `status: 'COMPLETED'`? **Não.** Default da coluna cobre. Apenas atualizar tipo TS para opcional. | Baixa |
| `shiftStore.updateTotals` | Manter como está; trigger DB já cobre INSERT. Adicionar `reverseTotals` (ver DA-3). | Média |
| `types/index.ts` `Sale` | Adicionar `status: 'COMPLETED' \| 'CANCELLED'`, `cancelled_at: string \| null`, `cancelled_by: string \| null` | Baixa |
| `types/supabase.ts` | Regenerar com `supabase gen types` após migration | Baixa |

### 2.5. Constraints e gotchas a destacar para o @dev

1. **Trigger AFTER UPDATE só dispara em mudança de `status`** (cláusula `WHEN (OLD.status IS DISTINCT FROM NEW.status)`). UPDATE em `cancelled_at` isolado não dispara — bom, evita double-decrement.
2. **`GREATEST(... - x, 0)` no trigger** previne totais negativos em caso de inconsistência (e.g., venda criada antes da migration com `amount` que foi alterado fora do fluxo normal). É defesa em profundidade.
3. **`can_cancel_sale` é STABLE, não IMMUTABLE** — depende de `auth.uid()` e do estado da tabela `shifts`. STABLE permite cacheamento dentro da mesma query.
4. **`WITH CHECK` da policy força que o UPDATE escreva exatamente o que esperamos**: status='CANCELLED', cancelled_at presente, cancelled_by = auth.uid(). Impede admin malicioso de cancelar venda no nome de outro.
5. **AC-F3.8 (race: turno fecha durante confirmação)** é coberto **server-side** por `can_cancel_sale`: se `sh.status != 'open'` no momento do UPDATE, a policy nega e o cliente recebe erro 42501. Mensagem amigável no `onError` do React Query.

---

## 3. DA-2: Cancelamento de Venda Offline

### 3.1. Decisão: **Opção A — Remover da fila Dexie**

Quando uma venda está em `pending_sales` (synced=false) e o admin clica em "Cancelar":

1. **NÃO** envia UPDATE ao Supabase (venda ainda não existe lá).
2. **Remove** a linha de `pending_sales` via `db.pending_sales.delete(local_id)`.
3. **Decrementa** o `activeShift` no Zustand via `reverseTotals(amount, paymentMethod)` (ver DA-3).
4. Atualiza `pendingCount` em `syncStore`.

### 3.2. Justificativa

| Critério | Opção A (remove) | Opção B (sincroniza como CANCELLED) |
|----------|------------------|-------------------------------------|
| **Pegada no servidor** | Zero linhas órfãs | Cria linha que nunca existiu na realidade |
| **Auditoria fiscal** | Sem rastro (nada chegou ao banco) | Rastro completo, com status='CANCELLED' |
| **Complexidade de drain** | Simples: linha some, não vai para batch | Drain envia `INSERT ... status='CANCELLED'` (Edge Function precisa aceitar) |
| **Coerência com semântica** | "Venda offline ainda não é venda" — pode ser cancelada como rascunho | "Toda venda confirmada é evento permanente" |
| **Risco de double-side-effect** | Mínimo (uma única operação Dexie atômica) | Edge Function precisa de idempotência forte |
| **UX percebida** | Limpa imediato, sem "pingar" tela após sync | Aparece, some, reaparece como cancelada |

**Veredito:** Opção A vence em todos os eixos exceto auditoria fiscal. Mas a auditoria fiscal **não se aplica a vendas que nunca foram fiscalmente registradas** — uma venda offline ainda não emitiu nota fiscal nem foi consolidada em relatório oficial. É equivalente a "desistir antes de bater o cupom". Confirmado com a regra D6 do EPIC (cancelamento em turno ativo): se a venda ainda está no Dexie, o turno está sendo construído.

**Caveat aceito:** o operador (admin) perde rastro de "venda que tentei e desisti offline". Considerado aceitável — esse é um caso raro e o feedback do app (toast) é suficiente.

### 3.3. Regra de negócio formal (para o SM colocar nas stories)

> **REGRA DA-2**: Ao acionar "Cancelar venda" no PDV ou no histórico:
>
> 1. **Se** `sale.id` existe no Supabase (consultar via `pending_sales.find(s => s.id === saleId)` retorna `undefined`): executar UPDATE Supabase normal (fluxo online).
> 2. **Se** `sale.id` está em `pending_sales` com `synced=false`: executar Opção A (delete local).
> 3. **Se** `sale.id` está em `pending_sales` com `synced=true` mas `sync_reconciled=false`: fallback para fluxo Supabase normal (o ID já existe no servidor; só não foi reconciliado).
> 4. **Se** drain está em curso (`syncStore.isSyncing === true`): **bloquear** o cancelamento com toast "Aguarde a sincronização terminar (~3s)" e re-habilitar quando `isSyncing=false`. Evita race entre delete local e drain.

### 3.4. Race condition prevention (gotcha crítico)

O caso perigoso: admin clica "Cancelar venda offline" **enquanto** `drain()` está enviando o batch que inclui essa venda. Sequência ruim:

```
T0  drain() lê batch contendo venda X (still in memory)
T1  admin clica Cancelar → delete db.pending_sales onde id=X
T2  drain() recebe success do Supabase para X
T3  drain() tenta UPDATE db.pending_sales.update(X.local_id, {synced:true})
    → nada para atualizar, mas X JÁ está no Supabase
RESULT: linha COMPLETED no Supabase, sem rastro local → admin pensa que cancelou.
```

**Mitigação obrigatória nas stories:** o handler de cancelamento offline DEVE verificar `useSyncStore.getState().isSyncing`. Se true, bloqueia. Adicionalmente, **drain() deve checar pós-sucesso** se a `pending_sale` ainda existe; se não, executar UPDATE remoto para CANCELLED (recovery). Este é fallback defensivo — em prática, o gate de UX já previne.

```
pseudo-código do handler:
  if (sale está em pending_sales && !sale.synced) {
    if (syncStore.isSyncing) { toast.error('Aguarde sincronização'); return }
    await db.pending_sales.delete(local_id)
    shiftStore.reverseTotals(amount, paymentMethod)
    syncStore.refreshPendingCount()
    toast.success('Venda offline cancelada')
  }
```

---

## 4. DA-3: `reverseTotals` no shiftStore

### 4.1. Decisão: **Nova função separada `reverseTotals`**

```typescript
reverseTotals: (amount: number, paymentMethod: PaymentMethod) => void
```

**NÃO** sobrecarregar `updateTotals` com `sign: 1 | -1` ou parâmetro `direction: 'add' | 'subtract'`.

### 4.2. Justificativa das alternativas rejeitadas

| Alternativa | Por que rejeitada |
|-------------|-------------------|
| **`updateTotals(amount, method, sign: 1 \| -1 = 1)`** | Adiciona um parâmetro silencioso que muda o significado da operação. Mais difícil de grep (`updateTotals(.+, .+, -1)` é frágil). Risco de chamar errado em refactor futuro. |
| **`updateTotals(amount, method, direction: 'add' \| 'subtract')`** | Mesmo problema do sign, com string em vez de número. Mais legível mas ainda esconde semântica em parâmetro. |
| **Reverso inline no componente** | Espalha lógica de totalização. Cada componente que cancela teria que re-implementar a aritmética com arredondamento. Já erramos isso uma vez (vide `feedback_rls_patterns` e a fix `b0bd972`). |
| **Recalcular do banco** (refetch + setActiveShift) | Mais "honesto" mas adiciona round-trip de rede. Em offline não funciona. Performance ruim para uma operação que deve ser instantânea no UI. |

### 4.3. Assinatura completa

```typescript
// src/stores/shiftStore.ts — adicionar ao interface ShiftState:

reverseTotals: (amount: number, paymentMethod: PaymentMethod) => void
```

**Implementação (referência, não código de produção — para SM/Dev):**

```typescript
reverseTotals: (amount, paymentMethod) => {
  const { activeShift } = get()
  if (!activeShift) return

  const isCard = paymentMethod === 'credit' || paymentMethod === 'debit'

  set({
    activeShift: {
      ...activeShift,
      sale_count: Math.max(activeShift.sale_count - 1, 0),
      total_sales: Math.max(
        Math.round((activeShift.total_sales - amount) * 100) / 100,
        0
      ),
      total_pix:
        paymentMethod === 'pix'
          ? Math.max(Math.round((activeShift.total_pix - amount) * 100) / 100, 0)
          : activeShift.total_pix,
      total_card: isCard
        ? Math.max(Math.round((activeShift.total_card - amount) * 100) / 100, 0)
        : activeShift.total_card,
      total_cash:
        paymentMethod === 'cash'
          ? Math.max(Math.round((activeShift.total_cash - amount) * 100) / 100, 0)
          : activeShift.total_cash,
    },
  })
}
```

### 4.4. Quem chama `reverseTotals`

| Caller | Cenário |
|--------|---------|
| Cancellation handler (online, sucesso do UPDATE) | Após Supabase confirmar UPDATE, atualiza shift local imediatamente sem refetch |
| Cancellation handler (offline DA-2) | Após delete em `pending_sales`, decrementa shift local |
| `React Query onError` rollback | **Não chama reverseTotals** — em vez disso, refaz fetch via `invalidateQueries(['active-shift'])` para garantir source of truth |

### 4.5. Coerência com o trigger do banco

- **Online + sucesso**: trigger `trg_update_shift_totals_on_update` decrementa `shifts.*` no banco. `reverseTotals` decrementa no client. Próximo refetch via `loadActiveShift` confirma valores. **Consistência eventual em ms.**
- **Offline (DA-2)**: nenhum trigger dispara (nada chegou ao banco). `reverseTotals` é a única atualização. Ao reconectar e drain rodar, a venda nunca entra → totais permanecem corretos.

### 4.6. Nota sobre `updateTotals` existente

Manter inalterada. Permanece sendo chamada em `confirmSale` (online e offline). O trigger no banco continua sendo a source of truth definitiva — `updateTotals` no client é apenas otimismo para UX rápida.

---

## 5. RLS Policy — Resumo Consolidado

A policy `sales_update_cancel_admin` (seção 2.3, item 5) cobre exatamente as restrições de produto:

| AC do EPIC | Como a policy garante |
|-----------|----------------------|
| AC-F3.1 (admin only) | `is_admin()` no `USING` e `WITH CHECK` |
| AC-F3.2 (só turno ativo, só COMPLETED) | `can_cancel_sale` checa `sh.status='open'` e `s.status='COMPLETED'` |
| AC-F3.4 (campos obrigatórios) | `WITH CHECK` força `status='CANCELLED'`, `cancelled_at IS NOT NULL`, `cancelled_by = auth.uid()` |
| AC-F3.6 (location_id correto) | `can_cancel_sale` checa `sh.location_id = get_my_location_id()` |
| AC-F3.8 (race: turno fecha) | `can_cancel_sale` checa `sh.status='open'` no momento do UPDATE; se entre dialog e confirm o turno fechou, UPDATE falha com erro RLS |
| AC-F3.9 (auditoria) | `cancelled_at` e `cancelled_by` preservados na linha; CHECK constraint garante integridade |

**Recursão (gotcha do projeto):** `can_cancel_sale` é SECURITY DEFINER e faz JOIN com `shifts` sem invocar policy de `shifts` (DEFINER bypassa RLS). Não há ciclo. Padrão idêntico ao `is_admin()` já validado em produção.

---

## 6. Diagrama de Fluxo do Cancelamento

```
┌────────────────────────────────────────────────────────────────────────┐
│                       USER CLICKS "Cancelar"                            │
│                  (em ShiftSalesTable ou SalesHistory)                   │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │ Confirmation Dialog (Shadcn)  │
                  │ resumo: data, peso, valor    │
                  │ [Voltar] [Confirmar]         │
                  └───────────┬──────────────────┘
                              │ user confirms
                              ▼
              ┌───────────────────────────────────┐
              │ Check: sale.id in pending_sales?  │
              └────────────┬──────────────────────┘
                           │
              ┌────────────┴───────────────┐
              │                            │
        YES (offline)                ┌─────▼──────┐
              │                      │  NO        │
              ▼                      │  (online)  │
┌──────────────────────────┐         └─────┬──────┘
│ syncStore.isSyncing?     │               │
│  ├─ true → toast wait    │               ▼
│  └─ false → continue     │     ┌────────────────────────┐
└─────────┬────────────────┘     │ Supabase UPDATE:       │
          │                      │  status=CANCELLED      │
          ▼                      │  cancelled_at=now()    │
┌──────────────────────────┐     │  cancelled_by=uid()    │
│ db.pending_sales         │     │ WHERE id=$saleId       │
│   .delete(local_id)      │     └─────┬──────────────────┘
└──────────┬───────────────┘           │
           │                           ▼
           │              ┌────────────────────────────┐
           │              │ RLS policy checks:         │
           │              │  - is_admin()              │
           │              │  - can_cancel_sale(id):    │
           │              │      sale.status=COMPLETED │
           │              │      shift.status=open     │
           │              │      shift.location_id=mine│
           │              └────────────┬───────────────┘
           │                           │
           │              ┌────────────┴───────────────┐
           │              │                            │
           │            PASS                         FAIL
           │              │                            │
           │              ▼                            ▼
           │   ┌────────────────────┐         ┌─────────────────────┐
           │   │ DB UPDATE applies  │         │ Error 42501         │
           │   │                    │         │ Toast: "Não foi     │
           │   │ Trigger fires:     │         │ possível cancelar.  │
           │   │  trg_update_shift_ │         │ Turno fechou ou     │
           │   │   totals_on_update │         │ venda já cancelada."│
           │   │                    │         └─────────────────────┘
           │   │ shifts.* decrement │
           │   └──────────┬─────────┘
           │              │
           ▼              ▼
┌──────────────────────────────────────┐
│ shiftStore.reverseTotals(amount, pm) │
│   (decrement local activeShift)      │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│ queryClient.invalidateQueries:         │
│   ['shift-sales']    (ShiftSalesTable) │
│   ['sales-history']  (F2 page)         │
│   ['dashboard-*']    (4 cards)         │
└──────────────────┬─────────────────────┘
                   │
                   ▼
       ┌──────────────────────────┐
       │ Toast: "Venda cancelada" │
       │ Dialog closes            │
       └──────────────────────────┘
```

---

## 7. Sequência de Implementação Recomendada (handoff SM)

O EPIC já decidiu ordem F1 → F2 → F3. Para F3 especificamente, recomendo split assim:

| Story | Escopo | Esforço |
|-------|--------|---------|
| **F3.1** | Migration 009 (`sale_cancellation.sql`) + regenerar `types/supabase.ts` + atualizar `types/index.ts` `Sale` + tests SQL (RLS, trigger) | 3-5 pts |
| **F3.2** | `shiftStore.reverseTotals` + cancellation handler (online path) + integração em `ShiftSalesTable` (botão + dialog) + tests | 5-8 pts |
| **F3.3** | Offline path (DA-2) + race guard com `isSyncing` + tests de integração para cenários offline | 3-5 pts |

F3.1 é gate: deve passar antes de F3.2 começar (PR separado, review da Dara).

---

## 8. Riscos Residuais e Mitigações Pós-Decisão

| Risco | Severidade | Mitigação adicional sugerida (não bloqueante) |
|-------|-----------|----------------------------------------------|
| Trigger falha silenciosa em volume → totais derivam | Baixa | Story F3.1 deve incluir test SQL que: insere venda, cancela, verifica `shifts.*` decrementado |
| Admin cancela várias vendas em sequência rápida → race no React Query | Baixa | Usar `mutation.isPending` para desabilitar botão durante request |
| Edge Function `sync-sales` desconhece status=CANCELLED | Nula em DA-2 (Opção A) | Não aplicável; venda cancelada offline nunca é enviada |
| Backfill de vendas históricas: nenhuma vinha com `status` antes | Nula | DEFAULT 'COMPLETED' cobre todas as linhas existentes em ALTER TABLE |
| Frontend antigo (cache do navegador) abre venda sem coluna `status` na tipagem | Baixa | Após deploy, forçar reload (já temos service worker que faz isso) |

---

## 9. Quality Gates (Architect-First)

Antes de sharding em stories, validei contra os princípios:

- [x] **Map Before Modify**: estado atual completamente documentado (seção 1)
- [x] **No invention**: cada coluna/policy traceada a um AC do EPIC-09 (seção 5 mapeia)
- [x] **Capability preservation**: nenhuma capacidade removida; apenas adicionadas
- [x] **Zero coupling**: sem dependências entre F1/F2/F3 fora das já declaradas no EPIC
- [x] **Config-over-hardcoding**: nenhum valor mutable hardcoded; status enum em CHECK (1 lugar)
- [x] **Trade-offs explícitos**: 3 alternativas avaliadas para cada DA (seções 2.2, 3.2, 4.2)
- [x] **Reversibilidade**: migration 009 é reversível em ~30 linhas de DOWN script (não incluído por padrão do projeto, mas trivial)
- [x] **RLS sem recursão**: padrão SECURITY DEFINER já validado em produção

---

## 10. Change Log

| Data | Quem | Ação |
|------|------|------|
| 2026-05-20 | @architect (Aria) | Documento criado. Decisões DA-1, DA-2, DA-3 resolvidas. Pronto para @data-engineer revisar migration 009 antes do sharding. |

---

## Próximos Passos

1. **@data-engineer (Dara)** — Revisar migration 009 da seção 2.3. Validar: índice partial é apropriado para volume previsto; CHECK constraint não bloqueia casos de uso legítimos; trigger AFTER UPDATE não conflita com outras subscrições.
2. **@sm (River)** — Após Dara aprovar, fazer sharding com base na seção 7. Cada story carrega referência a este documento.
3. **@po (Pax)** — Validar cada story do sharding com checklist 10-point.
4. **@dev (Dex)** — Implementar na ordem F3.1 → F3.2 → F3.3 (após F1 e F2). Tests obrigatórios desde F3.1 (regra EPIC-04+).
