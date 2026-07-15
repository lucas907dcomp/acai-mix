# EPIC-11 — Perfil "Dono" com Visão Multi-Loja

**ID:** EPIC-11 | **Phase:** 4 (expansão pós-Fase 3)
**Created:** 2026-07-14 | **Owner:** @pm (Morgan)
**Status:** ✅ Done — 6/6 stories concluídas (`11.0` a `11.5`), deployadas em produção (`b20bd35..a3320ca`) e validadas end-to-end pelo usuário em 2026-07-15 (owner real + zero regressão nos 2 admins reais). Ver Definição de Pronto (seção 6) e Change Log.
**Predecessor Epics:** EPIC-01..08 (Fase 1, em produção), EPIC-09 (Fase 2), EPIC-10 (Fase 3 — Multi-produto/Casquinha)
**Diagnóstico técnico:** ver handoff de @analyst (Atlas) nesta sessão — evidência real de código, não presumida.

---

## 1. Visão Geral

O AçaiMix hoje atende **2 lojas do mesmo dono**, cada uma com seu próprio usuário `admin` vinculado a uma única `location`. Não existe hoje nenhum usuário com visão das duas lojas ao mesmo tempo — o dono precisa logar duas vezes, em duas contas, para acompanhar o negócio. O plano de expansão da rede é chegar a **6 lojas**.

Este epic introduz um **papel acima do admin atual ("owner")** que:
1. Enxerga os dados de **todas** as lojas da rede em um login único.
2. Tem uma tela consolidada ("Visão Geral") com os números das lojas lado a lado.
3. Consegue "entrar" em qualquer loja individual e operar o sistema normalmente (telas atuais do admin, sem mudança).

### 1.1. Objetivos de Negócio

- **Visão unificada da rede** — o dono não pode mais precisar de 2 logins para saber o faturamento total do dia.
- **Escalar para N lojas sem retrabalho** — adicionar a 3ª, 4ª... 6ª loja deve ser cadastro (INSERT + vínculo), nunca deploy de código novo ou hardcode de identificador de loja.
- **Isolamento real, não aparente** — o isolamento entre lojas (para quem não é owner) precisa valer contra chamadas diretas à API, não só contra o que a tela mostra.
- **Zero risco para a operação atual** — as 2 lojas estão em produção, vendendo agora. Esta entrega não pode, em hipótese alguma, degradar ou interromper o que já funciona.

### 1.2. Fora de Escopo (NÃO entram neste Epic)

- Migração de dados históricos.
- Multi-organização (outras redes, outros clientes/tenants fora desta operação).
- Billing, cobrança, planos.
- App ou login separado para o dono (owner usa o mesmo app/login, com uma camada a mais).
- Refatoração das telas existentes do operador/admin — elas continuam como estão.
- Gestão de papel `staff` (existe no schema, mas não está em uso real hoje; não é objeto deste epic, embora a modelagem escolhida não possa impedir seu uso futuro).

---

## 2. Contexto Técnico Confirmado (herdado do diagnóstico do @analyst)

Estes fatos já foram levantados com evidência de código e **confirmados pelo usuário** — não precisam ser re-investigados, apenas usados como ponto de partida pelo @architect:

- O discriminador de loja já existe: `location_id`, presente em `user_profiles`, `products`, `shifts`, `sales`, `employees`.
- Hoje existem **exatamente 2 usuários em produção, ambos `role = admin`**, cada um vinculado à sua própria `location_id`. O papel `staff` nunca foi usado na prática.
- `user_profiles.location_id` é uma FK simples (1 usuário → 1 loja). Não existe tabela de vínculo N:N usuário↔loja.
- No front, 16 hooks/componentes leem `profile.location_id` (valor único, via Zustand `useAuthStore`) como fonte de verdade para filtrar dados — não existe hoje conceito de "loja selecionada no momento" separado do perfil logado.
- **Duas brechas de RLS pré-existentes**, independentes deste epic mas relevantes para o desenho:
  - `locations` e `products` têm SELECT `USING (true)` — hoje qualquer autenticado lê todas as lojas/produtos; o isolamento real depende do filtro que o front lembra de mandar.
  - `is_admin()` dá bypass global (não escopado por loja) em `shifts`/`sales`, mas foi escopado por loja em `products` (migration 010) — o modelo de "admin" já é inconsistente entre tabelas.
- Já existe um padrão de role-gating reaproveitável no front (`ProtectedRoute requiredRole`, `RootRedirect` por `role`) — a introdução de "owner" é extensão desse padrão, não invenção.

**Estes pontos NÃO são decididos por este documento.** A decisão de modelagem (nova tabela de vínculo? reaproveitar `location_id` como "loja padrão"? unificar o `is_admin()` inconsistente?) é do @architect na próxima etapa do fluxo — este epic define o problema, o escopo e os critérios de aceite.

---

## 3. Features

### 3.1. Tabela de Features (MoSCoW + Esforço + Dependências)

| ID | Feature | MoSCoW | Esforço (estimativa alta) | Dependências | Risco |
|----|---------|--------|---------------------------|---------------|-------|
| F0 | Ambiente de teste (stack local Supabase CLI + seed sintético) | **Must** | 2-3 pts (1 story) | Nenhuma | **Alto** (bloqueia tudo — sem isso, único banco disponível é produção) |
| F1 | Modelo de papéis + vínculo usuário↔loja N:N (owner) | **Must** | 8-13 pts (1-2 stories) | F0, decisão do @architect | **Alto** (schema + RLS, produção ativa) |
| F2 | RLS/policies para owner (leitura multi-loja) + fechamento das brechas herdadas | **Must** | 8-13 pts (1 story) | F1 | **Alto** (segurança, isolamento) |
| F3 | Seletor de loja no header (owner only) | **Must** | 3-5 pts (1 story) | F1, F2 | Baixo-Médio |
| F4 | Tela "Visão Geral" consolidada (owner only) | **Must** | 5-8 pts (1 story) | F1, F2 | Médio |
| F5 | Seed/script: criar usuário owner e vincular às 2 lojas atuais | **Must** | 2-3 pts (1 story) | F1 | Baixo (mas crítico não afetar admins atuais) |

**Esforço total estimado:** 28-45 story points.

**Ordem de entrega recomendada:** F0 → F1 → F2 → F5 (seed, para já poder testar) → F3 → F4.

- **F0 primeiro, bloqueante para tudo o mais.** Verificado durante a revisão do @data-engineer: este projeto **não tem staging** — `.env`/`.env.example` apontam para um único projeto Supabase, e `package.json` usa `supabase gen types --linked` (projeto linkado é o de produção). O único banco disponível hoje é o de produção, com as 2 lojas vendendo. F0 sobe a stack local do Supabase CLI (`supabase start`, já configurada em `supabase/config.toml`, mas nunca documentada como processo) e cria um seed sintético (2 lojas fictícias, 2 admins fictícios, 1 owner fictício) — nenhuma migration ou smoke test deste epic roda em qualquer lugar perto de produção antes de F0 existir.
- **F1** depende de F0 e de toda a feature dependendo de como o vínculo usuário↔loja é modelado. Decisão arquitetural bloqueante.
- **F2 logo em seguida**, ainda antes de qualquer UI: sem RLS correta, não há como validar isolamento nem dar acesso multi-loja com segurança.
- **F5 (seed) entra cedo**, assim que F1+F2 estiverem testáveis, para o dono já conseguir validar o comportamento no ambiente real antes das telas existirem.
- **F3 (seletor) e F4 (Visão Geral)** são as camadas de UI, dependem do backend estar pronto e testado.

### 3.0. F0 — Ambiente de Teste (pré-requisito bloqueante)

**Story (provisória):** `Story 11.0 — Ambiente de teste: stack local Supabase + seed sintético`

**O quê:** Antes de qualquer migration ou smoke test deste epic tocar em algo próximo de produção, subir a stack local do Supabase CLI (`supabase start` — já configurada em `supabase/config.toml`, nunca documentada como processo neste projeto) e criar um seed sintético dedicado (`supabase/tests/epic11_seed_staging.sql`, distinto do `seed.sql` de produção) com dados fictícios que espelhem o cenário real: 2 lojas, 2 admins (um por loja), 1 owner vinculado às 2 lojas, e 1 loja extra fictícia não vinculada a ninguém (para os testes de vazamento).

**Critérios de aceite de alto nível:**

- **AC-F0.1** `supabase start` sobe um Postgres/Auth local isolado, aplica todas as migrations do repositório do zero (reproduzindo o schema atual) e roda o seed sintético.
- **AC-F0.2** O seed sintético cria UUIDs estáveis e documentados (mesmos usados em `supabase/tests/epic11_rls_smoke.sql`) para: 2 admins, 1 owner, 3 lojas (2 vinculadas ao owner, 1 não vinculada).
- **AC-F0.3** Processo documentado (como subir, como resetar, como rodar o smoke test contra esse ambiente) em local acessível ao @dev e ao @qa — não depende de conhecimento tácito.
- **AC-F0.4** Nenhuma story subsequente (F1 em diante) aplica migration em qualquer ambiente antes deste existir e ser validado.

**Não-funcionais:**
- Ambiente descartável/reproduzível a qualquer momento (`supabase db reset` ou equivalente) — não é um banco de "staging" persistente para gerenciar, é local e efêmero.

---

### 3.2. F1 — Modelo de Papéis e Vínculo Usuário↔Loja (N:N)

**Story (provisória):** `Story 11.1 — Modelagem: papel owner e vínculo usuário↔loja`

**O quê:** Extensão do modelo de autorização para suportar um usuário vinculado a **N** lojas com papel `owner`, sem alterar o comportamento dos usuários `admin`/`staff` existentes.

**Critérios de aceite de alto nível (comportamento, não implementação):**

- **AC-F1.1** É possível cadastrar um usuário com papel `owner` vinculado a 2 ou mais lojas.
- **AC-F1.2** Vincular uma nova loja a um `owner` existente é uma operação de dados (cadastro/vínculo), nunca exige alteração de código ou deploy.
- **AC-F1.3** Os 2 usuários `admin` já existentes em produção continuam com exatamente o mesmo comportamento, acesso e desempenho depois da mudança — validado por teste de regressão explícito (ver seção 4, NFR de zero impacto).
- **AC-F1.4** Nenhum identificador de loja fica hardcoded em nenhuma camada (migration, RLS, backend, front) — a solução deve funcionar de forma idêntica para 2 ou para 6 lojas.
- **AC-F1.5** A modelagem escolhida (nova tabela de vínculo vs. reaproveitamento de coluna existente, unificação ou não do comportamento hoje inconsistente do `is_admin()`) é decisão do @architect, documentada com trade-offs no doc de arquitetura antes da implementação.

**Não-funcionais:**
- Migration estritamente aditiva (`ADD TABLE`/`ADD COLUMN` nullable ou com default) — zero downtime, zero alteração de linhas dos usuários já existentes além da criação do novo vínculo.

---

### 3.3. F2 — RLS/Policies para Owner + Fechamento de Brechas Herdadas

**Story (provisória):** `Story 11.2 — RLS: isolamento owner/admin/staff e fechamento de brechas`

**O quê:** Políticas de banco que autorizam o owner a ler todas as lojas vinculadas a ele (e só essas), mantendo o isolamento total para admin/staff, e resolvendo a inconsistência hoje existente entre tabelas.

**Critérios de aceite de alto nível:**

- **AC-F2.1** Um usuário `admin`/`staff` autenticado, mesmo fazendo requisição direta à API (sem passar pela UI), **não consegue ler dado de nenhuma loja fora da(s) sua(s)**. Este é o critério de aceite que reprova a entrega se falhar (teste de vazamento, obrigatório no QA gate).
- **AC-F2.2** Um usuário `owner`, via API direta, só consegue ler dados das lojas às quais está explicitamente vinculado — nunca lojas de terceiros hipotéticos fora da rede.
- **AC-F2.3** As brechas herdadas identificadas no diagnóstico (`locations`/`products` com SELECT aberto a qualquer autenticado; `is_admin()` com bypass global inconsistente entre tabelas) são avaliadas e, no mínimo, não pioram com a introdução do owner — idealmente fechadas como parte deste epic (decisão de escopo exato cabe ao @architect, mas deve constar explicitamente no doc de arquitetura se alguma ficar para depois, e por quê).
- **AC-F2.4** Toda nova política de RLS por loja é suportada por índice iniciando pelo discriminador de loja (`location_id`) — nenhuma query nova sem esse índice.

**Não-funcionais:**
- Nenhuma policy nova pode introduzir recursão de RLS (gotcha já documentado no histórico do projeto — ver migration `fix_rls_recursion`).

---

### 3.4. F3 — Seletor de Loja no Header (Owner Only)

**Story (provisória):** `Story 11.3 — Seletor de loja no header para owner`

**O quê:** Componente no header, visível **apenas para owner**, que lista as lojas vinculadas e permite trocar a "loja ativa" para operar o sistema normalmente dentro dela.

**Critérios de aceite de alto nível:**

- **AC-F3.1** Usuário `admin`/`staff` **não vê** o seletor (comportamento do header idêntico ao atual para eles).
- **AC-F3.2** Usuário `owner` vê no header a lista de lojas vinculadas e a loja atualmente ativa.
- **AC-F3.3** Ao trocar de loja no seletor, todas as telas atuais (PDV, Dashboard, Settings, Histórico) passam a operar no contexto da loja escolhida, sem exigir novo login.
- **AC-F3.4** Criar uma 3ª loja fictícia e vinculá-la ao owner faz ela aparecer automaticamente no seletor — sem deploy, sem alteração de código.
- **AC-F3.5** A troca de loja não deixa resíduo de estado da loja anterior (ex.: cache, fila offline) que contamine dados gravados na loja nova — este ponto deve ser especificamente testado dado o uso de sync offline (Dexie) hoje amarrado a um único `location_id` por sessão.

---

### 3.5. F4 — Tela "Visão Geral" Consolidada (Owner Only)

**Story (provisória):** `Story 11.4 — Tela Visão Geral: consolidado multi-loja`

**O quê:** Nova tela, acessível apenas ao owner, mostrando os números das lojas da rede lado a lado.

**Critérios de aceite de alto nível:**

- **AC-F4.1** A tela mostra, no mínimo, o total consolidado (soma) das lojas vinculadas ao owner para o período selecionado, e o breakdown por loja individual lado a lado.
- **AC-F4.2** As métricas mostradas são consistentes com o que cada loja já exibe individualmente no Dashboard atual (mesma fonte de verdade — sem duplicar lógica de cálculo).
- **AC-F4.3** Criar e vincular uma 3ª loja fictícia ao owner faz ela aparecer automaticamente nesta tela, sem deploy.
- **AC-F4.4** Acesso restrito a `owner` — `admin`/`staff` não acessam esta rota (nem por URL direta).
- **AC-F4.5** Não introduz nenhuma lógica de agregação nova fora do padrão já usado pelas views existentes (`shift_summary`, `daily_summary`) — reaproveitar, não duplicar.

**Não-funcionais:**
- Carregar a Visão Geral com 6 lojas e 30 dias de histórico deve responder em tempo comparável ao Dashboard individual de hoje (sem degradação perceptível).

---

### 3.6. F5 — Seed/Script: Criar Usuário Owner e Vincular às 2 Lojas Atuais

**Story (provisória):** `Story 11.5 — Seed: usuário owner vinculado às 2 lojas em produção`

**O quê:** Script/seed que cria o usuário dono com papel `owner` e o vincula às 2 lojas já existentes em produção, sem tocar nos 2 usuários `admin` atuais.

**Critérios de aceite de alto nível:**

- **AC-F5.1** Execução do seed cria exatamente 1 usuário `owner` vinculado às 2 lojas existentes.
- **AC-F5.2** Após o seed, os 2 usuários `admin` existentes continuam login, permissões e comportamento idênticos ao estado anterior — validado por smoke test explícito (ver seção 4).
- **AC-F5.3** O script é idempotente ou, no mínimo, seguro para reexecução acidental (não duplica vínculo, não derruba sessão de ninguém).
- **AC-F5.4** Script documentado (como rodar, em qual ambiente, quem tem a senha inicial do owner).

---

## 4. Riscos e Restrições

### 4.1. Riscos Críticos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | **Migração/RLS nova afeta os 2 admins em produção** (sessão derrubada, permissão retirada, query que hoje funciona para de funcionar) | Baixa-Média | **Crítico** (loja para de vender ao vivo) | NFR não-negociável (seção 4.2). Migration estritamente aditiva. Smoke test das 2 contas admin reais rodando contra as telas atuais ANTES e DEPOIS de cada story (não só no fim do epic). Nenhuma story é considerada Done sem esse smoke test. |
| R2 | **Owner acaba enxergando lojas que não deveria** (bug de RLS, ou herdando o bypass global inconsistente do `is_admin()`) | Média | **Alto** (vazamento de dados entre lojas de dono diferente, se a rede crescer para múltiplos donos no futuro) | AC-F2.2 + teste de vazamento obrigatório no QA gate, cobrindo owner também, não só admin/staff. |
| R3 | **Operador (admin/staff) consegue ler `locations`/`products` de outra loja via API direta** | Baixa (hoje **acontece de fato** — SELECT aberto a qualquer autenticado, ver DA-5) | **Crítico** (é o critério de aceite que reprova a entrega) | Corrigido dentro do epic (F2, DA-5). Teste de vazamento com forjamento de request direto à API, obrigatório e bloqueante no QA gate (@qa) para `locations`/`products`. |
| R3b | **Admin de uma loja consegue ler `shifts`/`sales` de outra loja da mesma rede via API direta** | Alta (é o comportamento hoje, por design do `is_admin()` — bypass global pré-existente) | Médio (só afeta admins do mesmo dono, não terceiros) | **Decisão consciente de NÃO corrigir neste epic** — ver DA-2 e seção 3.4 do doc de arquitetura. Registrado como **DEBT-EPIC11-01** (seção 5.2), com critério de saída explícito. Este risco **não** bloqueia o QA gate (diferente de R3). |
| R4 | **Os 16 hooks/componentes do front que leem `profile.location_id` diretamente quebram ou se comportam de forma inconsistente** ao introduzir o conceito de "loja ativa" separado do perfil | Alta (superfície grande, mapeada no diagnóstico) | **Alto** (telas mostram dado errado) | Resolvido: @architect decidiu reaproveitar `location_id` como "loja ativa" (DA-1/DA-3) — nenhum hook muda de código. QA valida uma amostra representativa pós-implementação como confirmação, não como correção. |
| R5 | **Sync offline (Dexie) grava dado sob `location_id` errado** quando owner troca de loja com fila offline pendente | Média | **Alto** (venda registrada na loja errada) | AC-F3.5 + DA-4: troca de loja bloqueada com fila pendente. Testar cenário explícito: owner troca de loja com vendas offline não sincronizadas na loja anterior. |
| R6 | **Inconsistência herdada do `is_admin()` (global em shifts/sales, escopado em products) é copiada para o owner sem decisão consciente** | Resolvido | — | @architect tomou a decisão explicitamente (DA-2) e a registrou como DEBT-EPIC11-01 em vez de copiar silenciosamente para o owner. Ver R3b. |
| R7 | **Não existe staging** — o único banco disponível é o de produção, com as 2 lojas vendendo. Testar migration/RLS "em algum lugar seguro" não era possível até este ponto. | Alta (confirmado: `.env` aponta para 1 projeto só, `package.json` usa `--linked`) | **Crítico** (sem isso, qualquer teste de RLS seria feito em cima de loja aberta) | **Resolvido por F0** (nova feature, seção 3.0): stack local do Supabase CLI + seed sintético, bloqueante para todas as demais stories. |
| R8 | **`locations_update_admin` (policy de escrita) tinha o mesmo problema de escopo que as 2 SELECTs do DA-5**, mas não estava no inventário original — achado durante a revisão da migration pelo @data-engineer | Alta (era o comportamento real, embora nunca explorado pelos 2 admins reais) | Médio (mesma classe de R3, mas na escrita) | Corrigido na mesma migration (DA-5 ampliado), reaproveitando `fn_is_admin_of_location()`. Testes T14-T16 no smoke test cobrem: admin continua editando a própria loja (zero regressão), admin bloqueado na loja alheia, owner bloqueado fora da loja ativa. |

### 4.2. Restrição Não-Negociável: Zero Impacto em Produção

As duas lojas atuais estão **em produção, vendendo agora**, com os 2 usuários `admin` ativos. Esta é a restrição mais importante do epic, acima de qualquer prazo:

- Nenhuma story deste epic pode alterar login, permissões, dados ou comportamento observável dos 2 usuários admin existentes.
- Toda migration de schema/RLS deve ser estritamente aditiva (sem `DROP`, sem `ALTER` destrutivo, sem remoção/reescrita de policy existente sem substituição equivalente testada antes do deploy).
- Cada story que toca schema, RLS ou autenticação deve incluir, como parte da sua Definição de Pronto, um **smoke test manual das 2 contas admin reais** contra as telas em uso hoje (login, PDV, abrir/fechar turno, dashboard, settings) — antes de ser considerada QA PASS.
- Em caso de qualquer dúvida sobre risco de regressão para os admins atuais, a story para e escala para @architect antes de prosseguir.

### 4.2.1. Dívida Técnica Registrada (aceita conscientemente nesta entrega)

> **DEBT-EPIC11-01** — `is_admin()` dá bypass global (todas as locations) em `shifts_select`/`sales_select`, mas foi escopado por loja em `products` (migration 010). Isso significa que, mesmo após este epic, o admin de uma loja continua conseguindo ler via API direta os turnos/vendas de outra loja da mesma rede. **Não é uma omissão** — foi avaliado com o mesmo critério usado para fechar as brechas de `locations`/`products` (DA-5) e conscientemente mantido aberto porque o custo de corrigir agora (reescrever policy viva usada pelos 2 admins reais) supera o risco real (só admins do mesmo dono conseguem explorar, sem indício de uso malicioso). Detalhamento completo: `docs/architecture/epic11-owner-multiloja-tech-decisions.md`, seção 3.4.
>
> **Critério de saída:** revisitar antes de (a) qualquer loja de outro dono/tenant compartilhar este banco, (b) o papel `staff` entrar em uso real caso venha a herdar bypass equivalente, ou (c) autorização explícita do usuário para uma story de hardening dedicada.
>
> **Efeito no QA gate:** o teste de vazamento admin→admin em `shifts`/`sales` (T2 do doc de arquitetura) é executado e seu resultado registrado, mas **não bloqueia** a entrega — diferente do teste equivalente para `locations`/`products` (que já foi corrigido) e do teste de vazamento do owner (que é bloqueante).

### 4.3. Restrições Técnicas

- **Modelar para N, entregar com 2**: toda decisão de schema/RLS deve funcionar identicamente para 6 lojas; a validação de "funciona sem deploy" com uma 3ª loja fictícia é critério de aceite explícito (AC-F3.4, AC-F4.3).
- **Nenhum identificador de loja hardcoded** em nenhuma camada.
- **Reaproveitar, não duplicar**: Visão Geral usa as mesmas views/queries do Dashboard individual, não uma lógica de agregação paralela.
- **Telas existentes do admin/staff não mudam**: este epic é aditivo sobre o que já existe, não uma refatoração.

---

## 5. Decisões de Produto Explícitas

| # | Decisão | Razão |
|---|---------|-------|
| D1 | Owner é um papel **acima** do admin atual, não uma reformulação do admin | Confirmado pelo usuário: os 2 admins existentes continuam sendo admins de sua própria loja; owner é uma camada nova. |
| D2 | Zero impacto nos 2 usuários admin já em produção é restrição **não-negociável**, acima de robustez ou prazo | Lojas reais vendendo agora; qualquer regressão tem custo direto de faturamento. |
| D3 | Modelagem do vínculo N:N usuário↔loja e decisão sobre o `is_admin()` inconsistente ficam com @architect | PM não decide schema/RLS; define comportamento esperado e critérios de aceite. |
| D4 | Seed do owner é uma operação puramente aditiva | Não pode envolver qualquer alteração nos registros dos admins existentes. |
| D5 | Papel `staff` não é objeto deste epic, mas a modelagem escolhida não pode impedir seu uso futuro | Ainda não está em uso real, mas existe no schema e não deve ser quebrado. |
| D6 | Visão Geral reaproveita as views de dashboard já existentes | Evita duplicar lógica de cálculo e reduz risco de inconsistência entre telas. |
| D7 | Fora de escopo: migração histórica, multi-organização, billing, app separado, refatoração das telas do operador | Confirmado na change request original do usuário. |

### 5.1. Decisões Resolvidas (@architect — 2026-07-14)

> Detalhamento completo, DDL de referência e estratégia de teste: `docs/architecture/epic11-owner-multiloja-tech-decisions.md`

- **DA-1 (RESOLVIDA)** Nova tabela de junção `user_locations` (N:N puro). `user_profiles.location_id` é **reaproveitado como "loja ativa no momento"**, não substituído — para admin/staff o valor nunca muda; para owner, muda ao trocar de loja via RPC guardado (`switch_active_location`).
- **DA-2 (RESOLVIDA)** **Não unificar** a inconsistência hoje existente do `is_admin()` (bypass global em shifts/sales vs. escopado em products). Owner ganha funções próprias e isoladas (`is_owner()`, `is_owner_of_location()`). Decisão **explícita**, não omissão: registrada como **DEBT-EPIC11-01** (seção 4.2.1), com justificativa de por que o mesmo critério de isolamento do DA-5 não se aplica aqui, e critério de saída definido.
- **DA-3 (RESOLVIDA)** Nenhum dos 16 hooks/componentes muda de código. Como `location_id` passa a significar "loja ativa" (DA-1), o React Query já refaz fetch sozinho ao trocar de loja, porque todos os hooks já usam `locationId` na query key.
- **DA-4 (RESOLVIDA)** Troca de loja é bloqueada enquanto houver fila offline pendente (`syncStore.pendingCount > 0` ou `isSyncing`), mesmo padrão de guarda já usado no cancelamento (EPIC-09). Ao trocar, estado transitório (`activeShift`, venda em andamento) é limpo antes de liberar o PDV.
- **DA-5 (RESOLVIDA, escopo ampliado)** As duas brechas herdadas de leitura (`locations`/`products` com SELECT `USING(true)`) **são fechadas dentro deste epic (F2)**. Durante a revisão da migration, o @data-engineer fez o inventário completo de todas as queries do front que tocam `locations`/`products` (pedido explícito do usuário) — **nenhuma depende do `USING(true)` para funcionar**, então o fechamento não quebra telas existentes. O inventário também achou um 3º caso da mesma classe de problema: `locations_update_admin` (policy de **escrita**, não coberta pelo DA-5 original) permitia qualquer admin editar QUALQUER loja, não só a própria — corrigido na mesma migration, reaproveitando `fn_is_admin_of_location()` já existente. Zero impacto real nos 2 admins (cada um só edita a própria loja hoje).

---

## 6. Definição de Pronto (Epic-level DoD)

Este epic é considerado Done quando:

- [x] F1 a F5 implementadas, cada uma com QA gate PASS ou CONCERNS.
- [x] Teste de vazamento **bloqueante** (admin/staff tentando ler `locations`/`products` de outra loja via API direta) executado e passando — reprova a entrega se falhar. (T1, T3-T6 do smoke test — PASS, ver Story 11.2)
- [x] Teste de vazamento **bloqueante** equivalente para owner (só enxerga lojas vinculadas a ele, `switch_active_location` recusa loja não vinculada) executado e passando. (T8, T9 do smoke test — PASS, ver Story 11.2)
- [x] Teste do guarda-corpo do DA-1 **bloqueante**: owner não consegue alterar `location_id` fora da RPC, não consegue setar loja não vinculada, não consegue alterar o próprio `role` — executado e passando (T7, T10-T13 do doc de arquitetura — PASS, ver Story 11.2).
- [x] Teste de vazamento admin→admin em `shifts`/`sales` (T2) **executado e registrado, mas não bloqueante** — resultado esperado é "ainda vaza", aceito conscientemente como DEBT-EPIC11-01 (seção 4.2.1). Confirmado presente via verificação empírica (Story 11.2). Falhar aqui não reprova a entrega.
- [x] Smoke test das 2 contas admin reais executado e aprovado após cada story que toca schema/RLS/auth — não apenas ao final do epic. Reconfirmado pelo usuário em produção após o push, em 2026-07-15 (login, turno, dashboard, settings idênticos a antes).
- [x] Seletor de loja e Visão Geral testados com uma 3ª loja fictícia criada e vinculada em runtime, sem deploy, aparecendo automaticamente em ambos. (Stories 11.3/11.4, ambiente local)
- [x] Nenhuma query nova sem índice iniciando pelo `location_id`.
- [x] Decisões em aberto (DA-1 a DA-5) resolvidas e documentadas no doc de arquitetura antes do sharding em stories pelo @sm.
- [x] Doc de arquitetura atualizado com o trade-off da modelagem escolhida.
- [x] DEBT-EPIC11-01 registrada em local de rastreio de dívida técnica do projeto (ou mantida nesta seção 4.2.1 como registro único, se o projeto não tiver backlog de dívida técnica separado).
- [x] F0 (ambiente de teste) concluída ANTES de qualquer migration deste epic ser aplicada em qualquer ambiente — nenhum smoke test roda contra produção.
- [x] Teste de "zero regressão" de escrita em `locations` (T14/T15 do smoke test): admin continua editando a própria loja; admin bloqueado ao tentar editar loja alheia (achado adicional, corrigido no mesmo F2).
- [x] **Teste manual end-to-end em produção com o owner real (`marcos@admin.com`)**, pendência registrada nos QA gates CONCERNS de 11.3 e 11.4: login, seletor com as 2 lojas, troca de loja propagando para PDV/Histórico, Visão Geral consolidada batendo com a soma dos dashboards individuais. Executado pelo usuário em 2026-07-15, após o push `b20bd35..a3320ca`. Resultado: **PASS**, sem nenhum bug encontrado.

---

## 7. Próximos Passos (handoff)

1. **@sm (River)** — Quebrar este epic em 6 stories: 11.0 (ambiente de teste, seção 3.0 — **primeira, bloqueante**) + 11.1 a 11.5 já delineadas na seção 9 do doc de arquitetura, cada uma referenciando esse documento, a migration `supabase/migrations/20260714000000_owner_multiloja.sql` e o smoke test `supabase/tests/epic11_rls_smoke.sql` (ambos já existem, prontos para uso, e já incluem os testes T14-T16 do achado adicional em `locations_update_admin`).
2. **@po (Pax)** — Validar cada story com o checklist de 10 pontos, com atenção redobrada ao critério de "riscos documentados" e à presença do smoke test como parte da Definição de Pronto de cada story. Confirmar que 11.0 é pré-requisito explícito de 11.1 no sharding.
3. **@dev (Dex)** — Executar na ordem 11.0 → 11.1 → 11.2 → 11.5 → 11.3 → 11.4, rodando `supabase/tests/epic11_rls_smoke.sql` no ambiente local criado por 11.0 (seção 8.3 do doc de arquitetura) em cada story que toca schema/RLS/auth. Nenhuma migration roda perto de produção.
4. **@qa (Quinn)** — QA gate em cada story; teste de vazamento (admin/staff→`locations`/`products` de outra loja, owner→loja não vinculada, guarda-corpo do DA-1, escrita em `locations` — T1, T3-T16 do smoke test) é obrigatório e reprova a entrega se falhar. T2 (admin→admin em `shifts`/`sales`) é executado e registrado, mas **não** bloqueia — é o DEBT-EPIC11-01, aceito conscientemente (seção 4.2.1).

---

## Change Log

| Data | Quem | Ação |
|------|------|------|
| 2026-07-14 | @analyst (Atlas) | Diagnóstico técnico do estado real do código, confirmado pelo usuário (2 admins em produção, sem uso de staff, `location_id` como discriminador, acoplamento front em 16 call-sites, 2 brechas de RLS herdadas). |
| 2026-07-14 | @pm (Morgan) | Criação do EPIC-11 com 5 features priorizadas, 7 decisões de produto, 6 riscos mapeados, 5 decisões em aberto para @architect. Restrição não-negociável de zero impacto em produção incorporada como NFR explícito. Status: Draft. |
| 2026-07-14 | @architect (Aria) | DA-1 a DA-5 resolvidas em `docs/architecture/epic11-owner-multiloja-tech-decisions.md`. Decisão-chave: reaproveitar `location_id` como "loja ativa" evita reescrever os 16 hooks do front. Fechamento das 2 brechas de RLS herdadas incorporado ao epic (F2), não adiado. Pronto para @data-engineer revisar a migration. |
| 2026-07-14 | @architect (Aria) | Revisão pós-feedback do usuário: (1) inconsistência entre DA-2 (mantido) e DA-5 (corrigido) agora justificada explicitamente, com DEBT-EPIC11-01 registrada (seção 4.2.1) e critério de saída definido; DoD e teste de vazamento (seção 6) escopados para deixar claro que T2 (admin→admin em shifts/sales) é aceito e não bloqueante. (2) Guarda-corpo do DA-1 confirmado ponto a ponto (coluna restrita, escopo de `user_locations`, `role` nunca alterável) com 3 novos testes bloqueantes (T11-T13). |
| 2026-07-14 | @data-engineer (Dara) | Migration final em `supabase/migrations/20260714000000_owner_multiloja.sql` e smoke test em `supabase/tests/epic11_rls_smoke.sql` (13 casos). Ajuste sobre o proposto: nome da constraint de `role` localizado dinamicamente via `information_schema`, não assumido. Migration inclui auto-checagem explícita de zero impacto para `role='admin'`. Pronto para @sm iniciar sharding em stories. Status: Draft → pronto para sharding. |
| 2026-07-14 | @data-engineer (Dara) | Verificação bloqueante pedida pelo usuário: inventário completo de todas as queries do front que tocam `locations`/`products` — nenhuma depende do `USING(true)` para funcionar, DA-5 não quebra telas existentes. Achado adicional: `locations_update_admin` (escrita) tinha o mesmo problema de escopo que as 2 SELECTs do DA-5, mas não estava coberto — corrigido na mesma migration (testes T14-T16 adicionados ao smoke test), por decisão do usuário. Confirmado: não existe staging, só produção — nova feature **F0 (Story 11.0)** criada como pré-requisito bloqueante para subir ambiente de teste local (Supabase CLI) antes de qualquer migration rodar em qualquer lugar. |
| 2026-07-14 | @sm (River) | Sharding concluído: 6 stories criadas — `11.0.story.md` (ambiente de teste, bloqueante), `11.1.story.md` (modelo de papéis + vínculo N:N), `11.2.story.md` (RLS/policies + fechamento de brechas), `11.5.story.md` (seed do owner em produção — requer confirmação explícita do usuário antes de tocar produção), `11.3.story.md` (seletor de loja), `11.4.story.md` (Visão Geral). Ordem de execução: 11.0 → 11.1 → 11.2 → 11.5 → 11.3 → 11.4. Todas em Status: Draft. Status do epic: Draft → aguardando validação do @po. |
| 2026-07-14 | @po (Pax) | Validação das 6 stories (checklist de 10 pontos cada): 11.0 GO (9/10), 11.1 GO (9/10), 11.2 GO (9/10), 11.5 NO-GO inicial (6/10) → fix aplicado (seção de Riscos enumerada + regra de bloqueio explícita para aplicação em produção) → GO (9/10), 11.3 GO (9/10), 11.4 GO (8/10). Todas promovidas Draft → Ready. Confirmado: dependência de 11.0 é formal (campo Predecessor + Dependencies) em todas as stories seguintes, não apenas textual. Pronto para @dev iniciar pela Story 11.0. |
| 2026-07-15 | @dev / @qa | Stories 11.0-11.4 implementadas e passadas por QA gate na ordem 11.0 → 11.1 → 11.2 → 11.5 → 11.3 → 11.4 (11.0-11.2 e 11.5 PASS; 11.3 e 11.4 CONCERNS não-bloqueante — única pendência em ambas: teste manual end-to-end do owner real em produção, sem credenciais disponíveis nesta sessão). Migration aplicada em produção pelo usuário via SQL Editor durante a Story 11.5 (achado bloqueante: migration nunca tinha sido aplicada antes disso). Seed do owner (`marcos@admin.com`, vinculado às 2 lojas reais) aplicado pelo usuário. |
| 2026-07-15 | Usuário | Código do EPIC-11 (15 commits, `8e8b489..a3320ca`) dado push para produção (`b20bd35..a3320ca`) após build e lint limpos. Teste manual end-to-end executado pelo usuário em produção: (1) os 2 admins reais confirmados idênticos a antes (login, turno, dashboard, settings); (2) owner (`marcos@admin.com`) confirmado — vê as 2 lojas, Visão Geral bate com a soma dos dashboards, seletor de loja propaga a troca para PDV e Histórico, não só a Visão Geral. **Nenhum bug encontrado.** Pendência dos gates CONCERNS de 11.3 e 11.4 resolvida (ver QA Results de cada story e `docs/qa/gates/11.3-concerns.yml`/`11.4-concerns.yml`). **EPIC-11 encerrado: Status Draft → Done.** |
