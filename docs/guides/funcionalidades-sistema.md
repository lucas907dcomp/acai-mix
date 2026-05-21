# AçaíMix PDV — Guia de Funcionalidades

**Sistema:** AçaíMix PDV + Dashboard Financeiro  
**Versão:** 1.0  
**Público:** Proprietário e equipe

---

## O que é o AçaíMix?

O AçaíMix é um sistema de ponto de venda (PDV) e gestão financeira desenvolvido especificamente para a sua açaíteria. Ele substitui o registro manual de vendas, elimina erros de cálculo e te dá uma visão clara do faturamento em tempo real — tudo num único lugar, acessível de qualquer computador com Chrome.

---

## 1. Acesso e Segurança

**Dois perfis de usuário:**

- **Administrador** — acesso completo: PDV, Dashboard, Histórico, Configurações, cancelamento de vendas
- **Operador (Staff)** — acesso somente ao caixa (PDV); não vê dados financeiros nem pode alterar configurações

Cada pessoa entra com e-mail e senha próprios. Não há risco de um funcionário acessar informações financeiras sem autorização.

---

## 2. Caixa (PDV)

O coração do sistema. Tudo que o operador precisa para registrar uma venda está numa única tela.

### Integração com Balança

O sistema se conecta diretamente à balança via cabo USB (modelo UPX Wind D3). Ao colocar o açaí na balança, o peso é capturado automaticamente — sem precisar digitar nada. O valor é calculado na hora.

**Fluxo de uma venda:**
1. Cliente coloca o açaí na balança
2. Peso aparece no display
3. Valor calculado automaticamente (preço/g × peso)
4. Operador seleciona como o cliente vai pagar
5. Confirma — venda registrada

### Métodos de Pagamento Aceitos

- **PIX** — operador confirma o pagamento manualmente após receber
- **Cartão de Crédito**
- **Cartão de Débito**
- **Dinheiro** — sistema calcula o troco automaticamente

### Troco Automático

Ao selecionar Dinheiro, o operador digita quanto o cliente entregou. O sistema mostra o troco exato na tela, evitando erros.

### Modo Manual (Backup para Falhas da Balança)

Se a balança falhar (cabo, energia, defeito), o operador pode digitar diretamente o **valor em reais** da venda. O sistema registra a venda normalmente, marcando que o peso foi inserido manualmente para auditoria posterior.

O operador pode voltar a usar a balança a qualquer momento com um clique.

### Histórico de Vendas do Turno

Ao lado do PDV há uma lista das últimas vendas do turno atual, com horário, peso, valor e forma de pagamento. Permite conferência imediata sem sair da tela de caixa.

---

## 3. Turnos de Trabalho

O sistema organiza as vendas em **turnos** — blocos de operação com início e fim definidos.

- O operador **abre** o turno ao começar a trabalhar
- O sistema **fecha automaticamente** os turnos nos horários configurados (16h e 23h)
- O administrador pode **fechar manualmente** a qualquer momento
- Cada turno tem seus próprios totais: faturamento, número de vendas, breakdown por pagamento

Isso facilita a conferência de caixa por período, ideal para operações com mais de um turno por dia.

---

## 4. Dashboard Financeiro

Painel de dados exclusivo para o administrador. Visão completa do desempenho da loja.

### Períodos Disponíveis
- **Hoje** — com comparação automática com ontem (+ ou - %)
- **Últimos 7 dias**
- **Últimos 30 dias**

### Indicadores Exibidos
- **Faturamento total** do período
- **Total de vendas** (número de pedidos)
- **Ticket médio** (valor médio por venda)
- **Número de turnos** no período

### Gráfico de Vendas

Gráfico de barras mostrando o faturamento por dia no período selecionado. Identifica facilmente dias de pico e dias fracos.

### Breakdown por Pagamento

Mostra quanto foi recebido em PIX, Cartão e Dinheiro — útil para conferência de caixa e entendimento do perfil de pagamento dos clientes.

### Histórico de Turnos

Lista dos turnos do período com: horário de abertura/fechamento, número de vendas, faturamento e ticket médio. Clique em qualquer turno para ver o breakdown de pagamento daquele período específico.

---

## 5. Histórico de Vendas

Listagem completa de todas as vendas registradas, com filtros avançados.

### Filtros Disponíveis
- **Período** — qualquer intervalo de datas
- **Forma de pagamento** — filtrar por PIX, Crédito, Débito ou Dinheiro (ou qualquer combinação)
- **Status** — mostrar vendas ativas, canceladas ou ambas

### Paginação

Exibe 50 vendas por página. Navegue entre páginas com os botões "Anterior" e "Próxima".

### Cancelamento de Vendas

Em cada venda ativa, o administrador pode clicar em **Cancelar**. Um diálogo exibe os detalhes da venda (valor, pagamento, peso) antes de confirmar. Após o cancelamento:
- A venda aparece riscada e marcada como "Cancelada"
- O faturamento do turno é corrigido automaticamente
- O histórico mantém o registro da venda para auditoria

> Somente administradores podem cancelar vendas. Só é possível cancelar vendas de turnos ainda abertos.

---

## 6. Exportação de Dados (CSV)

No Dashboard, o botão **Exportar CSV** gera um arquivo com todas as vendas do período selecionado.

**O arquivo contém:**
- Data e hora de cada venda
- Peso em gramas
- Preço por grama
- Valor total
- Forma de pagamento
- Status (Ativa / Cancelada)

O arquivo abre diretamente no Excel e Google Planilhas com formatação correta para o Brasil (vírgula como decimal, separador ponto-e-vírgula). Útil para contabilidade, conferência mensal e controle próprio.

---

## 7. Operação Offline

O sistema funciona mesmo quando a internet cai.

**O que acontece sem internet:**
- Vendas são salvas localmente no computador
- Uma indicação "Offline" aparece na barra lateral
- As vendas aparecem destacadas em amarelo na tabela do turno
- Ao reconectar, as vendas são enviadas automaticamente ao servidor

**Cancelamento offline:**
Se uma venda foi registrada sem internet e ainda não foi sincronizada, ela pode ser removida diretamente pela interface antes de ser enviada ao servidor.

> Isso garante que a loja nunca para de operar por falta de sinal.

---

## 8. Configurações Administrativas

Disponível apenas para administradores.

- **Preço por grama** — alterar o preço cobrado por grama de açaí. A mudança entra em vigor imediatamente na próxima venda.

---

## Resumo das Telas

| Tela | Acesso | O que faz |
|------|--------|-----------|
| Login | Todos | Autenticação no sistema |
| Caixa (PDV) | Todos | Registrar vendas com balança ou manual |
| Dashboard | Admin | Faturamento, gráficos, turnos |
| Histórico de Vendas | Admin | Filtrar, visualizar e cancelar vendas |
| Configurações | Admin | Preço por grama |

---

## Compatibilidade

| Item | Requisito |
|------|-----------|
| Navegador | Google Chrome ou Microsoft Edge (obrigatório para balança) |
| Dispositivo | Computador ou notebook com porta USB |
| Internet | Necessária para sincronização — funciona offline temporariamente |
| Balança | UPX Wind D3 (conexão USB) |

---

*AçaíMix PDV — desenvolvido sob medida para a sua operação.*
