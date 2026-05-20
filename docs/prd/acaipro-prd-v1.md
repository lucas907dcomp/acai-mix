# AçaiMix — Product Requirements Document

**Versão:** 1.0  
**Status:** Aprovado  
**Owner:** Morgan (PM)  
**Data:** 2026-05-19  
**Referência Técnica:** `docs/architecture/acaipro-system-design.md`

---

## Stakeholders

- **Dono da açaíteria** — usuário primário Admin, financiador, validador final
- **Operadores de caixa** — usuários primários Staff, executores das vendas diárias
- **Morgan (PM)** — responsável pelo PRD e priorização
- **Aria (Architect)** — responsável pelo System Design técnico
- **Dara (Data Engineer)** — responsável pelo schema e RLS do banco

---

## Problema

O dono de uma açaíteria com dois locais controla suas finanças em caderno. Isso gera três problemas diários:

1. **Lentidão no caixa**: calcular peso × preço e troco manualmente atrasa o atendimento no rush
2. **Sem visibilidade**: o dono não sabe quanto vendeu hoje, qual turno performa melhor, qual método de pagamento domina — só descobre no final do dia somando o caderno
3. **Risco na troca de turno**: sem registro automático de fechamento, o saldo entre turnos depende da honestidade e memória dos operadores

O AçaiMix resolve esses três problemas com um sistema web de PDV e dashboard financeiro.

---

## Objetivos do Produto

1. **Velocidade no caixa** — operador completa uma venda em menos de 10 segundos
2. **Visibilidade em tempo real** — dono vê faturamento do dia de qualquer dispositivo
3. **Auditoria automatizada** — fechamento de turno acontece sem intervenção humana, com totais registrados
4. **Resiliência operacional** — sistema funciona sem internet e com balança indisponível

---

## Fora do Escopo — Fase 1

| Item | Justificativa |
|------|---------------|
| Gestão de estoque | Fora do foco do cliente na Fase 1 |
| Emissão de NF-e / Cupom fiscal | Fora do escopo. ⚠️ **RISCO LEGAL**: verificar regime tributário antes do go-live |
| Integração PIX automatizada (QR Code) | PIX é confirmado manualmente pelo operador na Fase 1 |
| Exportação de relatórios (PDF/Excel) | Backlog Fase 2 |
| Horários de turno configuráveis | Hardcoded 16h e 23h na Fase 1 |
| Billing / multi-tenancy | Sistema é single-tenant; não é plataforma SaaS |
| App mobile nativo | Sistema é PWA — acesso mobile via browser |
| Programa de fidelidade | Backlog futuro |

---

## Personas

### Operador (Staff)
- **Perfil**: Funcionário do caixa, jovem adulto, familiaridade básica com tecnologia
- **Dispositivo**: PC fixo de caixa com Chrome desktop
- **Objetivo principal**: Registrar vendas rápido sem erros
- **Dor atual**: Calcular peso × preço na cabeça + troco na calculadora + anotar no caderno
- **Restrição de acesso**: Vê apenas o PDV e histórico do próprio turno

### Dono (Admin)
- **Perfil**: Empreendedor, 30-50 anos, acostumado com WhatsApp e apps simples
- **Dispositivo**: Varia — PC no local, celular em casa, notebook na mesa
- **Objetivo principal**: Saber quanto está vendendo sem precisar estar na loja
- **Dor atual**: Só descobre o resultado do dia quando chega fisicamente na loja ou liga para perguntar
- **Acesso completo**: PDV + Dashboard + Configurações

---

## User Stories — Fase 1

### US-01 — Velocidade no caixa
**Como** Operador,  
**Quero** ver o peso lido automaticamente pela balança e o total calculado em tempo real,  
**Para que** eu não precise calcular nada manualmente e possa focar no atendimento.

**Critérios de aceite:**
- [ ] O peso da balança aparece atualizado na tela do PDV sem ação do operador
- [ ] O total é calculado automaticamente (peso × preço/grama configurado)
- [ ] A operação de confirmar uma venda exige no máximo 2 toques/cliques após o peso estar estável

---

### US-02 — Pagamento em dinheiro com troco
**Como** Operador,  
**Quero** informar o valor recebido em dinheiro e ver o troco calculado automaticamente,  
**Para que** eu não erre o troco e o atendimento seja rápido mesmo com dinheiro.

**Critérios de aceite:**
- [ ] Ao selecionar "Dinheiro", o campo "Valor Recebido" aparece imediatamente
- [ ] Botões de atalho com valores comuns (R$20, R$50, R$100) aceleram a entrada
- [ ] O troco é exibido em destaque visual antes da confirmação
- [ ] A venda só confirma quando o valor recebido ≥ total da venda

---

### US-03 — Histórico do turno no caixa
**Como** Operador,  
**Quero** ver as últimas vendas do turno atual na mesma tela do caixa,  
**Para que** eu possa verificar rapidamente se algum registro ficou errado.

**Critérios de aceite:**
- [ ] Tabela de vendas do turno ativo visível no PDV (últimas 20, com rolagem)
- [ ] Cada linha mostra: horário, peso, valor, método de pagamento
- [ ] A tabela atualiza automaticamente após cada venda confirmada

---

### US-04 — Fallback manual da balança
**Como** Operador,  
**Quero** conseguir digitar o peso manualmente quando a balança não está funcionando,  
**Para que** a loja não pare de vender por causa de uma falha de hardware.

**Critérios de aceite:**
- [ ] Botão "Digitar Peso Manualmente" visível no PDV
- [ ] Ao ativar, um input numérico touch-friendly substitui o display da balança
- [ ] A venda registrada com peso manual fica marcada como `weight_source: manual` no banco
- [ ] A confirmação antes de ativar o modo manual deixa claro ao operador que o peso será auditável

---

### US-05 — Abertura de turno
**Como** Operador,  
**Quero** abrir o turno ao iniciar meu expediente com um clique,  
**Para que** todas as minhas vendas fiquem agrupadas no turno correto.

**Critérios de aceite:**
- [ ] Se não há turno aberto, o PDV exibe tela de "Iniciar Turno" antes de qualquer venda
- [ ] Ao iniciar, o turno é registrado com `opened_at` e `location_id` corretos
- [ ] Não é possível registrar vendas sem um turno ativo aberto

---

### US-06 — Fechamento automático de turno
**Como** Dono,  
**Quero** que os turnos sejam fechados automaticamente às 16h e 23h,  
**Para que** o registro de fechamento aconteça sem depender de nenhum funcionário.

**Critérios de aceite:**
- [ ] Edge Function executa às 16:00 e 23:00 (horário de Brasília) todos os dias
- [ ] Turnos abertos são fechados com snapshot de totais (por método de pagamento)
- [ ] O operador é notificado na UI quando o turno é fechado automaticamente
- [ ] Vendas feitas offline durante a janela de troca de turno são reconciliadas corretamente

---

### US-07 — Modo offline
**Como** Operador,  
**Quero** continuar registrando vendas mesmo sem internet,  
**Para que** uma queda de conexão não interrompa o atendimento.

**Critérios de aceite:**
- [ ] Badge "Offline — N vendas pendentes" aparece quando a conexão cai
- [ ] Vendas são salvas localmente (IndexedDB) com UUID gerado no cliente
- [ ] Ao reconectar, as vendas pendentes são sincronizadas automaticamente para o Supabase
- [ ] Se a queda ocorreu na virada de turno, o sistema cria um turno provisório local e reconcilia corretamente ao sincronizar
- [ ] O operador vê confirmação visual quando o sync é concluído

---

### US-08 — Dashboard de métricas do dia
**Como** Dono,  
**Quero** ver as métricas de vendas do dia em tempo real,  
**Para que** eu saiba como está o negócio de qualquer lugar sem precisar ligar para a loja.

**Critérios de aceite:**
- [ ] Métricas visíveis: Total do dia, Ticket Médio, Nº de vendas, Faturamento por método (PIX/Cartão/Dinheiro)
- [ ] Gráfico de picos de movimento por hora (volume de vendas × horário)
- [ ] Filtro por turno (Turno 1 / Turno 2 / Todos)
- [ ] Dashboard atualiza automaticamente a cada 45 segundos
- [ ] Layout responsivo — funciona em celular, tablet e desktop

---

### US-09 — Acesso remoto do dono
**Como** Dono,  
**Quero** acessar o dashboard de casa pelo celular ou notebook,  
**Para que** eu possa acompanhar as vendas sem precisar estar na loja.

**Critérios de aceite:**
- [ ] Dashboard acessível pela URL do sistema em qualquer browser moderno
- [ ] Login com email e senha funciona em qualquer dispositivo
- [ ] Layout é usável em telas a partir de 375px de largura (celular)
- [ ] Sessão persiste entre visitas (não precisa fazer login toda vez)

---

### US-10 — Gestão de preço do açaí
**Como** Dono,  
**Quero** atualizar o preço por grama do açaí diretamente no sistema,  
**Para que** eu não precise de nenhuma ajuda técnica para reajustar preços.

**Critérios de aceite:**
- [ ] Tela de configurações acessível apenas para Admin
- [ ] Campo para editar o preço por grama com validação (número positivo, 4 casas decimais)
- [ ] Mudança de preço entra em vigor imediatamente para a próxima venda
- [ ] Histórico das últimas 5 atualizações de preço visível na tela de configurações
- [ ] Vendas já registradas não são afetadas por mudança de preço

---

### US-11 — Login seguro por role
**Como** Dono,  
**Quero** que meus operadores tenham acesso apenas ao PDV e não ao dashboard financeiro,  
**Para que** os dados financeiros do negócio fiquem restritos a mim.

**Critérios de aceite:**
- [ ] Login via email e senha para todos os usuários
- [ ] Operadores (Staff) só visualizam PDV e histórico do próprio turno
- [ ] Admin visualiza PDV + Dashboard + Configurações
- [ ] Tentativa de Staff acessar Dashboard redireciona para o PDV
- [ ] Segurança enforced no banco via RLS (não apenas no frontend)

---

## Requisitos Funcionais

| ID | Módulo | Requisito | Prioridade |
|----|--------|-----------|-----------|
| FR-01 | Auth | Login via email/senha (Supabase Auth) | P0 |
| FR-02 | Auth | Proteção de rotas por role (admin/staff) | P0 |
| FR-03 | Auth | RLS no banco separando acesso por role | P0 |
| FR-04 | PDV | Leitura de peso via Web Serial API (UPX Wind D3) | P0 |
| FR-05 | PDV | Cálculo automático total = peso × preço/grama | P0 |
| FR-06 | PDV | Seleção de método de pagamento (PIX/Cartão/Dinheiro) | P0 |
| FR-07 | PDV | Fluxo de troco com input de valor recebido + botões atalho | P0 |
| FR-08 | PDV | Confirmação de venda com registro no Supabase | P0 |
| FR-09 | PDV | Histórico de vendas do turno ativo na tela do PDV | P0 |
| FR-10 | PDV | Modo manual de peso (ManualInputProvider) como fallback | P0 |
| FR-11 | Turnos | Abertura manual de turno pelo operador | P0 |
| FR-12 | Turnos | Fechamento automático às 16h e 23h via Edge Function | P0 |
| FR-13 | Turnos | Snapshot de totais no fechamento de turno | P0 |
| FR-14 | Turnos | Notificação visual ao operador quando turno é fechado | P1 |
| FR-15 | Offline | Fila local de vendas via Dexie.js (IndexedDB) | P0 |
| FR-16 | Offline | Sync automático ao reconectar (drain queue) | P0 |
| FR-17 | Offline | Soft-close de turno no frontend ao atingir 16h/23h offline | P0 |
| FR-18 | Offline | Reconciliação de timestamp no backend (Edge Function sync-sales) | P0 |
| FR-19 | Offline | Badge de status offline com contagem de vendas pendentes | P1 |
| FR-20 | Dashboard | Métricas do dia: total, ticket médio, nº vendas, por método | P0 |
| FR-21 | Dashboard | Gráfico de picos de movimento por hora | P1 |
| FR-22 | Dashboard | Filtro por turno (T1 / T2 / Todos) | P1 |
| FR-23 | Dashboard | Atualização automática a cada 45 segundos | P0 |
| FR-24 | Dashboard | Layout responsivo (desktop + mobile) | P0 |
| FR-25 | Catálogo | Tela admin para editar preço/grama do produto | P0 |
| FR-26 | Catálogo | Histórico de últimas 5 atualizações de preço | P2 |
| FR-27 | Multi-local | Schema preparado com `location_id` em todas as entidades | P0 |

---

## Requisitos Não-Funcionais

| Categoria | Requisito | Métrica |
|-----------|-----------|---------|
| Performance | Confirmação de venda (online) | < 1s |
| Performance | Carregamento inicial da aplicação | < 3s em conexão 10Mbps |
| Performance | Atualização do peso na tela | < 200ms após leitura serial |
| Disponibilidade | Sistema funcional com internet | 99% uptime (Supabase SLA) |
| Disponibilidade | Sistema funcional sem internet | Offline básico — fila local |
| Segurança | Dados financeiros protegidos | RLS enforced no banco — staff não acessa dados de outros locais |
| Segurança | Autenticação | JWT via Supabase Auth, sessão com refresh token |
| Compatibilidade | Dispositivo de caixa | Chrome 89+ ou Edge 89+ (Web Serial API) |
| Compatibilidade | Dashboard do Admin | Qualquer browser moderno — Chrome, Safari, Firefox, Edge |
| Manutenibilidade | Protocolo da balança | Abstraído via IScaleProvider — troca de hardware sem refactor |
| Consistência | Sync offline | Zero perda de dados em queda de internet |
| Consistência | Conflito offline/turno | Reconciliação automática por timestamp |
| Usabilidade | Operação de venda completa | Máximo 2 toques após peso estável |
| Usabilidade | Dashboard mobile | Usável em tela de 375px sem zoom |

---

## Métricas de Sucesso

| Métrica | Atual (baseline) | Meta Fase 1 | Prazo |
|---------|-----------------|-------------|-------|
| Tempo médio para registrar uma venda | ~45s (caderno + calculadora) | < 10s | 30 dias após go-live |
| Perdas por erro de troco | Desconhecido | 0 erros detectados | 30 dias após go-live |
| Frequência de consulta ao dashboard | 0 (não existe) | ≥ 1x por dia pelo Admin | 30 dias após go-live |
| Dados financeiros perdidos por turno | Frequente (caderno impreciso) | 0 perdas após go-live | Go-live |
| Tempo de setup do segundo local | N/A | < 2h (zero migration de schema) | Fase 2 |

---

## Épicos — Fase 1

### EPIC-01: Infraestrutura Base
**Objetivo:** Setup inicial do projeto, Supabase, deploy e pipeline de desenvolvimento.

**Stories (delegar a @sm):**
- Setup do projeto React + Vite + TypeScript + Tailwind + Shadcn
- Configuração do projeto Supabase (Auth, database, Edge Functions)
- Setup de variáveis de ambiente e configuração de desenvolvimento local
- Deploy do frontend (Vercel ou Netlify)

---

### EPIC-02: Autenticação e Controle de Acesso
**Objetivo:** Login seguro com separação de roles Admin/Staff enforced no banco.

**Stories:**
- Tela de login com email/senha (Supabase Auth)
- Setup de `user_profiles` com campo `role` e `location_id`
- Proteção de rotas por role (React Router + RLS)
- Fluxo de redirect por role no login (`/pos` para staff, `/dashboard` para admin)

---

### EPIC-03: Integração com Balança (IScaleProvider)
**Objetivo:** Leitura de peso em tempo real via Web Serial API, com fallback manual.

**Stories:**
- Definição da interface `IScaleProvider` e implementação do `MockScaleProvider`
- Implementação do `SerialScaleProvider` (Web Serial API + parser UPX Wind D3)
- Implementação do `ManualInputProvider` (fallback de hardware)
- Hook `useScale.ts` com gestão de conexão e reconexão automática
- Componente `ScaleConnectionStatus` e `WeightDisplay`

---

### EPIC-04: Módulo PDV / Caixa
**Objetivo:** Interface de venda completa — peso, cálculo, pagamento, confirmação.

**Stories:**
- Layout da página PDV (sidebar fixa + área de conteúdo)
- Integração do display de peso com `scaleStore`
- Cálculo automático total = peso × preço/grama
- `PaymentMethodSelector` com fluxo PIX / Cartão / Dinheiro
- `CashFlow` — input de valor recebido, botões atalho, display de troco
- `ConfirmSaleButton` + `saleStore.confirmSale()` + POST para Supabase
- `ShiftSalesTable` — histórico de vendas do turno ativo no PDV

---

### EPIC-05: Gestão de Turnos
**Objetivo:** Controle de abertura manual e fechamento automático de turnos.

**Stories:**
- Tela de abertura de turno (bloqueio de PDV sem turno ativo)
- `shiftStore` — carregamento e tracking do turno ativo
- Edge Function `close-shift` — fechamento automático às 16h e 23h
- Notificação visual ao operador no fechamento automático
- Visualização de status do turno ativo no PDV (`ShiftStatusBar`)

---

### EPIC-06: Modo Offline e Sincronização
**Objetivo:** Continuidade de vendas sem internet + sync automático ao reconectar.

**Stories:**
- Setup do Dexie.js com schema local para vendas offline
- `syncStore` — detecção de conexão, fila pendente, drain queue
- Soft-close de turno no frontend (lógica de relógio local no `syncStore`)
- Edge Function `sync-sales` com reconciliação de turno por timestamp
- Badge `OfflineIndicator` com contador de vendas pendentes
- Testes de cenário de conflito offline/turno

---

### EPIC-07: Dashboard Financeiro
**Objetivo:** Visibilidade do negócio em tempo real para o dono, de qualquer dispositivo.

**Stories:**
- Setup de queries do dashboard (total dia, ticket médio, por método)
- React Query com polling de 45 segundos
- Componente `MetricCard` para KPIs principais
- Gráfico de picos de movimento por hora (`SalesChart`)
- Filtro de turno no dashboard
- Layout responsivo (desktop + mobile 375px+)
- Rota `/dashboard` protegida por role admin

---

### EPIC-08: Gestão de Catálogo e Configurações
**Objetivo:** Admin pode atualizar preço/grama sem depender de suporte técnico.

**Stories:**
- Tela `/admin/settings` com edição de preço/grama
- Validação do campo de preço (número positivo, 4 casas decimais)
- Histórico das últimas 5 atualizações de preço
- Configurações de nome do local

---

## Riscos do Produto

| Risco | Impacto | Severidade | Mitigação |
|-------|---------|-----------|-----------|
| NF-e / Cupom fiscal obrigatório | Ilegalidade operacional | **CRÍTICO** | Verificar regime tributário antes do go-live. Fora do escopo Fase 1 por decisão consciente. |
| Protocolo serial UPX Wind D3 não documentado | Bloqueio da integração da balança | **HIGH** | IScaleProvider abstraction permite desenvolvimento com Mock; parser validado na instalação |
| Web Serial API indisponível no dispositivo de caixa | PDV sem leitura automática de peso | **HIGH** | Requisito de hardware documentado. ManualInputProvider como fallback permanente |
| Conflito offline + fechamento automático de turno | Corrupção de totais por turno | **CRÍTICO** | Soft-close no frontend + reconciliação por timestamp no backend (EPIC-06) |
| Queda de internet durante pico de vendas | Vendas não registradas | **HIGH** | Offline básico com Dexie.js — fila local + sync automático |
| Falha de hardware da balança | Loja para de vender | **HIGH** | ManualInputProvider como fallback imediato |
| Segundo local não preparado no schema | Migration pesada no futuro | **MEDIUM** | `location_id` em todas as entidades desde a Fase 1 (mitigado no design) |

---

## Questões Abertas

- [ ] **NF-e**: Qual é o regime tributário do cliente? (MEI, Simples Nacional, etc.) — define se é obrigatório emitir nota
- [ ] **Figma**: Análise detalhada pendente com @ux-design-expert. Link: https://fifty-ahead-78230743.figma.site — nome real do projeto confirmado: **AçaiMix**
- [ ] **Protocolo UPX Wind D3**: Manual disponível online? Pesquisa necessária antes da EPIC-03
- [ ] **Horários do segundo local**: Os turnos do segundo local serão iguais (16h e 23h) ou diferentes?
- [ ] **Usuário admin inicial**: Como será criado o primeiro usuário admin? (manual via Supabase Dashboard ou seed script?)

---

## Dependências entre Épicos

```
EPIC-01 (Infra)
    └─► EPIC-02 (Auth)
            └─► EPIC-03 (Balança)
            └─► EPIC-04 (PDV)          ──► depende de EPIC-03
            └─► EPIC-05 (Turnos)
            └─► EPIC-06 (Offline)      ──► depende de EPIC-04 + EPIC-05
            └─► EPIC-07 (Dashboard)
            └─► EPIC-08 (Configurações)
```

**Caminho crítico:** EPIC-01 → EPIC-02 → EPIC-03 → EPIC-04 → EPIC-05 → EPIC-06

---

## Critério de Go-Live — Fase 1

O sistema está pronto para produção quando:

- [ ] Todos os épicos P0 implementados e testados
- [ ] Cenário de conflito offline/turno validado em teste de integração
- [ ] Fallback manual da balança testado
- [ ] Dashboard acessível e funcional no celular do dono
- [ ] Usuário admin e staff configurados no Supabase
- [ ] NF-e avaliado (escopo ou risco documentado e aceito pelo cliente)
- [ ] Requisito de hardware (Chrome desktop) comunicado e instalado no caixa

---

*Documento gerado por Morgan (PM) — AçaiMix PRD v1.0*  
*Referência: `docs/architecture/acaipro-system-design.md`*  
*Próximo: @sm cria stories a partir dos épicos acima*
