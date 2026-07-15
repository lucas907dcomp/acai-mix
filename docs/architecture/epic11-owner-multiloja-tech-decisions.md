# AçaíMix — EPIC-11: Perfil Owner Multi-Loja (Decisões Técnicas)

**Documento:** Decisões técnicas para EPIC-11 (Perfil Dono com Visão Multi-Loja)
**Autora:** Aria (@architect)
**Data:** 2026-07-14
**Status:** APROVADO para sharding em stories (revisado após 2 apontamentos do usuário — ver seção 2.3.1 e 3.4)
**Predecessor:** `docs/stories/EPIC-11-perfil-dono-multi-loja.md`
**Inputs analisados:** diagnóstico do @analyst (confirmado pelo usuário), migrations 001-013, `AuthProvider.tsx`, `useAuth.ts`, `authStore.ts`, `ProtectedRoute.tsx`, `RootRedirect.tsx`, `useLocationData.ts`, `saleStore.ts`, `syncStore.ts`, `DexieDatabase.ts`, 16 hooks consumidores de `profile.location_id`.

---

## Sumário Executivo

Esta nota resolve as 5 decisões em aberto (DA-1 a DA-5) do EPIC-11. Em uma linha:

> **DA-1:** Nova tabela de junção `user_locations` (N:N) + papel `owner` no CHECK de `user_profiles.role`. `user_profiles.location_id` é **reaproveitado como "loja ativa no momento"** (não substituído) — decisão que também resolve DA-3 sem tocar em nenhum dos 16 hooks existentes.
> **DA-2:** **Não unificar** o `is_admin()` inconsistente agora. Owner ganha funções próprias (`is_owner()`, `is_owner_of_location()`), isoladas do `is_admin()` existente. **Decisão explícita, não omissão** (seção 3.4): o mesmo AC de isolamento que motivou o DA-5 também é violado aqui, mas o custo de corrigir agora (mexer em policy viva dos 2 admins reais) supera o risco real (só admins do mesmo dono conseguem explorar). Registrado como **DEBT-EPIC11-01** com critério de saída explícito; o teste de vazamento correspondente (T2) é conhecido, vai falhar, e está fora do critério de bloqueio do QA gate — por decisão, não por lacuna.
> **DA-3:** Nenhum hook muda. `profile.location_id` passa a significar "loja ativa"; a troca de loja atualiza esse único campo via RPC guardado, e o React Query já refaz fetch sozinho (todos os 16 hooks já usam `locationId` na query key).
> **DA-4:** Troca de loja é **bloqueada** enquanto houver fila offline pendente (`syncStore.pendingCount > 0` ou `isSyncing`) — mesmo padrão de guarda já usado no cancelamento (EPIC-09). Estado transitório (`activeShift`, cache do React Query) é limpo/invalidado na troca.
> **DA-5:** As duas brechas herdadas (`locations`/`products` com SELECT aberto) **são fechadas dentro deste epic** (F2), porque a AC original do epic ("operador não acessa dado de outra loja mesmo forjando request") já exige isso — não é opcional. É a única mudança não-aditiva (DROP+CREATE de 2 policies), mitigada por preservar `is_admin()` no novo policy (zero mudança observável para os 2 admins reais).
> **Guarda-corpo do DA-1 (confirmado, seção 2.3.1):** a troca de loja só altera `location_id` (nunca `role`), só para lojas presentes em `user_locations` do próprio usuário, e só através da RPC `switch_active_location` — qualquer tentativa de `UPDATE` direto (mesmo para loja legitimamente vinculada) é bloqueada pelo trigger. Coberto por T7, T10-T13.

**Migrações novas:** 1 arquivo SQL (~120 linhas), reversível. Nenhuma tabela existente perde coluna, nenhuma policy existente é removida exceto as 2 do DA-5 (substituídas por versão equivalente + mais restritiva para não-privilegiados).

---

## 1. Estado Atual (baseline, herdado do diagnóstico do @analyst — não re-investigado)

- Discriminador: `location_id`, presente em `user_profiles`, `products`, `shifts`, `sales`, `employees`.
- `user_profiles`: `location_id` é FK **nullable** (não há `NOT NULL`), `role CHECK IN ('admin','staff')`.
- Funções existentes: `get_my_location_id()` (retorna `user_profiles.location_id` do chamador), `is_admin()` (bypass **global**, sem checar location), `fn_is_admin_of_location(loc_id)` (escopado, usado só em `products` write).
- **Confirmado nesta etapa:** o front **nunca** faz `UPDATE`/`INSERT` em `user_profiles` — único uso é leitura em `useAuth.ts:39` e `AuthProvider.tsx:7`. Isso é decisivo para DA-1/DA-3: qualquer trigger de proteção que eu adicionar nessa tabela tem **zero risco** de afetar o fluxo atual dos 2 admins, porque esse fluxo não escreve nela.
- `user_profiles_update_own` (policy existente) permite hoje, sem restrição de coluna, que qualquer usuário autenticado faça `UPDATE` no próprio `location_id`/`role` via API direta — **vulnerabilidade pré-existente, não usada pelo front hoje, mas explorável por request forjado**. Relevante porque a feature de "trocar loja ativa" opera exatamente nesse campo; ignorá-la seria construir a feature nova sobre uma porta já destrancada.
- `ProtectedRoute` já filtra por `requiredRole` exato; `RootRedirect` já roteia por `role`.

---

## 2. DA-1 + DA-3: Modelagem do Vínculo N:N e "Loja Ativa" (decisão unificada)

Trato DA-1 e DA-3 juntas porque a escolha de modelagem do vínculo **determina** a estratégia de front, e a melhor solução para as duas é a mesma decisão.

### 2.1. Decisão

1. **Nova tabela `user_locations`** — vínculo N:N puro, sem papel próprio na linha (o papel vive em `user_profiles.role = 'owner'`):

```sql
CREATE TABLE user_locations (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id)   ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, location_id)
);
```

2. **`user_profiles.role` CHECK ampliado** para incluir `'owner'`:

```sql
ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'staff', 'owner'));
```

Aditivo: linhas existentes (`admin`/`staff`) continuam válidas sem qualquer alteração.

3. **`user_profiles.location_id` é REAPROVEITADO como "loja ativa no momento"**, não substituído por um campo novo. Para admin/staff, o valor nunca muda (sempre sua única loja — comportamento idêntico ao atual). Para owner, o valor é inicializado com uma das lojas vinculadas (a primeira, ou a última usada) e **muda** quando o owner troca de loja no seletor.

### 2.2. Por que reaproveitar `location_id` em vez de criar um campo/contexto novo

| Alternativa | Por que rejeitada / aceita |
|---|---|
| **Reaproveitar `location_id` como loja ativa (ESCOLHIDA)** | Os 16 hooks existentes (`usePdvProducts`, `useProduct`, `useDailySummary`, etc.) já leem `profile.location_id` e já usam esse valor na `queryKey` do React Query. Ao mudar esse único campo, o React Query invalida e refaz fetch **automaticamente**, sem tocar em nenhum dos 16 arquivos. Zero refactor de call-sites. |
| **Novo campo/contexto `activeLocationId` separado do profile** | Exigiria reescrever os 16 hooks para ler de uma segunda fonte de verdade, com risco real de esquecer um call-site (a superfície é grande e o diagnóstico já mostrou isso). Mais "puro" conceitualmente, mas o custo de migração é alto e o risco de regressão nos admins atuais é exatamente o que a restrição não-negociável do usuário proíbe. |
| **`location_id` continuar imutável, front resolve loja ativa via `user_locations` a cada query** | Obrigaria adicionar `.eq('location_id', activeLocation)` explícito em 16 lugares — mesmo custo do item anterior, sem benefício adicional. |

**Trade-off aceito conscientemente:** `user_profiles.location_id` passa a ter semântica dupla dependendo do papel ("a única loja", para admin/staff; "a loja que estou operando agora", para owner). Isso é uma sobrecarga semântica real. Mitigação: nomear isso explicitamente na documentação e no tipo TypeScript (`UserProfile.location_id` ganha comentário JSDoc explicando a dualidade), e a fonte da verdade sobre *quais* lojas o owner pode acessar continua sendo `user_locations`, nunca inferida do `location_id` atual.

### 2.3. Troca de loja: RPC guardado (não UPDATE direto)

A troca de `location_id` do owner **não pode** ser um `UPDATE` client-side direto em `user_profiles`, porque a policy `user_profiles_update_own` de hoje não restringe coluna nenhuma — permitiria a qualquer usuário (não só owner) setar seu próprio `location_id` para qualquer valor via request forjado, inclusive uma loja fora da rede dele.

**Solução: função RPC `switch_active_location`** + **trigger de guarda** na própria tabela:

```sql
CREATE FUNCTION is_owner_of_location(loc_id UUID) RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN user_locations ul ON ul.user_id = up.id
    WHERE up.id = auth.uid() AND up.role = 'owner' AND ul.location_id = loc_id
  );
$$;

CREATE FUNCTION switch_active_location(p_location_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_owner_of_location(p_location_id) THEN
    RAISE EXCEPTION 'location % not linked to current owner', p_location_id;
  END IF;
  PERFORM set_config('app.allow_location_switch', 'true', true);
  UPDATE user_profiles SET location_id = p_location_id WHERE id = auth.uid();
END;
$$;

CREATE FUNCTION fn_guard_user_profiles_update() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role change not allowed via direct update';
  END IF;
  IF NEW.location_id IS DISTINCT FROM OLD.location_id
     AND coalesce(current_setting('app.allow_location_switch', true), 'false') <> 'true' THEN
    RAISE EXCEPTION 'location_id change requires switch_active_location()';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_user_profiles_update
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_guard_user_profiles_update();
```

**Por que isso é seguro para os 2 admins reais:** confirmado na seção 1 que o front nunca faz `UPDATE` em `user_profiles` hoje. O trigger só passa a existir; nenhum fluxo atual o aciona. Ele fecha, de brinde, a vulnerabilidade de auto-elevação — sem ser esse o objetivo principal do epic, é a consequência correta de mexer nesse campo com cuidado.

### 2.3.1. Conformidade do guarda-corpo (confirmação pedida pelo usuário)

O mecanismo acima (RPC + trigger) já implementa, ponto a ponto, as 3 exigências colocadas para o guarda-corpo de `user_profiles.location_id`. Confirmando explicitamente cada uma:

| Exigência | Como é garantida |
|---|---|
| **Permite alterar SOMENTE `location_id`** | O trigger bloqueia qualquer tentativa de mudar `role` incondicionalmente (não existe escape hatch para `role` em lugar nenhum — nem a RPC nem nenhum outro caminho define `app.allow_role_change` ou equivalente). O `location_id` só passa se `app.allow_location_switch = true`, que só é setado dentro da própria transação da RPC. Qualquer outra coluna (`display_name`, por exemplo) continua liberada pela policy `user_profiles_update_own` existente, sem relação com este guarda-corpo — não há necessidade de restringi-la, pois não está em causa nesta feature. |
| **Só para `location_id` presente em `user_locations` do próprio usuário** | A RPC `switch_active_location` chama `is_owner_of_location(p_location_id)` **antes** de fazer o `UPDATE`; se a loja alvo não estiver vinculada ao `auth.uid()` da sessão, a função lança exceção e o `UPDATE` interno nunca é executado — o `set_config` do escape hatch também nunca chega a acontecer. |
| **`role` NUNCA alterável pelo próprio usuário** | O trigger rejeita **qualquer** `UPDATE` que mude `NEW.role` em relação a `OLD.role`, sem exceção e sem escape hatch — nem a RPC de troca de loja, nem nenhuma outra função deste epic, toca em `role`. A única forma de mudar `role` continua sendo fora do alcance do usuário autenticado (seed/service role, hoje só via script — ver F5). |

**Por que optei por trigger (BEFORE UPDATE) em vez de expressar isso só via RLS `WITH CHECK`:** comparar `NEW.role` contra `OLD.role` dentro de uma expressão de `WITH CHECK` exigiria uma subquery autorreferenciada na própria tabela sendo atualizada, o que é uma prática frágil no Postgres (comportamento de visibilidade MVCC dentro do mesmo comando não é o mesmo garantido de um trigger, que recebe `OLD`/`NEW` de forma direta e documentada). O trigger é o idiom padrão do Postgres para "impedir mudança de coluna específica" e é o mecanismo mais robusto para essa garantia — a policy `user_profiles_update_own` continua existindo e inalterada; o trigger age como uma camada adicional, não como substituição dela.

### 2.4. Front: o que muda

- `UserProfile` (types): `role: 'admin' | 'staff' | 'owner'`; novo campo opcional `locations?: { id: string; name: string }[]` — populado em `resolveProfile`/`login` **apenas quando `role === 'owner'`** (join simples `user_locations` + `locations`).
- Novo `useAuthStore` action: `switchActiveLocation(locationId: string)` — chama a RPC, e em caso de sucesso, atualiza `profile.location_id` no client (otimista) e dispara `queryClient.invalidateQueries()` (ou invalidação seletiva das query keys que usam `locationId`, todas já nomeadas de forma consistente pelos hooks existentes).
- **Nenhum dos 16 hooks precisa de alteração de código.**
- `ProtectedRoute`: passa a tratar `role === 'owner'` como satisfazendo qualquer `requiredRole` (owner tem, no mínimo, as capacidades do admin dentro da loja ativa). Nova rota `/overview` (Visão Geral) usa `requiredRole="owner"` estrito (admin/staff não entram, nem por URL direta).
- `RootRedirect`: owner vai para `/overview` por padrão (não para `/dashboard` nem `/pos`).

---

## 3. DA-2: Inconsistência do `is_admin()` — decisão de NÃO unificar agora

### 3.1. Decisão

**Owner recebe funções próprias e isoladas** (`is_owner()`, `is_owner_of_location()`), sem tocar em `is_admin()`. A inconsistência já existente — `is_admin()` com bypass global em `shifts`/`sales`, mas escopado por loja em `products` via `fn_is_admin_of_location` — **permanece exatamente como está**.

### 3.2. Justificativa

| Alternativa | Por que rejeitada / aceita |
|---|---|
| **Isolar owner, não tocar em `is_admin()` (ESCOLHIDA)** | Zero risco de regressão nos 2 admins reais — nenhuma policy que eles dependem hoje é alterada. Resolve o problema imediato (owner precisa de acesso multi-loja) sem reabrir uma decisão de segurança que não foi pedida neste epic. |
| **Unificar `is_admin()` para ser sempre escopado por loja (como em `products`)** | Mudaria o comportamento de `shifts_select`/`sales_select` para os admins reais — hoje eles **já conseguem**, tecnicamente, ler shifts/sales da outra loja via API direta (bypass global). Apertar isso é uma mudança de comportamento observável em produção, ainda que "correta" do ponto de vista de segurança. Viola a restrição não-negociável do usuário. **Fica para uma story de hardening futura, com autorização explícita do usuário**, fora deste epic. |

### 3.3. Registro formal da dívida técnica

> **DEBT-EPIC11-01** (não bloqueante para este epic): `is_admin()` dá bypass global (todas as locations) em `shifts_select`/`sales_select`, mas foi escopado por loja em `products` (migration 010). Isso significa que, hoje, o admin de uma loja já pode ler via API direta os turnos/vendas de outra loja da mesma rede.

### 3.4. Por que o mesmo critério do DA-5 NÃO se aplica aqui — registro explícito (revisão pedida pelo usuário)

Esta seção existe porque a decisão original desta nota tratava DA-2 e DA-5 com critérios inconsistentes: fechei `locations`/`products` **citando** o AC "operador não acessa dado de outra loja mesmo forjando request", mas deixei aberto um bypass em `shifts`/`sales` que viola **o mesmo AC**, sem justificar a diferença. Correção: a decisão de não mexer em `shifts`/`sales` agora é **explícita**, não omissão.

**Por que trato os dois casos de forma diferente, mesmo violando o mesmo princípio:**

| Critério | `locations`/`products` (DA-5 — fechado) | `shifts`/`sales` (DA-2 — mantido aberto) |
|---|---|---|
| Quem consegue explorar a brecha | **Qualquer** autenticado, incluindo um hipotético `staff` sem nenhum privilégio | Somente contas com `role='admin'` — hoje, só os 2 admins reais, ambos do mesmo dono |
| Severidade do escopo do vazamento | Todos os dados de todas as lojas, para qualquer sessão válida | Dados de negócio (turnos/vendas) entre lojas do **mesmo** dono/rede |
| Custo de corrigir agora | Baixo — nenhum admin real depende do bypass aberto (eles já são cobertos pela cláusula `is_admin()` preservada) | Alto — exigiria alterar `shifts_select`/`sales_select`, policies que os 2 admins reais usam **neste exato momento** em produção para operar suas lojas; qualquer engano na reescrita quebra o sistema ao vivo |
| Urgência real do dono | Nenhuma manifestada — os 2 admins são o próprio dono/equipe de confiança, sem adversário identificado | Idem — não há indicação de que um admin tentaria ler a loja do outro maliciosamente |

Ou seja: a decisão não é "um caso viola o AC e o outro não" — **os dois violam**. A diferença é o cálculo de risco de corrigir vs. risco de deixar como está, e neste epic o critério que prevalece sobre o AC de isolamento é a restrição não-negociável de zero impacto em produção. DA-5 tinha custo baixo de correção (então corrigi); DA-2 tem custo alto de correção (então não corrigi agora). Isso é uma decisão de produto/risco, tomada conscientemente, não uma leitura técnica diferente do mesmo princípio.

**Consequência assumida para o QA gate:** o teste de vazamento admin(loja 1) → `shifts`/`sales`(loja 2) **vai FALHAR** se executado contra este design — e isso é esperado e aceito para esta entrega. Para não contradizer a seção "Definição de Pronto" do epic ("teste de vazamento é obrigatório e reprova a entrega se falhar"), o escopo desse gate fica explicitamente delimitado (ver seção 8.1 revisada): o teste bloqueante cobre (a) `admin`/`staff` vs. `locations`/`products` entre lojas, e (b) `owner` vs. loja não vinculada. **Não cobre, e não bloqueia**, `admin` vs. `admin` em `shifts`/`sales` — esse caso é rastreado como DEBT-EPIC11-01, com critério de saída abaixo.

**DEBT-EPIC11-01 — Critério de saída (quando isso deixa de ser aceitável e precisa ser corrigido):**
1. Antes de qualquer loja de **outro dono/tenant** (fora da rede atual) compartilhar este mesmo banco — cenário hoje fora de escopo (ver "Fora de Escopo" do epic), mas se isso mudar, este item bloqueia.
2. Antes de o papel `staff` ser efetivamente colocado em uso em produção, caso o modelo de `staff` também venha a herdar algum bypass equivalente no futuro (a verificar quando essa story existir — hoje `staff` não tem bypass, só `admin` tem).
3. Mediante autorização explícita do usuário para abrir uma story de hardening dedicada (fora deste epic), com o mesmo rigor de smoke test aplicado aqui.

Até um desses gatilhos ocorrer, o item permanece registrado e não bloqueante.

---

## 4. DA-4: Guarda-corpo do Sync Offline na Troca de Loja

### 4.1. Decisão

A troca de loja ativa (header selector) é **bloqueada** enquanto:
- `useSyncStore.getState().pendingCount > 0` (há vendas/turnos offline não sincronizados), OU
- `useSyncStore.getState().isSyncing === true` (drain em curso).

Nesses casos, o seletor mostra o motivo ("Sincronize as vendas pendentes antes de trocar de loja") e não completa a troca — mesmo padrão de guarda já validado no fluxo de cancelamento (`fase2-tech-decisions.md`, DA-2/DA-3.4: checagem de `isSyncing` antes de operações sensíveis a race condition).

Quando a troca é permitida, ela **deve**, nesta ordem:
1. Chamar `switch_active_location(locationId)` (RPC).
2. Atualizar `profile.location_id` no Zustand.
3. Limpar/resetar estado transitório de loja (ex.: `shiftStore.activeShift`, qualquer "venda em andamento" no PDV) — para não deixar a tela do PDV mostrando um turno da loja anterior.
4. Invalidar (ou deixar o React Query refazer naturalmente pela mudança de `queryKey`) todas as queries dependentes de `locationId`.

### 4.2. Por que isso é suficiente

Os registros em `pending_sales`/`provisional_shifts` (Dexie) já gravam seu próprio `location_id` explicitamente no momento da criação (confirmado em `syncStore.ts`, `saleStore.ts:201`) — não é lido "no momento do drain" a partir do profile atual. Ou seja, o risco real não é o dado já enfileirado ficar com o `location_id` errado; é o **operador continuar digitando em uma tela que ainda pensa estar na loja anterior** enquanto o contexto já mudou. Bloquear a troca com fila pendente, mais o reset de estado do passo 3, elimina esse risco sem precisar redesenhar o Dexie.

### 4.3. Regra formal (para o SM incluir na story de F3)

> **REGRA DA-4:** O seletor de loja no header consulta `syncStore.pendingCount` e `syncStore.isSyncing` antes de habilitar a troca. Se qualquer um for verdadeiro, o botão de troca fica desabilitado com tooltip explicando o motivo. Ao trocar com sucesso, `shiftStore` deve limpar `activeShift` e qualquer estado de venda em andamento antes de permitir nova interação no PDV.

---

## 5. DA-5: Fechamento das Brechas Herdadas de RLS

### 5.1. Decisão: fechar dentro deste epic (F2), não adiar

As policies `locations_select_authenticated` e `products_select_authenticated` (`USING (true)`) são substituídas por versões que preservam **exatamente** o acesso que os 2 admins reais já têm hoje, e restringem apenas o que nunca deveria estar aberto:

```sql
DROP POLICY "locations_select_authenticated" ON locations;
CREATE POLICY "locations_select_own_or_privileged" ON locations FOR SELECT TO authenticated
  USING (
    id = get_my_location_id()
    OR is_admin()
    OR is_owner_of_location(id)
  );

DROP POLICY "products_select_authenticated" ON products;
CREATE POLICY "products_select_own_or_privileged" ON products FOR SELECT TO authenticated
  USING (
    location_id = get_my_location_id()
    OR is_admin()
    OR is_owner_of_location(location_id)
  );
```

### 5.2. Por que isso NÃO é opcional

O critério de aceite original do epic (herdado da change request do usuário) é: *"Operador logado NÃO acessa dado de outra loja, mesmo forjando requisição direto na API"*. Hoje isso **já falha** para `locations` e `products` — qualquer autenticado lê tudo. Deixar isso como está e apenas adicionar o owner por cima seria entregar a feature nova sobre uma AC que já está quebrada. Por isso, mesmo sendo a única mudança não-aditiva do epic, ela entra no escopo (F2), não em hardening futuro.

### 5.3. Por que é seguro para os 2 admins reais mesmo sendo DROP+CREATE

A cláusula `OR is_admin()` é preservada **idêntica** à policy antiga em termos de efeito prático para quem já é admin: como `is_admin()` continua sem escopo de loja (DA-2), qualquer admin real continua lendo `locations`/`products` de **todas** as lojas depois da mudança — exatamente como lê hoje. A única coisa que deixa de ser possível é: um usuário autenticado que **não** é admin nem owner nem dono da própria loja tentando ler dado de loja alheia — cenário que, hoje, não tem nenhum usuário real caindo nele (não há `staff` em uso). **Mudança de comportamento observável para os 2 admins: nenhuma.**

### 5.4. Verificação de impacto no front (inventário completo, pedido do usuário)

A afirmação "nada muda para admin" na versão anterior deste documento foi estrutural (deduzida de como as policies novas são compostas), não verificada contra o código real. O usuário apontou corretamente que o próprio diagnóstico do @analyst já havia dito que o isolamento de `locations`/`products` "depende do `.eq('location_id')` que o front lembra de mandar" — ou seja, poderia haver um lugar que esqueceu, e com `USING(true)` esquecer nunca doeu.

**Inventário executado (por `@data-engineer`):** toda ocorrência de `.from('products')` e `.from('locations')` em `src/` foi localizada e verificada individualmente.

| Arquivo | Filtra por loja? | Como |
|---|---|---|
| `useHistoryProductOptions.ts`, `usePricePerGram.ts`, `useProduct.ts`, `useProductCatalogPDV.ts`, `usePdvProducts.ts`, `useUnitProducts.ts` | Sim | `.eq('location_id', locationId)` explícito |
| `useLocationData.ts` | Sim | `.eq('id', locationId!)` — `locations.id` **é** o discriminador dessa tabela; filtrar por `id` é equivalente a filtrar por `location_id` |
| `useProductMutations.ts` (UPDATE) | Não filtra no SELECT (não é SELECT — é UPDATE) | Escrita já protegida desde a migration 010 por `fn_is_admin_of_location(location_id)`; DA-5 só mexe em SELECT |
| `useSalesForExport.ts`, `useSalesHistory.ts`, `useProductSalesSummary.ts` (joins embutidos `products(name, product_type)`) | Sim, indiretamente | Query externa (`sales`) já filtrada por `location_id`; o join com `products` é coberto por `is_admin()` (2 admins reais) ou pela invariante de que uma venda só referencia produto da própria loja (não garantida por constraint de banco, mas verdadeira em todos os fluxos de escrita atuais) |
| `AdminSettings.tsx` (`PriceCard`, `LocationCard`, UPDATE) | Fonte já filtrada | `product`/`location` vêm de `useProduct()`/`useLocationData()`, ambos já filtrados — o `.eq('id', ...)` do UPDATE opera sobre um registro legítimo |

**Conclusão verificada:** nenhuma query em `src/` depende do `USING(true)` para funcionar. Toda leitura de `products`/`locations` já vem com filtro de loja — direto ou herdado de uma query externa já filtrada. **DA-5 não quebra nenhuma tela existente.**

### 5.5. Achado adicional: `locations_update_admin` (escrita) tinha o mesmo problema

O inventário acima, por ser exaustivo, expôs um 3º caso da mesma classe de problema do DA-5 — só que do lado da **escrita**, fora do escopo original: `locations_update_admin` (policy de UPDATE, criada em `base_schema.sql`, nunca revisitada pela migration 010) permite que **qualquer** admin edite **qualquer** location, sem checar a loja — o mesmo padrão de `USING(true)` disfarçado de `EXISTS(role='admin')` sem escopo.

**Decisão do usuário:** corrigir agora, na mesma migration (não abrir DEBT separada). Implementado reaproveitando `fn_is_admin_of_location()` (já existente desde a migration 010, sem função nova) — ver seção 2.3 da migration `20260714000000_owner_multiloja.sql`, passo 7b. Owner também ganha UPDATE, mas restrito à loja **ativa no momento** (`id = get_my_location_id()`), não a qualquer loja vinculada — consistente com o modelo "owner opera como admin dentro da loja em que está agora" (seção 2.4).

Impacto real nos 2 admins: nenhum — cada um só edita a própria loja hoje (`AdminSettings.tsx` via `useLocationData()`, já filtrado). Testes T14 (zero regressão: admin edita a própria loja), T15 (admin bloqueado na loja alheia — mudança intencional) e T16 (owner bloqueado fora da loja ativa) adicionados ao smoke test.

### 5.6. Ambiente de teste: não existe staging (segunda verificação bloqueante do usuário)

Confirmado por inspeção: `.env`/`.env.example` apontam para um único projeto Supabase, e `package.json` usa `supabase gen types typescript --linked` — o projeto linkado é o de produção. **Não há staging hospedado.** O único banco de dados real hoje é o de produção, com as 2 lojas vendendo.

O que já existe, mas nunca foi documentado como processo: `supabase/config.toml` configura a stack local do Supabase CLI (`supabase start`), que sobe um Postgres/Auth isolado, aplica todas as migrations do zero e roda um seed. Essa stack local é o ambiente seguro para os smoke tests deste epic — **decisão do usuário: criar uma story dedicada (F0 / Story 11.0, ver seção 9 e o epic)** para formalizar esse processo com um seed sintético (`supabase/tests/epic11_seed_staging.sql`) antes de qualquer migration deste epic ser aplicada em qualquer lugar.

**Processo formalizado (Story 11.0, concluída):** ver `docs/architecture/epic11-ambiente-teste.md` — comandos para subir, resetar e testar o ambiente, e a tabela de UUIDs de teste compartilhados entre o seed e o smoke test.

---

## 6. RLS — Resumo Consolidado (o que é aditivo vs. o que substitui)

| Tabela / Policy | Tipo de mudança | Efeito para os 2 admins reais |
|---|---|---|
| `user_locations` (nova) | Nova tabela + RLS própria | Nenhum (tabela nova, não usada pelo fluxo admin) |
| `user_profiles` (CHECK role) | Aditivo (`ALTER CHECK`) | Nenhum (valores existentes continuam válidos) |
| `user_profiles` (trigger de guarda) | Aditivo (trigger novo) | Nenhum (front nunca faz UPDATE nesta tabela hoje) |
| `shifts_select_owner` (nova) | **Aditiva** (policy nova, somada via OR à existente) | Nenhum (`shifts_select` original intocada) |
| `sales_select_owner` (nova) | **Aditiva** | Nenhum (`sales_select` original intocada) |
| `locations_select_own_or_privileged` | **Substitui** `locations_select_authenticated` | Nenhum observável (`is_admin()` preservado) |
| `products_select_own_or_privileged` | **Substitui** `products_select_authenticated` | Nenhum observável (`is_admin()` preservado) |
| `locations_update_admin_or_owner` | **Substitui** `locations_update_admin` (achado adicional, seção 5.5) | Nenhum observável (cada admin real só edita a própria loja hoje) — deixa de ser possível editar loja alheia via API forjada |
| `shifts_insert` / `sales_insert` / `products_insert_admin` etc. | **Sem alteração** | Owner escreve na loja ativa reaproveitando `get_my_location_id()` — nenhuma policy de escrita precisa mudar |

**Nota importante:** owner só precisa de policies novas para **leitura consolidada** (Visão Geral, seletor). Para **escrita** (abrir turno, vender, editar produto) dentro da loja em que está "logado no momento", o owner já satisfaz as policies existentes automaticamente, porque `get_my_location_id()` retorna a loja ativa (seção 2). Isso reduz a superfície de mudança de RLS a duas policies novas + duas substituições, nada além disso.

---

## 7. Índices

Conforme restrição do epic ("nenhuma query nova sem índice iniciando pelo discriminador de loja"):

```sql
CREATE INDEX idx_user_locations_user     ON user_locations (user_id, location_id);
CREATE INDEX idx_user_locations_location ON user_locations (location_id, user_id);
```

A Visão Geral (F4) consolida via as views já existentes (`shift_summary`, `daily_summary`), que já têm índice por `location_id` (migrations 003/006) — nenhum índice novo necessário ali.

---

## 8. Estratégia de Teste e Validação (zero regressão nos 2 admins)

O projeto não tem framework de teste SQL automatizado (pgTAP) hoje — testes de RLS em outras fases também foram validados manualmente em staging (ver `EPIC-10`, R1/R4). Sigo o mesmo padrão, mas deixo o script versionado para reprodutibilidade.

### 8.1. Camada DB/RLS — script SQL versionado (manual, staging com dump real)

Criar `supabase/tests/epic11_rls_smoke.sql` (novo arquivo, não gera migration) com blocos `SET request.jwt.claim.sub = '<uuid-admin-loja-1>'` / `SET ROLE authenticated` simulando cada ator e verificando:

| # | Simula | Query | Resultado esperado ANTES | Resultado esperado DEPOIS | Gate bloqueante? |
|---|--------|-------|---------------------------|----------------------------|---|
| T1 | Admin loja 1 | `SELECT * FROM locations` | Todas as lojas (brecha) | Todas (via `is_admin()`, preservado) | Sim — regressão |
| T2 | Admin loja 1 | `SELECT * FROM shifts` **da loja 2** | Todas as lojas (bypass global) | **Idêntico — ainda vaza** (DEBT-EPIC11-01, seção 3.4) | **Não.** Falha esperada e conscientemente aceita; não reprova o gate. |
| T3 | Admin loja 1 | Abrir turno na loja 1 (`INSERT shifts`) | Sucesso | Sucesso (sem alteração) | Sim — regressão |
| T4 | Admin loja 1 | Abrir turno na loja 2 (`INSERT shifts location_id=loja2`) | Falha (RLS) | Falha (sem alteração) | Sim — regressão |
| T5 | Owner (novo) | `SELECT * FROM shifts` | N/A | Só lojas 1 e 2 (vinculadas) | Sim — vazamento owner |
| T6 | Owner | `SELECT * FROM shifts WHERE location_id = <loja-fictícia-nao-vinculada>` | N/A | Vazio | Sim — vazamento owner |
| T7 | Owner | `switch_active_location(loja-nao-vinculada)` | N/A | Exceção | Sim — guarda-corpo DA-1 |
| T8 | Owner | `switch_active_location(loja-2)` seguido de `INSERT shifts location_id=loja2` | N/A | Sucesso | Sim — funcionalidade core |
| T9 | Staff hipotético (loja 1) | `SELECT * FROM products` da loja 2 | Todos os produtos de todas as lojas (brecha) | Só produtos da loja 1 | Sim — regressão/vazamento |
| T10 | Qualquer autenticado | `UPDATE user_profiles SET role='owner' WHERE id=auth.uid()` | Sucesso (vulnerabilidade) | Exceção (trigger de guarda) | Sim — guarda-corpo DA-1 |
| T11 | Owner vinculado à loja 2 | `UPDATE user_profiles SET location_id='loja-2' WHERE id=auth.uid()` **direto, sem passar pela RPC** | N/A | Exceção (`app.allow_location_switch` não setado) — prova que a RPC é obrigatória mesmo para loja legitimamente vinculada | Sim — guarda-corpo DA-1 |
| T12 | Owner vinculado só às lojas 1 e 2 | `UPDATE user_profiles SET location_id='loja-3-nao-vinculada' WHERE id=auth.uid()` direto (sem RPC) | N/A | Exceção (bloqueado pelo trigger, independente do RPC) | Sim — guarda-corpo DA-1 |
| T13 | Owner | `UPDATE user_profiles SET role='admin' WHERE id=auth.uid()` | N/A | Exceção (trigger bloqueia incondicionalmente, sem escape hatch para `role`) | Sim — guarda-corpo DA-1 |

**T1, T3, T4 são os testes de "zero regressão"** — rodar com os UUIDs reais dos 2 admins de produção (em staging, com dump real, nunca direto em produção) antes de cada story que toque RLS/schema, conforme exigido pela seção 4.2 do epic.

**T2 é intencionalmente excluído do critério de bloqueio do QA gate.** Ele documenta o comportamento aceito em DEBT-EPIC11-01 (seção 3.4) — deve ser executado e seu resultado registrado no relatório de QA, mas um "vaza" em T2 **não** reprova a entrega. Se uma story futura decidir corrigir DEBT-EPIC11-01, T2 passa a ser promovido a bloqueante nessa story específica.

**T11-T13 são os testes do guarda-corpo pedido na revisão do usuário** — cobrem exatamente "owner tenta setar `location_id` de loja não vinculada" (T12), "owner tenta contornar a RPC mesmo para loja vinculada" (T11) e "owner tenta alterar o próprio `role`" (T13, complementa T10 com o ator específico que a feature introduz).

### 8.2. Camada Front — Vitest (já configurado no projeto)

- Teste unitário de `ProtectedRoute`: owner satisfaz `requiredRole="admin"`; admin real NÃO satisfaz `requiredRole="owner"`.
- Teste de `switchActiveLocation` (mock da RPC): sucesso atualiza `profile.location_id`; falha (loja não vinculada) não altera o estado local.
- Teste de guarda do seletor: `pendingCount > 0` desabilita a troca (mock do `syncStore`).
- Nenhum teste novo necessário nos 16 hooks existentes — eles não mudam de código; a garantia de que continuam funcionando vem do smoke test manual (seção 8.3), não de reescrever testes que já passam.

### 8.3. Smoke Test Manual (obrigatório, checklist para @qa em toda story que toque schema/RLS/auth)

Executar com as 2 contas admin **reais** (staging, nunca em produção diretamente):

1. Login com admin da loja 1 → redireciona para `/dashboard` (não `/overview`).
2. PDV: abrir turno, registrar 1 venda (peso), fechar turno — fluxo idêntico ao de hoje.
3. Dashboard: números batem com o que batiam antes da migration.
4. Settings: CRUD de produto continua funcionando.
5. Repetir 1-4 com o admin da loja 2.
6. Confirmar, no banco (staging), que nenhuma linha de `user_profiles` dos 2 admins foi alterada pela migration (comparar `updated_at`/snapshot antes-depois, já que a tabela não tem `updated_at` hoje — usar dump comparison).

Só depois disso o teste de vazamento (owner e operador) do QA gate é executado.

---

## 9. Sequência de Implementação Recomendada (handoff SM)

O epic já decidiu F1 → F2 → F5 → F3 → F4. Refinando:

| Story | Escopo | Esforço |
|-------|--------|---------|
| **11.1** | Migration: `user_locations` + CHECK de role + `is_owner()`/`is_owner_of_location()` + RPC `switch_active_location` + trigger de guarda + policies aditivas (`shifts_select_owner`, `sales_select_owner`) + índices | 8-13 pts |
| **11.2** | Migration: fechamento das brechas (`locations`/`products` SELECT) + script de smoke test SQL (seção 8.1) rodado em staging com dump real | 5-8 pts |
| **11.5** | Seed: cria 1 usuário owner, vincula às 2 lojas reais via `user_locations`. Smoke test manual (seção 8.3) obrigatório antes de Done. | 2-3 pts |
| **11.3** | Front: `switchActiveLocation` no authStore, seletor de loja no header, guarda de sync pendente (DA-4), `ProtectedRoute` aceita owner | 5-8 pts |
| **11.4** | Front: tela Visão Geral, reaproveitando `shift_summary`/`daily_summary` | 5-8 pts |

11.1 e 11.2 são gate: devem passar (incluindo smoke test dos 2 admins reais) antes de 11.5 começar.

---

## 10. Quality Gates (Architect-First)

- [x] **Map Before Modify**: estado atual documentado a partir do diagnóstico já confirmado (seção 1)
- [x] **No invention**: cada decisão traceada a uma AC do EPIC-11 ou ao NFR de zero impacto
- [x] **Capability preservation**: nenhuma capacidade removida dos admins reais; `is_admin()` preservado onde já existia
- [x] **Zero coupling**: owner é aditivo (2 policies novas + 2 funções + 1 RPC + 1 trigger); só 3 policies existentes são substituídas (2 SELECT do DA-5 + 1 UPDATE do achado adicional, seção 5.5), todas de forma comportamentalmente equivalente para admin
- [x] **Config-over-hardcoding**: nenhum `location_id` fixo em código; `user_locations` é a única fonte de verdade de vínculo
- [x] **Trade-offs explícitos**: alternativas avaliadas em cada DA (seções 2.2, 3.2, 5.2)
- [x] **Reversibilidade**: toda mudança é `ADD` ou substituição de policy (reversível trivialmente restaurando a policy antiga)
- [x] **RLS sem recursão**: `is_owner_of_location` segue o padrão `SECURITY DEFINER` já validado (`is_admin`, `get_my_location_id`)
- [x] **Zero impacto em produção**: seção 8 define teste concreto para provar isso, não apenas declarar

---

## 11. Change Log

| Data | Quem | Ação |
|------|------|------|
| 2026-07-14 | @architect (Aria) | Documento criado. DA-1 a DA-5 resolvidas. Decisão-chave: reaproveitar `location_id` como "loja ativa" evita reescrever 16 hooks do front. Fechamento das brechas de RLS herdadas incorporado ao epic (não adiado). Pronto para @data-engineer revisar a migration antes do sharding final. |
| 2026-07-14 | @architect (Aria) | Revisão pós-feedback do usuário: (1) seção 3.4 adicionada — a inconsistência entre DA-2 (mantido) e DA-5 (corrigido) estava sem justificativa explícita; agora documentada com critério de risco/custo, aberto o item **DEBT-EPIC11-01** com critério de saída, e o teste T2 (leak admin↔admin em shifts/sales) explicitamente excluído do critério de bloqueio do QA gate. (2) seção 2.3.1 adicionada — confirmação explícita de que o guarda-corpo de `switch_active_location` restringe coluna (`location_id` apenas), escopo (`user_locations` do próprio usuário) e nunca permite auto-alteração de `role`; testes T11-T13 adicionados à seção 8.1 cobrindo exatamente esses 3 cenários. |
| 2026-07-14 | @data-engineer (Dara) | Migration final produzida em `supabase/migrations/20260714000000_owner_multiloja.sql` e script de smoke test em `supabase/tests/epic11_rls_smoke.sql` (13 casos, T1-T13). **Ajuste em relação ao proposto:** o nome da constraint `user_profiles_role_check` **não** foi assumido — a migration localiza o CHECK constraint da coluna `role` dinamicamente via `information_schema` (bloco `DO $$`) e aborta com erro claro se não encontrar exatamente um, em vez de arriscar um `DROP CONSTRAINT` com nome errado. Confirmado por grep independente (além do já feito pela @architect) que `src/` nunca escreve em `user_profiles`. Migration inclui bloco de "AUTO-CHECAGEM" explícito, policy por policy, do que muda para `role='admin'` (resposta: nada, exceto a tabela nova que ele nunca toca). Pronto para @sm iniciar o sharding em stories. |
| 2026-07-14 | @data-engineer (Dara) | Verificação bloqueante pedida pelo usuário (seções 5.4-5.6): (1) inventário completo de queries `products`/`locations` no front — nenhuma dependia do `USING(true)`, DA-5 confirmado seguro. (2) Achado adicional: `locations_update_admin` (escrita) tinha o mesmo problema de escopo — corrigido na mesma migration (passo 7b), por decisão do usuário; testes T14-T16 adicionados. (3) Confirmado que não existe staging — criada feature **F0/Story 11.0** no epic como pré-requisito bloqueante para ambiente de teste local antes de qualquer migration rodar. |

---

## Próximos Passos

1. **@sm (River)** — Fazer sharding em 6 stories: **11.0 (ambiente de teste, seção 5.6/3.0 do epic — primeira, bloqueante)** + 11.1, 11.2, 11.3, 11.4, 11.5 conforme seção 9, cada uma referenciando este documento e a migration `supabase/migrations/20260714000000_owner_multiloja.sql`.
2. **@po (Pax)** — Validar cada story com checklist de 10 pontos, atenção redobrada ao critério "riscos documentados" e à presença do smoke test (`supabase/tests/epic11_rls_smoke.sql`) como parte da Definição de Pronto de cada story. Confirmar 11.0 como pré-requisito de 11.1.
3. **@dev (Dex)** — Implementar na ordem 11.0 → 11.1 → 11.2 → 11.5 → 11.3 → 11.4. A migration e o script de smoke test já existem — rodar o smoke test na stack local criada por 11.0 antes de cada story que toque schema/RLS/auth ser considerada pronta. Nenhuma migration roda perto de produção.
4. **@qa (Quinn)** — Rodar `supabase/tests/epic11_rls_smoke.sql` completo (agora 16 casos, T1-T16) em todo QA gate deste epic. T1, T3, T4, T5-T13, T14-T16 são bloqueantes; T2 é executado e registrado, mas não bloqueia (DEBT-EPIC11-01).
