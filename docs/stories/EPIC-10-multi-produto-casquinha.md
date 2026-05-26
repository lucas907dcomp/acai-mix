# EPIC-10 — Catálogo Multi-Produto e Adicional Casquinha

**ID:** EPIC-10 | **Phase:** 3 (expansão pós-Fase 2)
**Created:** 2026-05-26 | **Owner:** @pm (Morgan)
**Status:** Draft — aguardando aprovação para sharding em stories
**Predecessor Epics:** EPIC-01..08 (Fase 1, em produção), EPIC-09 (Fase 2 — Exportação/Histórico/Cancelamento)

---

## 1. Visão Geral

A operação do AçaiMix hoje vende **um único produto: açaí por peso**. Após algumas semanas de uso real do PDV, o dono da loja levantou duas necessidades de negócio que travam o fluxo do caixa e geram registro paralelo (caderno, anotações soltas, vendas "fora do sistema"):

1. **Adicional Casquinha (+R$1,00)** — uma boa parte das vendas de açaí/sorvete por peso vêm acompanhadas de casquinha. Hoje o operador soma R$1 mentalmente, o que gera erros de cobrança e perde o registro do upsell.
2. **Catálogo multi-produto** — a loja também vende **picolé, água, refrigerante (guaraná, coca-cola), sorvete por unidade**, etc. Todos esses produtos hoje são vendidos por fora do PDV (caderno), o que destrói a integridade do dashboard, do fechamento de turno e do histórico.

A Fase 3 entrega exatamente essas duas capacidades, mantendo **backward compatibility total** com as vendas de açaí por peso já existentes em produção.

### 1.1. Objetivos de Negócio

- **Capturar 100% do faturamento no PDV** — eliminar o caderno paralelo de produtos avulsos. Cada real vendido deve passar pelo sistema.
- **Registrar o upsell de casquinha** — saber quantas casquinhas saíram por dia/semana/mês é informação valiosa para o dono (custeio, projeção, decisão de comprar mais cones).
- **Histórico e dashboard fiéis ao real** — quando o dono olhar a receita do dia, deve ver TODA a receita, separada por produto.
- **Manter velocidade do caixa** — o fluxo de açaí por peso (operação dominante) NÃO pode ficar mais lento. Multi-produto é fluxo paralelo, não obrigatório.

### 1.2. Fora de Escopo (NÃO entram nesta Fase)

- **Estoque/inventário** — produtos avulsos não controlam saldo. Vender "água" não decrementa estoque (decisão explícita: o dono não quer essa fricção ainda).
- **Variações de produto** — picolé não tem "sabor" como atributo estruturado. Se necessário, registrar como produtos separados ("Picolé Morango", "Picolé Chocolate").
- **Combos / produtos compostos** — vender "açaí + casquinha + água" como combo único. Casquinha é tratada como toggle no açaí; outros produtos entram em vendas separadas.
- **Promoções / descontos por produto** — preço unitário é fixo. Sem cupons, sem "compre 2 leve 3".
- **Múltiplos preços por produto** — `unit_price` é único. Sem preço por horário, sem preço por cliente.
- **Casquinha como produto avulso** — casquinha é **adicional do açaí por peso**, não um item de catálogo. (Se o dono quiser vender casquinha solta no futuro, será via produto unit normal.)
- **Edição de venda multi-produto** — se errar o produto, cancela e refaz (usa EPIC-09).
- **Carrinho com múltiplos itens em uma só venda** — cada venda continua sendo um item (um produto). Vender 2 picolés diferentes = 2 vendas. Decisão explícita: manter modelo "1 sale = 1 line" para preservar compatibilidade com `sales` atual e simplificar offline sync.

---

## 2. Features

### 2.1. Tabela de Features (MoSCoW + Esforço + Dependências)

| ID | Feature | MoSCoW | Esforço | Dependências | Risco |
|----|---------|--------|---------|--------------|-------|
| F1 | Casquinha (+R$1,00 toggle no PDV açaí) | **Must** | 5-8 pts (1 story) | Migration `has_casquinha` (parte mínima de F2) | Baixo |
| F2 | Migration de schema multi-produto (`products`, `sales`) | **Must** | 8-13 pts (1 story) | Nenhuma | **Alto** (DB em produção, backward compat) |
| F3 | Cadastro admin de produtos avulsos (CRUD em Settings) | **Must** | 8-13 pts (1 story) | F2 | Baixo-Médio |
| F4 | PDV multi-produto (seletor de produto + fluxo unitário) | **Must** | 13-20 pts (1-2 stories) | F2, F3 | **Alto** (mexe no fluxo principal do caixa) |
| F5 | Histórico e Dashboard por produto | **Should** | 8-13 pts (1 story) | F2, F4 (precisa ter vendas multi-produto para visualizar) | Médio |

**Esforço total estimado:** 42-67 story points (≈ 1.5 a 2 sprints de 2 semanas).

**Ordem de entrega recomendada:** F2 → (F1 + F3 em paralelo) → F4 → F5.

- **F2 vai primeiro** porque é pré-requisito de schema para todo o resto. Migration isolada, reversível, antes de qualquer UI tocar produtos.
- **F1 (Casquinha)** depende apenas da coluna `has_casquinha` (parte de F2). É **independente** de F3/F4 e pode ser desenvolvida em paralelo após F2.
- **F3 (CRUD admin)** depende de F2 mas não bloqueia F1. Faz seeds dos primeiros produtos avulsos (picolé, água, refri) antes de F4 começar.
- **F4 (PDV multi-produto)** é o mais arriscado: precisa redesenhar entrada do PDV sem quebrar o fluxo açaí. Depende de F2 + F3 estarem estáveis.
- **F5 (Dashboard/Histórico por produto)** sai por último porque só ganha valor com volume de vendas multi-produto em produção.

### 2.2. F1 — Casquinha (+R$1,00 toggle no PDV)

**Story:** `Story 10.1 — Adicional Casquinha no PDV de Açaí por Peso`

**O quê:** Um toggle visual no PDV (na tela de venda de açaí por peso) que, quando ativado, soma R$1,00 ao valor final da venda e marca a venda com `has_casquinha = true`.

**Critérios de aceite de alto nível:**

- **AC-F1.1** No PDV, na tela de venda de açaí por peso, exibir um **toggle/checkbox/switch** rotulado "Casquinha (+R$ 1,00)" próximo ao botão de confirmação da venda.
- **AC-F1.2** Estado default do toggle: **desligado** a cada nova venda (não persiste entre vendas — toggle volta a `false` após confirmar/cancelar).
- **AC-F1.3** Quando o toggle está ligado, o **valor exibido em tela** já reflete `(peso_g * price_per_gram) + R$ 1,00`.
- **AC-F1.4** Ao confirmar a venda, gravar `sales.has_casquinha = true` e `sales.amount` deve incluir o R$ 1,00 do adicional.
- **AC-F1.5** O toggle está **disponível para admin e staff** (faz parte do fluxo normal de caixa).
- **AC-F1.6** Disponível **online e offline** — sync da venda inclui o flag.
- **AC-F1.7** Visualmente, quando ligado, o adicional deve ser visível também no resumo da venda (ex: "Açaí 300g R$ 21,00 + Casquinha R$ 1,00 = R$ 22,00") para evitar erro de cobrança.
- **AC-F1.8** O valor do adicional (`R$ 1,00`) é **constante hardcoded** nesta fase. Sem tela de configuração. Se o dono quiser mudar no futuro, abre nova story.
- **AC-F1.9** Funciona apenas para vendas de açaí (`product_type = 'weight'`). NÃO aparece no fluxo de produtos avulsos (F4).
- **AC-F1.10** Recibo/comprovante (se houver no fluxo atual) exibe a linha "Casquinha R$ 1,00".

**Não-funcionais:**
- Performance: toggle não pode adicionar latência perceptível ao fluxo de caixa (< 50ms para recálculo do total).

---

### 2.3. F2 — Migration de Schema Multi-Produto

**Story:** `Story 10.2 — Migration: schema multi-produto (products + sales)`

**O quê:** Migration Supabase que adiciona as colunas necessárias em `products` e `sales` para suportar produtos por unidade e o flag de casquinha, com **backward compatibility garantida** para todas as vendas e dados existentes.

**Critérios de aceite de alto nível:**

- **AC-F2.1** Migration adiciona em `products`:
  - `product_type TEXT NOT NULL DEFAULT 'weight'` com CHECK constraint `product_type IN ('weight', 'unit')`.
  - `unit_price NUMERIC(10,2) NULL` (nullable porque produtos do tipo `weight` não usam).
  - `sort_order INTEGER NOT NULL DEFAULT 0`.
- **AC-F2.2** Migration adiciona em `sales`:
  - `has_casquinha BOOLEAN NOT NULL DEFAULT false`.
  - `product_id UUID NULL REFERENCES products(id) ON DELETE RESTRICT` (nullable APENAS para retrocompat — toda venda nova DEVE ter `product_id`).
  - `quantity SMALLINT NOT NULL DEFAULT 1` (1 para açaí por peso; n para produtos avulsos).
- **AC-F2.3** **Data backfill**: toda venda existente em `sales` recebe `product_id` apontando para o produto açaí atual (o único `product_type='weight'` ativo da location). Validar que o backfill cobre 100% das linhas antes do COMMIT.
- **AC-F2.4** **Constraint de integridade**: `CHECK` em `sales` garantindo que:
  - Se `product.product_type = 'weight'`: `weight_grams IS NOT NULL` E `price_per_gram IS NOT NULL` E `quantity = 1`.
  - Se `product.product_type = 'unit'`: `weight_grams IS NULL` (ou 0) E `quantity >= 1` E `has_casquinha = false`.
  - (Implementar via trigger ou check function — definir com @data-engineer.)
- **AC-F2.5** Produto açaí existente é atualizado para `product_type = 'weight'`, `sort_order = 0`, `unit_price = NULL`. Sem deletar nada.
- **AC-F2.6** Índices novos:
  - `CREATE INDEX idx_products_location_type_sort ON products(location_id, product_type, sort_order, is_active)` — para query do PDV.
  - `CREATE INDEX idx_sales_product_id ON sales(product_id)` — para queries de dashboard por produto.
- **AC-F2.7** **RLS policies** atualizadas/criadas:
  - `products`: SELECT para todos autenticados da mesma location; INSERT/UPDATE/DELETE para `admin` apenas.
  - `sales`: políticas existentes continuam funcionando (filtro por `location_id` e `shift_id`).
- **AC-F2.8** **Trigger de fechamento de turno** revalidado: a função que totaliza vendas do turno deve usar `sales.amount` (que já inclui casquinha) e considerar `status = 'COMPLETED'`. Validar que o trigger não soma `weight_grams` indevidamente para produtos unit.
- **AC-F2.9** **Edge function `sync-sales`** atualizada para aceitar o payload com `has_casquinha`, `product_id`, `quantity`. Backward compat: payload antigo (sem esses campos) ainda funciona, com defaults aplicados server-side (`has_casquinha=false`, `product_id` resolvido como o açaí da location, `quantity=1`).
- **AC-F2.10** Migration é **reversível** (`down` migration testada): remove colunas adicionadas sem perder dados originais.
- **AC-F2.11** Aplicação em produção: rodar primeiro em ambiente de staging com cópia do dump real; só rodar em prod depois de validação do backfill.

**Não-funcionais:**
- Migration completa (incluindo backfill) deve rodar em < 10 segundos para um banco com até 100.000 vendas.
- Zero downtime: migrations devem ser `ADD COLUMN` (nullable ou com default), nunca `ALTER` destrutivo.

---

### 2.4. F3 — Cadastro Admin de Produtos Avulsos (CRUD)

**Story:** `Story 10.3 — CRUD admin de produtos avulsos em Settings`

**O quê:** Nova seção em **Settings** (admin only) para cadastrar, listar, editar e desativar produtos do tipo unitário (picolé, água, refri, sorvete por unidade, etc.).

**Critérios de aceite de alto nível:**

- **AC-F3.1** Nova aba/seção em `/settings`: "Produtos avulsos" (ou "Catálogo"), visível **apenas para admin**.
- **AC-F3.2** Lista de produtos exibe: nome, preço unitário (R$), status (ativo/inativo), `sort_order`. Ordenada por `sort_order` ASC, depois `name` ASC.
- **AC-F3.3** Botão "Novo produto" abre dialog/form com:
  - `name` (text, obrigatório, max 60 caracteres, único por location entre produtos `unit` ativos).
  - `unit_price` (number, obrigatório, > 0, max 2 casas decimais).
  - `sort_order` (number, opcional, default = max(sort_order)+10 da location).
  - `is_active` (boolean, default true).
- **AC-F3.4** Edição inline ou via dialog (a definir no design): permite alterar `name`, `unit_price`, `sort_order`, `is_active`.
- **AC-F3.5** **Não permite deletar** produto com vendas associadas (`ON DELETE RESTRICT` no FK). Em vez disso, oferece "Desativar" (`is_active = false`).
- **AC-F3.6** Produto com `is_active = false`:
  - Não aparece no PDV (F4).
  - Continua aparecendo no histórico (F5) com badge "Inativo" se queried.
  - Não pode ser editado direto — admin precisa reativar primeiro (ou via toggle).
- **AC-F3.7** O **produto açaí** (único com `product_type = 'weight'`) **NÃO aparece** nesta tela. Sua edição (preço/g) continua na tela de Settings existente. Esta tela é exclusivamente para `product_type = 'unit'`.
- **AC-F3.8** Validação: tentar criar produto com nome já existente (mesma location, ativo) retorna erro claro: "Já existe um produto com esse nome".
- **AC-F3.9** Audit log mínimo: gravar `created_at`, `updated_at` (campos do projeto padrão); identificar quem criou/editou via `created_by` / `updated_by` se a tabela já tiver, senão deixar para uma story futura.
- **AC-F3.10** Suporte a **drag-and-drop** ou inputs de `sort_order` para reordenar produtos. Decisão: começar com input numérico simples; drag-and-drop fica como melhoria futura. Confirmar com @ux-design-expert.
- **AC-F3.11** RLS: SELECT permitido a todos da location (PDV precisa ler); INSERT/UPDATE/DELETE apenas para admin (cobre AC-F2.7).

**Não-funcionais:**
- Tela deve abrir em < 500ms com até 200 produtos cadastrados.
- Validação client-side de duplicidade antes do submit (UX).

---

### 2.5. F4 — PDV Multi-Produto (Seletor + Fluxo Unitário)

**Story:** `Story 10.4 — PDV: seletor de produto e fluxo de venda unitária`

**O quê:** O PDV ganha uma camada de **seleção de produto antes da venda**. O fluxo padrão (açaí por peso) deve continuar sendo o **default visualmente dominante e zero-clique-extra**. Produtos unitários ficam acessíveis em uma área secundária.

**Critérios de aceite de alto nível:**

- **AC-F4.1** **Hierarquia visual do PDV (novo layout):**
  - Área principal (centro, ocupa maioria da tela): permanece o fluxo de açaí por peso (balança, peso, total, casquinha toggle, confirmar) — exatamente como hoje.
  - Área secundária (sidebar ou grid lateral): botões/cards dos produtos unitários ativos, ordenados por `sort_order`.
- **AC-F4.2** Clicar em um botão de produto unitário abre **fluxo paralelo** (modal ou painel):
  - Mostra nome, preço unitário, e um seletor de **quantidade** (default 1, min 1, max 99).
  - Mostra método de pagamento (PIX / Cartão Crédito / Cartão Débito / Dinheiro) — mesma UI já usada no fluxo açaí.
  - Botão "Confirmar venda" registra a venda e fecha o modal.
- **AC-F4.3** Venda unitária registrada gera **uma linha em `sales`** com:
  - `product_id` = produto selecionado.
  - `product_type` (via join) = 'unit'.
  - `weight_grams = NULL` ou `0`, `weight_source = 'NA'` ou `'manual'`.
  - `price_per_gram = NULL`.
  - `quantity = N` (selecionado pelo operador).
  - `amount = product.unit_price * quantity`.
  - `has_casquinha = false` (sempre, por constraint AC-F2.4).
  - `status = 'COMPLETED'`.
- **AC-F4.4** Multiprodutos = múltiplas vendas: se o operador quiser vender "1 picolé + 1 água", são **2 confirmações separadas** (= 2 linhas em `sales`). Justificativa: simplifica offline sync e modelo de turno; explicitamente fora de escopo (1.2).
- **AC-F4.5** Fluxo do açaí (área principal) **continua atalho-zero**: pesar + confirmar. NÃO pode ganhar nenhum step extra por causa do multi-produto.
- **AC-F4.6** Funciona **online e offline** — venda unitária entra na fila Dexie igual à venda por peso, com o payload novo (`product_id`, `quantity`, `has_casquinha=false`).
- **AC-F4.7** Disponível para **admin e staff** (operação normal de caixa).
- **AC-F4.8** Se a location não tiver nenhum produto unitário ativo, a área secundária mostra estado vazio amigável: "Nenhum produto avulso cadastrado. Peça ao administrador para cadastrar em Settings."
- **AC-F4.9** **Edge case**: produto é desativado ENQUANTO está visível no PDV (admin alterando em paralelo). Ao clicar, exibir toast "Este produto foi desativado. Recarregando catálogo..." e refetch da lista.
- **AC-F4.10** Cards/botões de produtos unitários mostram nome + preço unitário (`R$ X,XX`). Sem imagens nesta fase (definição explícita para reduzir escopo). UI deve ser legível em touch screen com dedo.
- **AC-F4.11** Recibo/comprovante (se houver) reflete corretamente: para venda unitária, exibir "Produto: {nome}, Qtd: {N}, Total: R$ {amount}".

**Não-funcionais:**
- Render do PDV com até 30 produtos unitários ativos deve manter < 100ms de first paint.
- Confirmar venda unitária (online): commit em < 1s; offline: instantâneo.

---

### 2.6. F5 — Dashboard e Histórico por Produto

**Story:** `Story 10.5 — Dashboard e histórico por produto`

**O quê:** Adicionar visibilidade **por produto** no Dashboard (admin) e no Histórico de Vendas (admin, vindo da EPIC-09).

**Critérios de aceite de alto nível:**

- **AC-F5.1** **Dashboard**: novo card/seção "Vendas por produto" mostrando, para o período filtrado:
  - Tabela com colunas: Produto, Qtd vendida, Receita (R$), % do total.
  - Linhas ordenadas por receita DESC.
  - Linha agregada "Casquinhas (adicional)" mostrando quantas vendas tiveram `has_casquinha=true` e a receita extra de R$ 1,00 por unidade.
- **AC-F5.2** Cards existentes do dashboard (receita do dia/semana/mês) **continuam corretos**: somam `sales.amount` (que já inclui casquinha) de vendas `COMPLETED`. Validar que não há regressão.
- **AC-F5.3** **Histórico de Vendas** (página `/sales-history` da EPIC-09): coluna "Produto" adicionada à tabela (entre "Data/Hora" e "Peso"). Para vendas de açaí, mostra o nome do produto açaí. Para vendas unitárias, mostra nome do produto + `(x N)` se quantity > 1.
- **AC-F5.4** **Histórico**: novo filtro "Produto" (multi-select, todos selecionados por default). Lista produtos ativos + inativos com vendas no período.
- **AC-F5.5** **Histórico**: coluna "Peso" passa a exibir `—` (em branco) para vendas unitárias (que não têm peso). UI deve ser robusta a peso nulo.
- **AC-F5.6** **CSV de exportação** (vindo da EPIC-09): adiciona colunas `produto` (nome do produto), `tipo_produto` (`peso` | `unidade`), `quantidade`, `tem_casquinha` (`sim` | `nao`). Ordem das colunas atualizada com cuidado para não quebrar planilhas existentes do contador — preferir **adicionar ao final** das colunas atuais.
- **AC-F5.7** **Métricas de turno** (fechamento de turno e tela de turno ativo): subtotal por método de pagamento continua igual. Adicionar opcionalmente um breakdown "Por produto" no resumo de fechamento (definir com @ux-design-expert se cabe ou fica para depois).
- **AC-F5.8** **Vendas canceladas** (EPIC-09): continuam excluídas do dashboard, mas aparecem no histórico e CSV. Filtro de produto não muda esse comportamento.
- **AC-F5.9** **Performance**: a query agregada do dashboard "Vendas por produto" para um período de 30 dias com até 30.000 vendas deve responder em < 500ms. Usar índice `idx_sales_product_id` (AC-F2.6) e considerar materialização se ficar lento.
- **AC-F5.10** **Acesso**: dashboard e histórico continuam admin only (como hoje + EPIC-09).

**Não-funcionais:**
- Mudanças em queries existentes do dashboard NÃO podem aumentar latência atual em mais de 20%. Validar com benchmark antes/depois.

---

## 3. Riscos e Restrições

### 3.1. Riscos Críticos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | **Migration F2 corrompe vendas existentes** (backfill incompleto ou tipo errado) | Baixa-Média | **Crítico** (perda de receita reportada) | AC-F2.10 (migration reversível), AC-F2.11 (testar em staging com dump real). Code review obrigatório com @data-engineer. Backup explícito do DB de produção antes do apply. |
| R2 | **Vendas offline em produção quebram após F2** porque o cliente antigo (PWA cacheado) manda payload sem `product_id` / `has_casquinha` | **Alta** | **Alto** (perda de venda no caixa) | Edge function `sync-sales` (AC-F2.9) DEVE aceitar payload antigo e aplicar defaults server-side. Adicionar testes de regressão com payloads antigos. Validar com @data-engineer + @dev antes do release. |
| R3 | **Trigger de fechamento de turno soma errado** após F2 (ex: tenta agregar `weight_grams` em venda unitária) | Média | **Alto** (totais de turno errados) | AC-F2.8: revisar trigger explicitamente. Adicionar teste de integração com mix de vendas peso+unidade no mesmo turno. |
| R4 | **RLS recursão** em policies de `products` (vide gotcha histórico de RLS no projeto) | Média | **Alto** (PDV trava porque não lê catálogo) | Usar função `SECURITY DEFINER` para checar admin, evitar policies que consultam outras tabelas em loop. Code review com @data-engineer. |
| R5 | **F4 quebra fluxo do açaí** (operador no caixa fica perdido com o novo layout) | Média | **Alto** (loja para de vender enquanto reaprende) | Validação UX com @ux-design-expert ANTES do dev. Hierarquia visual: açaí domina a tela (AC-F4.1, AC-F4.5). Treinamento curto do operador no dia do release. Considerar feature flag para liberar gradualmente. |
| R6 | **Dashboard de "vendas por produto" lento** com 6 meses de dados acumulados | Média | **Médio** | AC-F5.9: definir índice + benchmark antes do release. Plano B: materialized view com refresh por hora. |
| R7 | **Casquinha registrada como produto avulso por engano** (operador confunde toggle com botão) | Baixa | **Médio** (dado sujo, dor de cabeça contábil) | AC-F1.7: resumo visível antes da confirmação. AC-F1.9: casquinha só aparece no fluxo açaí. Treinamento operador. |
| R8 | **CSV da EPIC-09 quebra para o contador** após F5 (colunas mudam de posição) | Baixa-Média | **Médio** | AC-F5.6: ADICIONAR colunas ao final, NÃO reordenar as existentes. Versionar o CSV se necessário ("v1" no nome). |

### 3.2. Restrições Técnicas

- **Backward compatibility obrigatória**: todas as vendas de açaí já em produção devem continuar funcionando sem ação manual do usuário. Cliente PWA antigo (sem deploy do código novo) deve continuar sincronizando.
- **Single-tenant** (continua): cada location tem seu próprio catálogo. Sem compartilhamento.
- **Offline-first**: produtos avulsos e casquinha devem funcionar offline. Catálogo de produtos é cacheado localmente no Dexie e atualizado em cada sync online.
- **Sem dependências novas pesadas**: F3 (CRUD) deve reutilizar componentes Shadcn já no projeto. F4 não introduz biblioteca de UI nova.
- **Performance do PDV** (operação dominante): nenhum step extra para açaí. Latência de render < 100ms (AC-F4 NFR).

### 3.3. Restrições de Produto

- **Sem estoque / sem variações / sem combos / sem desconto / sem múltiplos preços**: explícitos na seção 1.2.
- **Cancelamento (EPIC-09) continua funcionando** para vendas multi-produto: a UI de cancelamento já cobre porque opera em `sales` (que ganha `product_id` mas mantém estrutura).
- **Casquinha tem preço fixo R$ 1,00** nesta fase. Mudar exige nova story.
- **Operador pode escolher quantidade no fluxo unitário** (AC-F4.2), mas multiprodutos seguem sendo vendas separadas (AC-F4.4).

---

## 4. Decisões de Produto Explícitas

Estas decisões já estão tomadas e devem ser respeitadas pelo SM/Architect ao destrinchar em stories:

| # | Decisão | Razão |
|---|---------|-------|
| D1 | Casquinha é **toggle de venda**, não produto separado | Casquinha sempre acompanha açaí por peso; não vende sozinha. Toggle é mais rápido e impede erros operacionais. |
| D2 | Valor da casquinha é **constante hardcoded R$ 1,00** | Simplifica a primeira entrega. Configurabilidade entra em fase futura se o dono pedir. |
| D3 | Schema usa colunas `product_type` + `unit_price` + `product_id` (decisões do @architect) | Decisão arquitetural existente; minimiza mudança disruptiva. |
| D4 | Açaí existente vira `product_type = 'weight'` com backfill, **sem perder histórico** | Backward compatibility total. Migration aditiva. |
| D5 | **1 venda = 1 produto** (sem carrinho/itens múltiplos) | Mantém modelo `sales` simples, preserva offline sync, evita refactor de turno e dashboard. Multi-item fica para fase futura se necessário. |
| D6 | F1 (Casquinha) é **paralelizável** com F3 após F2 pronta | Independência de schema permite times paralelos; reduz lead time. |
| D7 | Cadastro de produtos avulsos é **admin only**; PDV é admin + staff | Segregação de responsabilidades já existente no projeto. |
| D8 | Casquinha NÃO aparece no fluxo de produtos unitários | Eliminar ambiguidade: casquinha = adicional de açaí. Em produto unit, has_casquinha sempre false. Constraint no DB. |
| D9 | Drag-and-drop de produtos é "nice-to-have", **fora desta fase** | Input numérico de `sort_order` resolve. Reduz escopo da F3. |
| D10 | Sem imagem de produto nesta fase | Reduz escopo, evita problema de storage/CDN. Cards apenas com nome + preço. |
| D11 | Produto inativo continua aparecendo no histórico/CSV | Auditabilidade preservada. Não pode "sumir" produto que já gerou venda. |
| D12 | CSV (EPIC-09) **adiciona colunas ao final**, não reorganiza | Não quebrar planilhas/macros do contador. |
| D13 | Dashboard "Vendas por produto" mostra **linha agregada de casquinhas** | Dono pediu explicitamente saber quantas casquinhas/dia. |

### 4.1. Decisões em Aberto (a resolver com @architect / @data-engineer antes do sharding final)

- **DA-1** A constraint da AC-F2.4 (validação de coerência peso vs unidade) é via trigger ou CHECK function? — Default sugerido: trigger BEFORE INSERT/UPDATE em `sales`. Confirmar com @data-engineer.
- **DA-2** Catálogo offline (PWA) é cacheado em Dexie como tabela separada ou reusa estrutura existente? — Confirmar com @architect.
- **DA-3** O catálogo (lista de produtos ativos) é refetchado a cada abertura do PDV ou tem TTL? — Default sugerido: refetch ao montar tela do PDV + invalidate quando admin edita em Settings (broadcast via Supabase realtime ou refresh manual). Confirmar com @architect.
- **DA-4** F3 inclui campo `created_by` / `updated_by`? — Default sugerido: SIM se a tabela já tem; senão, adicionar agora para evitar nova migration depois.

---

## 5. Definição de Pronto (Epic-level DoD)

A Fase 3 é considerada Done quando:

- [ ] F1, F2, F3, F4, F5 implementadas e cada uma com QA gate PASS ou CONCERNS.
- [ ] Migration F2 aplicada em produção com backfill 100% validado (zero vendas órfãs de `product_id`).
- [ ] Edge function `sync-sales` aceita payload antigo (cliente PWA antigo) E payload novo (cliente atualizado) — testado.
- [ ] Trigger de fechamento de turno revalidado: testes de integração com mix peso + unidade no mesmo turno passam.
- [ ] PDV testado manualmente em tablet/touch screen do caixa (não só no Chrome desktop).
- [ ] Vendas online + offline + casquinha + produto unitário todas sincronizam corretamente em cenário de reconnect.
- [ ] Dashboard valida: receita total não muda para vendas históricas (só açaí); novas vendas multi-produto aparecem corretamente.
- [ ] Histórico (`/sales-history` da EPIC-09) exibe todas as vendas com coluna Produto + filtro funcionando.
- [ ] CSV exportado testado no Excel pt-BR: colunas novas aparecem no final, sem mojibake, sem quebrar planilhas existentes do contador.
- [ ] RLS policies revisadas por @data-engineer: PDV (staff) lê produtos da location, admin escreve em produtos, vendas continuam isoladas por location.
- [ ] Treinamento do operador da loja agendado para o dia do release (ou material curto entregue).
- [ ] Nenhuma regressão no fluxo de açaí por peso (velocidade do caixa preservada).
- [ ] EPIC-09 (Histórico, CSV, Cancelamento) continua 100% funcional sobre o novo schema.

---

## 6. Próximos Passos (handoff)

1. **@architect (Aria)** — Resolver decisões em aberto (DA-1 a DA-4) e produzir nota técnica curta antes do sharding final.
2. **@data-engineer (Dara)** — Desenhar migration completa de F2 (DDL + backfill + trigger + RLS), revisar com @architect, validar reversibilidade. Aplicar em staging com dump real.
3. **@ux-design-expert (Uma)** — Validar hierarquia visual do PDV (AC-F4.1) e fluxo de cadastro de produtos (F3). Entregar wireframe ou mockup antes do dev.
4. **@sm (River)** — Após decisões de @architect e mockups de @ux, fazer sharding deste epic em stories individuais (provisão inicial: 5 stories — uma por feature, exceto se F4 for grande demais e precisar virar 2).
5. **@po (Pax)** — Validar cada story com o checklist de 10 pontos antes do dev pegar.
6. **@dev (Dex)** — Executar na ordem F2 → (F1 + F3 em paralelo) → F4 → F5, com testes incluídos desde a primeira story.
7. **@qa (Quinn)** — QA gate em cada story, com atenção especial para F2 (regressão de dados) e F4 (fluxo de caixa).

---

## Change Log

| Data | Quem | Ação |
|------|------|------|
| 2026-05-26 | @pm (Morgan) | Criação do EPIC-10 com 5 features priorizadas, 13 decisões de produto, 8 riscos mapeados, 4 decisões em aberto. Status: Draft. |
