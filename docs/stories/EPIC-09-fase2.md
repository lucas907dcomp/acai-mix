# EPIC-09 — Fase 2: Exportação, Histórico e Cancelamento de Vendas

**ID:** EPIC-09 | **Phase:** 2 (pós-MVP em produção)
**Created:** 2026-05-20 | **Owner:** @pm (Morgan)
**Status:** Draft — aguardando aprovação para sharding em stories
**Predecessor Epics:** EPIC-01..08 (Fase 1, em produção)

---

## 1. Visão Geral

A Fase 1 do AçaíPro está em produção com PDV completo (pesagem serial + modo manual), turnos com fechamento automático, offline sync via Dexie e dashboard financeiro. A operação da loja, após algumas semanas de uso real, expôs três lacunas que limitam o trabalho administrativo e a correção de erros operacionais — **mas que não justificam refactor estrutural**. A Fase 2 entrega exatamente essas três capacidades, em ordem de prioridade:

1. **Exportação CSV de vendas** — permite ao administrador levar os dados para fora do sistema (contador, planilhas próprias, conciliação bancária).
2. **Histórico de Vendas (admin)** — visibilidade auditável de todas as vendas, com filtros e distinção visual de canceladas.
3. **Cancelamento de Venda** — correção de erros operacionais (peso errado, método de pagamento equivocado, venda duplicada) com integridade financeira preservada.

### 1.1. Objetivos de Negócio

- **Reduzir fricção administrativa**: hoje o dono precisa pedir suporte técnico ou exportar via SQL para conciliar. Exportação self-service.
- **Auditabilidade**: dar visibilidade completa do histórico, incluindo cancelamentos, para reconciliação com extratos PIX/cartão.
- **Corrigir erros sem perda de integridade**: cancelar uma venda errada não deve corromper totais de turno nem o dashboard.

### 1.2. Fora de Escopo (NÃO entram nesta Fase)

- Edição de venda (apenas cancelamento)
- Estorno automático de PIX/cartão (cancelamento é apenas lógico; estorno bancário é manual)
- Relatórios PDF, gráficos avançados, comparativos
- Cancelamento de turno
- Exportação em formato Excel (.xlsx) — apenas CSV
- Multi-loja / multi-tenant (continua single-tenant)
- Cancelamento por staff (admin only nesta fase)

---

## 2. Features

### 2.1. Tabela de Features (MoSCoW + Esforço + Dependências)

| ID | Feature | MoSCoW | Esforço | Dependências | Risco |
|----|---------|--------|---------|--------------|-------|
| F1 | Exportação CSV (Dashboard) | **Must** | 5-8 pts (1 story) | Nenhuma técnica (dados já existem em `sales`) | Baixo |
| F2 | Histórico de Vendas (página `/sales-history`) | **Must** | 13-20 pts (2-3 stories) | Nenhuma (lê de `sales`) | Baixo-Médio (paginação + filtros) |
| F3 | Cancelamento de Venda | **Must** | 13-20 pts (2-3 stories) | F2 (UI do histórico), turno ativo (EPIC-05), Dashboard (EPIC-07) | **Alto** (afeta totais financeiros, dashboard e turno) |

**Esforço total estimado:** 31-48 story points (≈ 1 a 1.5 sprints de 2 semanas).

**Ordem de entrega recomendada:** F1 → F2 → F3. F1 é independente e rápido (valor imediato). F2 prepara a UI onde o cancelamento de F3 vai operar (reuso). F3 é o mais arriscado e deve sair por último, depois que F2 estiver estabilizado.

### 2.2. F1 — Exportação CSV

**O quê:** Botão "Exportar CSV" no Dashboard que baixa as vendas do período/filtro atualmente selecionado.

**Critérios de aceite de alto nível:**

- **AC-F1.1** Botão visível no Dashboard, ao lado dos filtros de período (hoje/semana/mês ou intervalo customizado).
- **AC-F1.2** O CSV gerado contém as vendas filtradas pelo mesmo período do dashboard, **com as canceladas incluídas** (mas com status marcado), para que o admin tenha rastro completo.
- **AC-F1.3** Colunas, na ordem: `data_hora` (ISO 8601 local com TZ), `peso_g` (inteiro em gramas), `preco_por_grama_brl` (decimal 4 casas), `valor_brl` (decimal 2 casas), `metodo_pagamento` (`PIX` | `CARTAO` | `DINHEIRO`), `status` (`COMPLETED` | `CANCELLED`).
- **AC-F1.4** Encoding **UTF-8 com BOM** (para abrir corretamente no Excel BR sem corromper acentos).
- **AC-F1.5** Separador `;` (vírgula é o separador decimal pt-BR).
- **AC-F1.6** Cabeçalho em pt-BR: `Data/Hora;Peso (g);Preço/g (R$);Valor (R$);Pagamento;Status`.
- **AC-F1.7** Nome do arquivo: `acaipro-vendas-{YYYY-MM-DD}-a-{YYYY-MM-DD}.csv`.
- **AC-F1.8** Geração 100% **client-side** (Blob + `URL.createObjectURL`) — sem chamada extra ao Supabase além da query já feita pelo dashboard.
- **AC-F1.9** Acessível para **admin e staff** (sem proteção adicional além de autenticação).
- **AC-F1.10** Se não houver vendas no período: botão desabilitado com tooltip "Sem vendas no período".

**Não-funcionais:**
- Performance: até 5.000 linhas geradas em < 500ms no navegador.

---

### 2.3. F2 — Histórico de Vendas

**O quê:** Nova página `/sales-history` (admin only) com tabela paginada, filtros e distinção visual entre vendas normais e canceladas.

**Critérios de aceite de alto nível:**

- **AC-F2.1** Rota `/sales-history` protegida: redireciona para `/` se o usuário não for `role: 'admin'`.
- **AC-F2.2** Item no menu de navegação visível **apenas para admin**.
- **AC-F2.3** Tabela com colunas: Data/Hora, Peso, Valor, Método de Pagamento, Status, Ações (botão "Cancelar" quando aplicável — ver F3).
- **AC-F2.4** **Paginação server-side**: 50 linhas por página, com controles "Anterior" / "Próximo" e contador "Página X de Y".
- **AC-F2.5** **Filtros**:
  - Intervalo de datas (date pickers `de` / `até`, defaults: últimos 7 dias).
  - Método de pagamento (multi-select: PIX, Cartão, Dinheiro; default: todos selecionados).
  - Status (multi-select: COMPLETED, CANCELLED; default: ambos).
- **AC-F2.6** **Vendas canceladas** exibidas com: linha em cor cinza/atenuada + badge "Cancelada" + valor em texto riscado (line-through).
- **AC-F2.7** Ordenação default: data/hora descendente (mais recente primeiro).
- **AC-F2.8** Estado vazio: ilustração + texto "Nenhuma venda encontrada com os filtros selecionados".
- **AC-F2.9** Loading skeleton enquanto carrega.
- **AC-F2.10** Os filtros persistem nos query params da URL (deep-link compartilhável).

**Não-funcionais:**
- Query paginada deve usar `range()` do Supabase com índice em `sales.created_at` e `sales.status` (validar com @data-engineer se índice composto é necessário).

---

### 2.4. F3 — Cancelamento de Venda

**O quê:** Cancelamento lógico (soft) de uma venda. Pode ser disparado de dois lugares — `ShiftSalesTable` no PDV (turno ativo) e `SalesHistoryTable` em `/sales-history` — **sempre admin only** e **sempre restrito a vendas do turno ativo**.

**Critérios de aceite de alto nível:**

- **AC-F3.1** Botão "Cancelar" visível **apenas para admin** em cada linha de venda.
- **AC-F3.2** Botão habilitado **somente se** `sale.shift_id === active_shift.id` E `sale.status === 'COMPLETED'`. Caso contrário, botão desabilitado com tooltip explicando o motivo:
  - "Apenas vendas do turno ativo podem ser canceladas"
  - "Esta venda já está cancelada"
- **AC-F3.3** Ao clicar, abrir **dialog de confirmação** com:
  - Título: "Cancelar venda?"
  - Resumo da venda: data/hora, peso, valor, método de pagamento.
  - Mensagem: "Esta ação não pode ser desfeita. A venda será marcada como cancelada e removida dos totais do turno e do dashboard."
  - Botões: "Voltar" (default focus) e "Confirmar cancelamento" (destructive style).
- **AC-F3.4** Confirmação executa **soft-delete** no banco:
  - `sales.status = 'CANCELLED'`
  - `sales.cancelled_at = NOW()`
  - `sales.cancelled_by = auth.uid()`
  - **A linha NÃO é deletada** (rastro auditável preservado).
- **AC-F3.5** Após sucesso:
  - Toast de confirmação verde.
  - `ShiftSalesTable` atualiza imediatamente (React Query invalidate).
  - Totais do turno (subtotal, total por método de pagamento) recalculados — **sem incluir** a venda cancelada.
  - Dashboard, ao ser próxima vez renderizado/refetched, **exclui** vendas com `status='CANCELLED'` de todas as métricas.
- **AC-F3.6** A política RLS do Supabase deve permitir `UPDATE` em `sales` apenas para `role='admin'` E apenas quando a venda pertence ao turno ativo. Validar com @data-engineer.
- **AC-F3.7** Se a venda foi feita **offline** e ainda não sincronizou (`pending_sales` no Dexie), o cancelamento:
  - **Opção A (preferida):** remove diretamente da fila local sem sincronizar — venda nunca chega ao Supabase.
  - **Opção B (fallback):** marca como `cancelled` localmente e sincroniza com `status='CANCELLED'` desde o início.
  - **Decisão de produto:** confirmar com @architect antes da story. Default sugerido: Opção A se for tecnicamente seguro.
- **AC-F3.8** Edge case: se o turno fechar (manual ou automático às 16h/23h) **entre** a abertura do dialog e a confirmação, o cancelamento deve falhar com mensagem clara: "O turno foi fechado. Não é mais possível cancelar esta venda."
- **AC-F3.9** Auditoria mínima: gravar em log/tabela `sales_audit` (ou campo no próprio sale) quem cancelou e quando.

**Não-funcionais:**
- Operação deve ser **idempotente**: cancelar uma venda já cancelada não muda nada e exibe toast informativo, não erro.
- Operação deve ser **transacional**: se o `UPDATE` falhar, totais não devem ficar dessincronizados (React Query rollback no `onError`).

---

## 3. Riscos e Restrições

### 3.1. Riscos Críticos (foco F3)

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | Cancelamento incluído indevidamente nos totais → dashboard mostra dado errado para o dono | Média | **Crítico** (decisão de negócio com base em dado errado) | Toda query de métricas do dashboard DEVE filtrar `status='COMPLETED'`. Adicionar testes de regressão. Validar manualmente em todos os 4 cards (hoje/semana/mês/breakdown) antes do release. |
| R2 | Cancelar venda offline corrompe drain queue ao reconectar | Média | **Alto** | Definir AC-F3.7 (Opção A vs B) com @architect. Adicionar testes de integração para o cenário "venda offline → cancelada offline → reconecta". |
| R3 | Race condition: turno fecha automaticamente (16h/23h) enquanto admin confirma cancelamento | Baixa-Média | **Médio** | AC-F3.8 cobre via validação server-side no UPDATE. RLS policy DEVE incluir cheque de turno ativo. |
| R4 | RLS policy de UPDATE em `sales` mal escrita causa recursão (vide gotcha conhecido) | Média | **Alto** | Usar função `SECURITY DEFINER` `is_admin()` + `is_active_shift(shift_id)`. Code review obrigatório com @data-engineer. |
| R5 | Histórico não pagina e carrega todas as vendas → timeout/crash em produção após 6 meses de uso | Baixa | **Médio** | AC-F2.4: paginação server-side desde o dia 1. Não usar `.select()` sem `.range()`. |
| R6 | CSV exportado com encoding errado abre com mojibake no Excel do contador | Baixa | **Médio** (perda de credibilidade) | AC-F1.4: UTF-8 **com BOM**. Testar manualmente no Excel pt-BR antes do release. |

### 3.2. Restrições Técnicas

- **Single-tenant**: nenhuma feature pode introduzir conceito de multi-loja sem decisão arquitetural separada.
- **Sem dependências novas**: F1 (CSV) deve ser implementado sem adicionar bibliotecas externas tipo PapaParse — implementação direta cabe em < 50 linhas. Confirmar com @architect se PapaParse for proposto.
- **Compatibilidade offline**: o cancelamento precisa funcionar **com pelo menos degradação aceitável** offline. Não pode quebrar o sync.
- **Performance**: histórico paginado deve abrir em < 1s para até 10.000 vendas históricas.

### 3.3. Restrições de Produto

- **Admin only** para F2 e F3. Staff continua sem visibilidade do histórico ou poder de cancelamento.
- **Cancelamento é definitivo** (não há "descancelar"). Se foi um erro, criar nova venda manual.
- **Cancelamento NÃO estorna PIX/cartão automaticamente**. Estorno bancário é responsabilidade manual do admin (fora do escopo).

---

## 4. Decisões de Produto Explícitas

Estas decisões já estão tomadas e devem ser respeitadas pelo SM/Architect ao destrinchar em stories:

| # | Decisão | Razão |
|---|---------|-------|
| D1 | F1 (CSV) é **client-side**, sem endpoint dedicado | Dados já chegam no dashboard via query existente; gerar no client evita carga adicional e mantém o Supabase Free tier. |
| D2 | F1 incluí canceladas no export, **com status marcado** | Admin precisa do rastro completo para conciliação. Pode filtrar no Excel. |
| D3 | F2 é **admin only** | Histórico expõe receita total e padrões; staff não precisa. Reduz superfície de risco. |
| D4 | F3 (cancelamento) é **admin only** | Operação financeira sensível. Staff ligará para admin se errar — fluxo já existe no comportamento atual da loja. |
| D5 | F3 é **soft-delete** (UPDATE status, não DELETE) | Auditoria, conformidade fiscal futura (NF-e), análise de "vendas problemáticas". |
| D6 | F3 só permite cancelar **vendas do turno ativo** | Vendas de dias passados estão consolidadas em relatórios diários (mesmo que informais); permitir alteração retroativa cria caos contábil. Se for crítico cancelar venda antiga, é uma exceção que justifica intervenção técnica manual. |
| D7 | Vendas canceladas **NÃO** aparecem no dashboard, **MAS aparecem** no histórico e no CSV | Dashboard é "estado atual da operação"; histórico/CSV são "auditoria". |
| D8 | Ordem de entrega: F1 → F2 → F3 | F1 é valor rápido independente; F2 prepara UI; F3 é alto risco e vai por último com base mais estável. |
| D9 | Nenhuma mudança no schema fora de `sales` (adicionar `cancelled_at`, `cancelled_by`, `status`) | Manter migration simples e reversível. Se `status` já existe e cobre, melhor ainda — validar com @data-engineer. |
| D10 | UI de cancelamento usa **dialog de confirmação** (não inline confirm, não swipe-to-cancel) | Padrão Shadcn já usado no projeto; reduz cliques acidentais. |

### 4.1. Decisões em Aberto (a resolver com @architect antes do sharding)

- **DA-1** Cancelamento de venda offline: Opção A (remove da fila) ou Opção B (sincroniza como CANCELLED)? — Default sugerido: A.
- **DA-2** Já existe coluna `status` em `sales` ou precisa migration? — Verificar com @data-engineer.
- **DA-3** Tabela `sales_audit` separada ou campos `cancelled_at`/`cancelled_by` no próprio `sales`? — Recomendação PM: campos no próprio `sales` (mais simples, suficiente para escala atual).

---

## 5. Definição de Pronto (Epic-level DoD)

A Fase 2 é considerada Done quando:

- [ ] F1, F2, F3 implementadas e cada uma com QA gate PASS ou CONCERNS.
- [ ] Dashboard validado manualmente: 4 métricas/cards excluem corretamente vendas canceladas.
- [ ] CSV testado em Excel pt-BR (Windows) sem mojibake.
- [ ] Cancelamento testado em 5 cenários: turno ativo / turno fechado / venda offline pendente / venda já cancelada / turno fecha durante confirmação.
- [ ] RLS policies revisadas por @data-engineer e testadas com usuário admin e staff.
- [ ] Testes de integração para F3 cobrem fluxo de cancelamento + recálculo de totais (vide [[feedback_testing_strategy]]).
- [ ] Documentação de usuário atualizada (mesmo que README curto) explicando: como exportar CSV, como acessar histórico, como cancelar venda.
- [ ] Nenhuma regressão em fluxo do PDV (vendas continuam fluindo no caixa rápido).

---

## 6. Próximos Passos (handoff)

1. **@architect (Aria)** — Avaliar decisões em aberto (DA-1, DA-2, DA-3) e produzir nota técnica curta antes do sharding.
2. **@data-engineer (Dara)** — Validar schema atual de `sales` (existe `status`? existe índice em `created_at`?), propor migration mínima e desenhar RLS policy de UPDATE com função `SECURITY DEFINER`.
3. **@sm (River)** — Após decisões de @architect e @data-engineer, fazer sharding deste epic em stories individuais (provisão: 5-7 stories — 1 para F1, 2-3 para F2, 2-3 para F3).
4. **@po (Pax)** — Validar cada story com o checklist de 10 pontos.
5. **@dev (Dex)** — Executar na ordem F1 → F2 → F3, com testes incluídos desde a primeira story (EPIC-04+ rule).

---

## Change Log

| Data | Quem | Ação |
|------|------|------|
| 2026-05-20 | @pm (Morgan) | Criação do EPIC-09 com 3 features priorizadas, 10 decisões de produto, 6 riscos mapeados. Status: Draft. |
