# EPIC-11 — Ambiente de Teste Local (Stack Supabase CLI)

**Origem:** Story 11.0. Referência: seção 5.6 de `epic11-owner-multiloja-tech-decisions.md`.

Este documento formaliza o processo, antes tácito, de subir um ambiente de
teste local isolado para validar migrations e RLS deste epic **sem tocar no
único banco real existente hoje — o de produção, com as 2 lojas vendendo.**

Este ambiente é **efêmero**. Não é um banco de "staging" persistente para
gerenciar manualmente — é descartável e reproduzível a qualquer momento.
Nunca guarde segredos reais nele; use-o apenas para os testes deste epic.

---

## 1. Pré-requisitos

- Supabase CLI instalado (`supabase --version`)
- Docker Desktop rodando (a stack local sobe containers Postgres/Auth/Storage/etc.)
- Nenhum outro projeto Supabase local ocupando as portas do `supabase/config.toml`
  (por padrão: `54321` API, `54322` Postgres, `54323` Studio). Se houver
  conflito, pare o outro projeto com `supabase stop --project-id <nome>` ou
  ajuste as portas em `config.toml`.

## 2. Subir o ambiente

```bash
supabase start
```

Isso aplica **todas** as migrations do repositório, em ordem, do zero —
incluindo `supabase/migrations/20260714000000_owner_multiloja.sql` (schema
do EPIC-11) — e roda `supabase/seed.sql` (o seed de produção, que já cria a
`location` `a0000000-0000-0000-0000-000000000001` e um produto exemplo).

Ao final, o CLI imprime a connection string local do Postgres
(`postgresql://postgres:postgres@127.0.0.1:54322/postgres`) e as URLs de
Studio/API. **Nunca** usar `supabase link` ou apontar essa connection string
para o projeto de produção durante os testes deste epic.

## 3. Rodar o seed sintético do EPIC-11

O seed de produção (`supabase/seed.sql`) não cria os usuários de teste
(`admin`, `owner`, `staff`) necessários para o smoke test de RLS. Para isso,
existe `supabase/tests/epic11_seed_staging.sql`, que:

- Cria 4 usuários reais em `auth.users` + `auth.identities` (autenticáveis
  via GoTrue local, senha `Test@1234` para todos), com UUIDs fixos.
- Cria as 3 `locations` de teste (`loja1`, `loja2`, `loja3_fake` — esta
  última propositalmente **não vinculada** a ninguém).
- Cria os `user_profiles` correspondentes (2 admin, 1 owner, 1 staff).
- Vincula o owner de teste a `loja1` e `loja2` via `user_locations`.

Rodar (a partir da raiz do projeto, com a stack local já de pé):

```bash
docker exec -i supabase_db_acai-mix psql -U postgres -d postgres \
  < supabase/tests/epic11_seed_staging.sql
```

O script é idempotente (`ON CONFLICT DO NOTHING`) e termina com uma
auto-checagem que deve reportar: `auth.users=4`, `locations=3`,
`user_profiles=4`, `user_locations=2`.

**Por que `docker exec` e não `psql` direto?** Este ambiente Windows não
tem `psql` no PATH do host. O container `supabase_db_acai-mix` (nome do
container Postgres da stack local, `supabase_db_<project_id>` conforme
`project_id` em `supabase/config.toml`) já tem `psql` embutido. Se o host
tiver `psql` instalado, a alternativa é apontar direto para a porta local:
`psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/epic11_seed_staging.sql`.

**Por que INSERT direto em `auth.users` em vez da API do GoTrue?** A versão
do Supabase CLI usada não expõe um subcomando de auth admin, e a API REST
do GoTrue não permite especificar o UUID do usuário na criação — mas o
smoke test exige UUIDs fixos (os mesmos usados como placeholder no script).
INSERT direto com `pgcrypto` (`crypt(senha, gen_salt('bf'))`) é o padrão
documentado pela comunidade Supabase para seed local quando UUIDs estáveis
são necessários; os usuários resultantes são reais e autenticáveis via
GoTrue local — não são apenas linhas soltas para satisfazer FK.

## 4. Rodar o smoke test de RLS

```bash
docker exec -i supabase_db_acai-mix psql -U postgres -d postgres \
  < supabase/tests/epic11_rls_smoke.sql
```

Os 16 casos (T1-T16) rodam cada um em sua própria transação com `ROLLBACK`
ao final — sem efeito colateral no ambiente. A interpretação de PASS/FAIL
de cada caso é responsabilidade das Stories 11.1/11.2 (lógica de RLS); a
Story 11.0 garante apenas que o ambiente permite rodar o script ponta a
ponta sem erro de sintaxe/conexão.

**Nota de leitura dos resultados:** em Postgres, uma policy RLS de
`UPDATE`/`DELETE` que exclui uma linha via cláusula `USING` não lança
exceção — o comando só afeta 0 linhas (`UPDATE 0`). Só a cláusula
`WITH CHECK` (ou um `RAISE` explícito em trigger/função) lança exceção.
Ao ler os resultados dos casos T15/T16, "UPDATE 0" sem erro é o
comportamento esperado de bloqueio via RLS — não é falha do ambiente.

## 5. Resetar o ambiente

```bash
supabase db reset
```

Recria o banco do zero (todas as migrations + `seed.sql`), descartando
qualquer dado inserido manualmente — incluindo o seed sintético deste
epic, que precisa ser rodado de novo após o reset (passo 3).

Para descartar o ambiente por completo (containers, não só os dados):

```bash
supabase stop
```

## 6. UUIDs de teste (fixos, compartilhados entre seed e smoke test)

| Papel | UUID | Vínculo |
|---|---|---|
| `admin_loja1` | `00000000-0000-0000-0000-000000000101` | `location_id = loja1` |
| `admin_loja2` | `00000000-0000-0000-0000-000000000102` | `location_id = loja2` |
| `owner_user` | `00000000-0000-0000-0000-000000000201` | vinculado a `loja1` + `loja2` (`user_locations`), `location_id` inicial = `loja1` |
| `staff_loja1` | `00000000-0000-0000-0000-000000000301` | `location_id = loja1` |
| `loja1` | `a0000000-0000-0000-0000-000000000001` | mesma `location` já criada por `seed.sql` de produção |
| `loja2` | `a0000000-0000-0000-0000-000000000002` | nova, só neste ambiente de teste |
| `loja3_fake` | `a0000000-0000-0000-0000-000000000003` | nova, propositalmente **não vinculada** a nenhum usuário |

Fonte única destes valores: `supabase/tests/epic11_rls_smoke.sql` (seção de
`\set` no topo). O seed sintético (`epic11_seed_staging.sql`) reusa
exatamente os mesmos valores — nunca editar um sem editar o outro.
