# AçaiMix — System Design Document

**Versão:** 1.0  
**Data:** 2026-05-19  
**Autora:** Aria (Architect)  
**Status:** Aprovado para implementação

---

## 1. Visão Geral

### 1.1 Contexto de Negócio

O AçaiMix é um sistema de PDV (Ponto de Venda) e Dashboard Financeiro para açaíterias. O cliente controlava finanças em caderno — o sistema substitui esse processo com foco em três valores:

1. **Velocidade no caixa** — operação de um clique/toque, sem fricção
2. **Visibilidade financeira** — dono vê o negócio em tempo real, de qualquer lugar
3. **Auditoria de troca de turno** — fechamento automático, totais registrados, sem dependência humana

### 1.2 Modelo de Produto

- **Single-tenant, multi-location**: Um dono, N locais, um banco de dados
- **NÃO é SaaS**: Sem billing, sem multi-tenancy, sem onboarding automático
- **Fase 1**: Um local ativo; schema preparado para segundo local sem migration

### 1.3 Usuários

| Persona | Role | Dispositivo | Acesso |
|---------|------|-------------|--------|
| Operador / Caixa | `staff` | PC com Chrome desktop | PDV + histórico do turno |
| Dono / Admin | `admin` | PC, celular, notebook | Dashboard + Configurações + PDV |

---

## 2. Stack Tecnológico

### 2.1 Frontend

| Tecnologia | Justificativa |
|------------|---------------|
| React 18 + Vite | Build rápido, HMR eficiente, padrão de mercado |
| TypeScript | Type safety em toda a aplicação |
| Tailwind CSS | Utilitário — sem CSS custom desnecessário |
| Shadcn/UI | Componentes acessíveis, customizáveis, sem runtime overhead |
| Zustand | State management com subscriptions seletivas — essencial para PDV com polling de balança |
| React Query (TanStack) | Server state, cache, polling automático do dashboard |
| React Router v6 | Roteamento com proteção por role |
| Dexie.js | Wrapper TypeScript para IndexedDB — fila offline |

### 2.2 Backend / BaaS

| Tecnologia | Justificativa |
|------------|---------------|
| Supabase | PostgreSQL gerenciado + Auth + RLS + Edge Functions + Storage |
| Supabase Edge Functions | TypeScript, testável localmente, sem necessidade de Supabase Pro |
| Supabase Auth | JWT com roles customizadas via `user_profiles` |

### 2.3 Hardware

| Componente | Tecnologia | Nota |
|------------|------------|------|
| Balança UPX Wind D3 | Web Serial API (nativa Chrome/Edge) | Somente Chrome/Edge desktop — requisito de hardware documentado |

---

## 3. Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                    │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  /pos    │  │  /dashboard  │  │  /admin/settings  │  │
│  │  (PDV)   │  │  (Admin)     │  │  (Admin)          │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬─────────┘  │
│       │               │                    │             │
│  ┌────▼───────────────▼────────────────────▼──────────┐ │
│  │              Zustand Stores                        │ │
│  │  scaleStore │ saleStore │ shiftStore │ syncStore   │ │
│  └────┬──────────────────────────────────┬────────────┘ │
│       │                                  │              │
│  ┌────▼──────────┐              ┌─────────▼──────────┐  │
│  │ IScaleProvider│              │ Dexie.js (offline) │  │
│  │ Serial/Mock/  │              │ queue + sync       │  │
│  │ Manual        │              └─────────┬──────────┘  │
│  └───────────────┘                        │             │
└──────────────────────────────────────────┬─────────────┘
                                           │ HTTPS / WS
                                           │
┌──────────────────────────────────────────▼─────────────┐
│                      SUPABASE                           │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  PostgreSQL │  │ Edge Functions│  │  Supabase     │  │
│  │  + RLS      │  │              │  │  Auth         │  │
│  │             │  │ close-shift  │  │               │  │
│  │  locations  │  │ sync-sales   │  │  JWT + roles  │  │
│  │  shifts     │  │              │  │               │  │
│  │  sales      │  │  Cron:       │  │               │  │
│  │  products   │  │  0 16,23 * * *│  │               │  │
│  │  user_prof. │  └──────────────┘  └───────────────┘  │
│  └─────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Modelo de Dados (Alto Nível)

> DDL completo, índices e RLS policies: responsabilidade de @data-engineer.

### 4.1 Entidades Principais

```
locations
├── id          UUID PK
├── name        TEXT ("Açaí Centro", "Açaí Bairro X")
├── address     TEXT
├── active      BOOLEAN default true
└── created_at  TIMESTAMPTZ

user_profiles   (extensão de auth.users)
├── id          UUID PK → auth.users.id
├── location_id UUID FK → locations.id
├── role        TEXT CHECK ('admin' | 'staff')
├── display_name TEXT
└── created_at  TIMESTAMPTZ

products
├── id           UUID PK
├── location_id  UUID FK → locations.id
├── name         TEXT ("Açaí")
├── price_per_gram NUMERIC(10,4)  -- ex: 0.0650 = R$65/kg
├── active       BOOLEAN default true
└── updated_at   TIMESTAMPTZ

shifts
├── id           UUID PK
├── location_id  UUID FK → locations.id
├── shift_number SMALLINT (1 ou 2)
├── opened_at    TIMESTAMPTZ
├── closed_at    TIMESTAMPTZ nullable
├── closed_by    TEXT ('auto' | user_id)
├── status       TEXT CHECK ('open' | 'closed')
├── total_sales  NUMERIC(12,2)  -- snapshot no fechamento
├── total_pix    NUMERIC(12,2)
├── total_card   NUMERIC(12,2)
├── total_cash   NUMERIC(12,2)
└── sale_count   INTEGER

sales
├── id              UUID PK  -- gerado no cliente (UUIDv4)
├── shift_id        UUID FK → shifts.id
├── location_id     UUID FK → locations.id
├── weight_grams    NUMERIC(8,3) nullable
├── amount          NUMERIC(10,2)
├── payment_method  TEXT CHECK ('pix' | 'card' | 'cash')
├── amount_received NUMERIC(10,2) nullable  -- só para cash
├── change_returned NUMERIC(10,2) nullable  -- só para cash
├── weight_source   TEXT CHECK ('scale' | 'manual')
├── created_at      TIMESTAMPTZ  -- horário real da venda (crítico para reconciliação)
├── synced_at       TIMESTAMPTZ nullable
├── sync_reconciled BOOLEAN default false  -- true se shift_id foi corrigido no backend
└── created_offline BOOLEAN default false
```

### 4.2 RLS Overview (para @data-engineer detalhar)

| Tabela | Admin | Staff |
|--------|-------|-------|
| `locations` | SELECT/UPDATE própria | SELECT própria |
| `shifts` | SELECT/INSERT/UPDATE todas as locations | SELECT/INSERT turno ativo da própria location |
| `sales` | SELECT todas as locations | SELECT/INSERT turno ativo da própria location |
| `products` | SELECT/INSERT/UPDATE/DELETE | SELECT |
| `user_profiles` | SELECT/UPDATE todas | SELECT próprio perfil |

---

## 5. Arquitetura Frontend

### 5.1 Estrutura de Rotas

```
/                       → redirect baseado em role
├── /login              → público — tela de login
├── /pos                → staff + admin — PDV
├── /dashboard          → admin only — métricas
└── /admin
    └── /settings       → admin only — preço/grama, info da loja
```

**Proteção de rotas:**
```typescript
// Componente ProtectedRoute verifica role do user_profiles
<ProtectedRoute requiredRole="admin">
  <Dashboard />
</ProtectedRoute>
```

Redirect para `/pos` se Staff tentar acessar `/dashboard`.

### 5.2 Zustand Stores

```typescript
// scaleStore — estado da balança em tempo real
interface ScaleStore {
  isConnected: boolean
  currentWeightGrams: number | null
  provider: IScaleProvider | null
  connect: () => Promise<void>
  disconnect: () => void
  setProvider: (provider: IScaleProvider) => void
}

// saleStore — venda sendo construída
interface SaleStore {
  capturedWeightGrams: number | null
  amount: number | null          // calculado: peso × price_per_gram
  paymentMethod: PaymentMethod | null
  amountReceived: number | null  // só para 'cash'
  change: number | null          // calculado: amountReceived - amount
  captureWeight: () => void      // lê do scaleStore
  setPaymentMethod: (method: PaymentMethod) => void
  setAmountReceived: (value: number) => void
  confirmSale: () => Promise<void>
  reset: () => void
}

// shiftStore — turno ativo
interface ShiftStore {
  activeShift: Shift | null
  isLoading: boolean
  fetchActiveShift: () => Promise<void>
  onShiftClosed: () => void
}

// syncStore — fila offline e reconciliação
interface SyncStore {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  drainQueue: () => Promise<void>
  checkShiftBoundary: () => void  // soft-close logic
}
```

### 5.3 Estrutura de Componentes do PDV

```
PDVPage
├── ShiftStatusBar          — turno ativo, horário, totais parciais
├── ScaleConnectionStatus   — badge: Conectada / Desconectada / Manual
├── WeightDisplay           — peso em tempo real (grande, legível)
│   └── ManualWeightInput   — visível quando provider = ManualInputProvider
├── PriceDisplay            — total calculado (peso × preço/g)
├── PaymentMethodSelector
│   ├── PIXButton
│   ├── CardButton
│   └── CashButton
│       └── CashFlow        — condicional: input "Valor Recebido" + Troco em destaque
├── ConfirmSaleButton       — disabled se amount = null ou paymentMethod = null
├── OfflineIndicator        — badge "Offline — X vendas pendentes" (condicional)
└── ShiftSalesTable         — últimas N vendas do turno (histórico)
```

---

## 6. Integração com Balança — IScaleProvider

### 6.1 Interface

```typescript
interface IScaleProvider {
  readonly type: 'serial' | 'mock' | 'manual'
  connect(): Promise<void>
  disconnect(): void
  onWeight(callback: (grams: number) => void): Unsubscribe
  onConnectionChange(callback: (connected: boolean) => void): Unsubscribe
}
```

### 6.2 Implementações

**MockScaleProvider** (desenvolvimento):
- Slider ou input numérico que emite valores
- Simula latência e variações de peso
- Usado em desenvolvimento e staging

**SerialScaleProvider** (produção — UPX Wind D3):
- Web Serial API: abre porta COM, configura baud rate
- Parseia stream de bytes conforme protocolo UPX Wind D3
- Protocolo a ser documentado em spike ou via manual do fabricante
- Reconexão automática se porta desconectar

**ManualInputProvider** (fallback de hardware):
- Usuário digita o peso via input numérico
- Emite o valor ao confirmar (Enter ou botão)
- Campo `weight_source: 'manual'` marcado na venda

### 6.3 Protocolo UPX Wind D3 — Estratégia de Documentação

**Passo 1 (pré-implementação):** Pesquisar manual online. Termos: "UPX Wind D3 manual protocolo serial", "UPX Wind D3 RS232 protocol", "Toledo protocol UPX".

**Passo 2 (se necessário):** No dia da instalação, conectar balança, abrir DevTools > Web Serial, capturar stream raw e documentar formato de pacote.

**Passo 3:** Parser implementado e testado com MockScaleProvider em staging antes da instalação.

**Formato esperado (hipótese — a confirmar):**
```
[STX] [peso em gramas, 6 dígitos ASCII] [unidade] [CR] [LF]
ex: \x02 000500 g \r\n  →  500 gramas
```

---

## 7. Fechamento Automático de Turnos

### 7.1 Edge Function: `close-shift`

**Localização:** `supabase/functions/close-shift/index.ts`

**Cron:** `0 16,23 * * *` (16h e 23h, horário de Brasília — `America/Sao_Paulo`)

**Lógica:**
```
1. Para cada location ativa:
   a. Buscar turno com status = 'open'
   b. Se não houver turno aberto → log e skip
   c. Calcular totais: SUM(amount) GROUP BY payment_method
   d. Atualizar shift: closed_at, closed_by='auto', status='closed', totais snapshot
   e. Log do fechamento
2. Retornar sumário de execução
```

**Configuração em `supabase/config.toml`:**
```toml
[functions.close-shift]
schedule = "0 16,23 * * *"
timezone = "America/Sao_Paulo"
```

### 7.2 Abertura de Turno

Turnos são abertos **manualmente pelo operador** ao iniciar o expediente (botão "Iniciar Turno" no PDV). Não há abertura automática — garante que o operador confirme presença antes de começar.

---

## 8. Protocolo Offline + Reconciliação de Turno

### 8.1 Fluxo Normal (online)

```
Venda confirmada
  → Gera UUID v4 local
  → POST imediato para Supabase (sales table)
  → Se 200 OK: venda concluída
  → Se erro de rede: fallback para fila offline
```

### 8.2 Fluxo Offline

```
Venda confirmada (sem internet)
  → Gera UUID v4 local
  → Salva em Dexie.js com { synced: false, created_offline: true }
  → UI mostra badge "Offline — N vendas pendentes"
```

### 8.3 Sync ao Reconectar

```
Evento 'online' disparado
  → syncStore.drainQueue() executa:
     1. Busca vendas com synced: false no Dexie
     2. Para cada venda, verifica soft-close (passo 8.4)
     3. POST batch para Edge Function 'sync-sales'
     4. Backend reconcilia timestamps (passo 8.5)
     5. Se 200 OK: marca synced: true no Dexie
     6. Se 409 Conflict: venda já existe → marca synced: true (idempotente)
```

### 8.4 Soft-Close (Frontend — Linha de Defesa 1)

```typescript
// syncStore.checkShiftBoundary() — executado a cada minuto quando offline
const SHIFT_BOUNDARIES = [{ hour: 16, minute: 0 }, { hour: 23, minute: 0 }]

function checkShiftBoundary() {
  if (!isOnline && activeShift?.status === 'open') {
    const now = new Date()
    const boundary = SHIFT_BOUNDARIES.find(b =>
      now.getHours() === b.hour && now.getMinutes() >= b.minute
    )
    if (boundary) {
      // Cria turno provisório no Dexie
      createProvisionalShift()
      // Notifica operador
      showNotification('Turno encerrado automaticamente. Novo turno iniciado.')
    }
  }
}
```

Durante o sync, turno provisório é enviado primeiro → Supabase retorna o `shift_id` real → vendas do turno provisório são atualizadas com o ID real antes do POST.

### 8.5 Reconciliação de Timestamp (Backend — Linha de Defesa 2)

**Edge Function: `sync-sales`**

```
Para cada venda recebida no batch:
  1. Buscar turno associado (shift_id informado)
  2. Se turno está fechado E sale.created_at > shift.closed_at:
     → Encontrar turno correto: SELECT id FROM shifts
       WHERE location_id = sale.location_id
       AND opened_at <= sale.created_at
       AND (closed_at IS NULL OR closed_at > sale.created_at)
       ORDER BY opened_at DESC LIMIT 1
     → Reatribuir sale.shift_id = turno_correto.id
     → Marcar sale.sync_reconciled = true
  3. UPSERT a venda (ON CONFLICT (id) DO UPDATE)
  4. Recalcular snapshot de totais dos turnos afetados
```

---

## 9. Dashboard — Arquitetura de Dados

### 9.1 Queries Principais

```sql
-- Vendas de hoje por método (com filtro de turno e local)
SELECT payment_method, SUM(amount) as total, COUNT(*) as count
FROM sales
WHERE location_id = $1
  AND created_at >= CURRENT_DATE
  AND ($2::uuid IS NULL OR shift_id = $2)  -- filtro turno opcional
GROUP BY payment_method

-- Ticket médio do dia
SELECT AVG(amount) FROM sales
WHERE location_id = $1 AND created_at >= CURRENT_DATE

-- Vendas por hora (pico de movimento)
SELECT DATE_TRUNC('hour', created_at) as hour, COUNT(*), SUM(amount)
FROM sales
WHERE location_id = $1 AND created_at >= CURRENT_DATE
GROUP BY hour ORDER BY hour
```

### 9.2 React Query Config

```typescript
const dashboardConfig = {
  refetchInterval: 45_000,      // 45 segundos
  staleTime: 30_000,            // considera fresh por 30s
  refetchOnWindowFocus: true,   // atualiza quando dono volta para a aba
}
```

---

## 10. Autenticação e Segurança

### 10.1 Fluxo de Login

```
1. Supabase Auth: email + senha
2. JWT emitido com sub = user_id
3. Frontend busca user_profiles para obter role + location_id
4. Zustand persiste perfil na session (não em localStorage)
5. React Router verifica role em cada rota protegida
```

### 10.2 Segurança em Camadas

| Camada | Mecanismo |
|--------|-----------|
| Autenticação | Supabase Auth (JWT, bcrypt) |
| Autorização de rota | React Router (client-side, UI only) |
| Autorização de dados | RLS no PostgreSQL (server-side, enforced) |
| Staff ≠ cross-location | `location_id` na RLS — staff só vê dados do próprio local |

> **Princípio:** Client-side route protection é UX, não segurança. A segurança real está no RLS.

---

## 11. Configuração Multi-Location (Fase 1 → Fase 2)

### Fase 1 (implementação atual)
- Uma `location` ativa no banco
- Dashboard sem seletor de local (desnecessário com um local)
- Admin criado manualmente no Supabase

### Fase 2 (segundo local — zero migration)
- Inserir novo registro em `locations`
- Criar usuários staff com `location_id` do novo local
- Dashboard ganha filtro de local no header
- RLS já protege automaticamente — staff do Local 2 não vê dados do Local 1

**Custo de adicionar o segundo local: ~2h de trabalho** (sem migration de schema).

---

## 12. Estrutura de Arquivos do Projeto

```
acai-mix/
├── src/
│   ├── components/
│   │   ├── ui/              — Shadcn components
│   │   ├── pdv/             — PDV específicos (WeightDisplay, PaymentSelector, etc.)
│   │   └── dashboard/       — Dashboard específicos (MetricCard, SalesChart, etc.)
│   ├── hooks/
│   │   └── useScale.ts      — IScaleProvider lifecycle
│   ├── providers/
│   │   ├── scale/
│   │   │   ├── IScaleProvider.ts
│   │   │   ├── MockScaleProvider.ts
│   │   │   ├── SerialScaleProvider.ts
│   │   │   └── ManualInputProvider.ts
│   │   └── sync/
│   │       └── DexieDatabase.ts
│   ├── stores/
│   │   ├── scaleStore.ts
│   │   ├── saleStore.ts
│   │   ├── shiftStore.ts
│   │   └── syncStore.ts
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── POSPage.tsx
│   │   ├── DashboardPage.tsx
│   │   └── SettingsPage.tsx
│   ├── router/
│   │   ├── index.tsx
│   │   └── ProtectedRoute.tsx
│   ├── lib/
│   │   ├── supabase.ts      — cliente Supabase
│   │   └── queries.ts       — React Query query functions
│   └── types/
│       └── index.ts         — tipos compartilhados
├── supabase/
│   ├── functions/
│   │   ├── close-shift/index.ts
│   │   └── sync-sales/index.ts
│   ├── migrations/          — DDL (@data-engineer)
│   └── config.toml
└── docs/
    ├── architecture/
    │   └── acaipro-system-design.md  (este arquivo)
    └── prd/
        └── acaipro-prd-v1.md         (@pm)
```

---

## 13. Riscos e Mitigações

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| Conflito offline + auto-close de turno | **CRÍTICO** | Soft-close no frontend + reconciliação por timestamp no backend |
| Falha de hardware da balança | **HIGH** | ManualInputProvider como fallback imediato |
| Web Serial API não disponível | **HIGH** | Requisito de hardware documentado: Chrome/Edge desktop obrigatório |
| Protocolo serial UPX Wind D3 desconhecido | **MEDIUM** | IScaleProvider abstraction; MockScaleProvider no desenvolvimento; parser validado na instalação |
| Duplicata de venda no sync | **LOW** | UUID v4 gerado no cliente + UPSERT ON CONFLICT no backend |
| NF-e / Cupom fiscal | **RISK** | Fora do escopo Fase 1. Registrado como risco legal. Verificar regime tributário do cliente antes do go-live. |

---

## 14. Requisitos de Hardware e Ambiente

| Requisito | Especificação |
|-----------|---------------|
| Dispositivo de caixa | PC com Chrome 89+ ou Edge 89+ (Web Serial API) |
| Sistema operacional | Windows 10+ ou Linux (Web Serial API nativa) |
| Conexão | Fibra recomendada; funciona offline com restrições documentadas |
| Balança | UPX Wind D3 com cabo Serial-USB |
| Acesso do Admin | Qualquer dispositivo com browser moderno (dashboard responsivo) |

---

## 15. Briefing para @data-engineer

**Campos críticos a implementar:**

- `sales.weight_source: TEXT CHECK ('scale' | 'manual')` — auditoria
- `sales.sync_reconciled: BOOLEAN DEFAULT false` — tracking de reconciliação
- `sales.created_offline: BOOLEAN DEFAULT false` — tracking offline

**Edge Cases de RLS:**
- Staff não pode ver vendas de outros locations
- Staff não pode alterar shifts (apenas criar sales e ler turno ativo)
- Admin pode ver/modificar tudo da própria instalação

**Índices críticos:**
- `sales(shift_id, created_at)` — queries do dashboard
- `sales(location_id, created_at)` — filtros por local
- `shifts(location_id, status)` — busca de turno ativo

**Constraint de integridade:**
- Impedir `INSERT INTO sales` sem `shift_id` de um turno com `status = 'open'` (exceto vendas marcadas como `created_offline = true`, que passam pela reconciliação)

---

*Documento gerado por Aria (Architect) — AçaiMix System Design v1.0*  
*Próximo: `docs/prd/acaipro-prd-v1.md` por Morgan (PM)*
