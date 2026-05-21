# Roteiro de Testes On-Site — AçaíMix PDV

**Versão:** 1.0  
**Uso:** Executar na primeira instalação, com o dono presente  
**Duração estimada:** 40–60 minutos  
**Requisitos:** Notebook com Chrome ou Edge, balança UPX Wind D3, cabo USB, acesso à internet

---

## Antes de Começar

- [ ] Chrome ou Edge instalado e atualizado (Firefox/Safari **não funcionam** com a balança)
- [ ] Balança UPX Wind D3 conectada ao notebook via USB
- [ ] Conexão com internet ativa
- [ ] URL do sistema anotada: `________________`
- [ ] Credenciais de admin em mãos
- [ ] Credenciais de operador (staff) em mãos

---

## 1. Login e Controle de Acesso

### 1.1 Login como Admin

- [ ] Acessar a URL do sistema no Chrome/Edge
- [ ] Inserir e-mail e senha do administrador
- [ ] Clicar em **Entrar**
- [ ] ✅ Deve redirecionar para o PDV
- [ ] ✅ Sidebar mostra: Caixa (PDV), Dashboard, Histórico, Configurações

### 1.2 Login como Operador (Staff)

- [ ] Fazer logout (botão **Sair** no rodapé da sidebar)
- [ ] Inserir credenciais do operador
- [ ] ✅ Deve redirecionar para o PDV
- [ ] ✅ Sidebar mostra **somente** Caixa (PDV) — sem Dashboard, sem Histórico, sem Configurações
- [ ] Fazer logout e retornar com admin para continuar

---

## 2. Configurações Iniciais

### 2.1 Definir preço por grama

- [ ] No menu lateral, clicar em **Configurações**
- [ ] Localizar campo "Preço por kg"
- [ ] Inserir o valor atual cobrado por kg (ex: R$ 55,00)
- [ ] Clicar em **Salvar**
- [ ] ✅ Toast "Configurações salvas" aparece
- [ ] ✅ Preço refletido no PDV ao capturar o próximo peso

---

## 3. Abertura de Turno

- [ ] No PDV, clicar em **Abrir Turno**
- [ ] ✅ Tela de PDV completa abre (balança, peso, valor, pagamento)
- [ ] ✅ Barra de status do turno mostra hora de abertura e totais zerados

---

## 4. Conexão da Balança

- [ ] No PDV, verificar se o status da balança está visível
- [ ] Se aparecer botão **Conectar Balança**, clicar nele
- [ ] ✅ Pop-up do Chrome abre com lista de portas USB
- [ ] Selecionar a porta da balança (geralmente "USB Serial Port" ou similar)
- [ ] Clicar em **Conectar** no pop-up
- [ ] ✅ Indicador muda para "Conectada" (ou cor verde)
- [ ] Colocar um objeto de peso conhecido na balança
- [ ] ✅ Peso atualiza em tempo real no display do PDV

> **Se a balança não aparecer na lista:** verificar cabo USB, tentar outra porta USB do notebook, reinstalar driver da balança.

---

## 5. Venda com Balança — PIX / Cartão / Débito

- [ ] Colocar o açaí na balança
- [ ] ✅ Peso é capturado automaticamente
- [ ] ✅ Valor calculado aparece instantaneamente
- [ ] Selecionar método de pagamento: **PIX**
- [ ] Clicar em **Confirmar Venda**
- [ ] ✅ Toast "Venda confirmada! R$ XX,XX"
- [ ] ✅ Venda aparece na tabela "Vendas do turno" à direita
- [ ] ✅ Totais do turno na barra superior atualizam

Repetir selecionando **Crédito** e **Débito**.

---

## 6. Venda com Pagamento em Dinheiro (Troco)

- [ ] Colocar peso na balança
- [ ] Selecionar **Dinheiro**
- [ ] ✅ Campo "Valor recebido" aparece
- [ ] Inserir valor maior que o total (ex: R$ 50,00 para uma venda de R$ 27,50)
- [ ] ✅ Troco calculado aparece: "Troco: R$ 22,50"
- [ ] Clicar em **Confirmar Venda**
- [ ] ✅ Venda registrada com sucesso

---

## 7. Modo Manual (Balança Indisponível)

- [ ] Clicar em **Modo Manual** no PDV (ou desconectar a balança para simular falha)
- [ ] ✅ Dialog "Modo Manual" abre
- [ ] Inserir o valor monetário da venda diretamente (ex: 27,50)
- [ ] Clicar em **Confirmar Valor**
- [ ] ✅ Peso calculado estimado aparece no display
- [ ] Selecionar pagamento e confirmar venda
- [ ] ✅ Venda registrada com ícone de "lápis" indicando peso manual

Para voltar à balança:
- [ ] Clicar em **Conectar Balança** novamente

---

## 8. Cancelamento de Venda

- [ ] No menu lateral, clicar em **Histórico**
- [ ] ✅ Página de histórico de vendas abre
- [ ] Localizar uma venda do turno atual
- [ ] Clicar em **Cancelar** na linha da venda
- [ ] ✅ Dialog de confirmação abre com detalhes da venda (valor, pagamento, peso)
- [ ] Clicar em **Confirmar cancelamento**
- [ ] ✅ Toast "Venda cancelada."
- [ ] ✅ Linha da venda aparece riscada e com badge "Cancelada"
- [ ] ✅ Totais do turno no PDV diminuem o valor cancelado

---

## 9. Filtros no Histórico de Vendas

- [ ] Na página **Histórico**, ajustar a data "De" para o início do mês
- [ ] ✅ Lista atualiza mostrando vendas do período
- [ ] Desmarcar um método de pagamento (ex: PIX)
- [ ] ✅ Vendas PIX somem da lista
- [ ] Clicar em **Limpar filtros**
- [ ] ✅ Lista volta ao estado padrão

---

## 10. Exportação de CSV

- [ ] Ir para **Dashboard**
- [ ] Selecionar período (Hoje / Semana / Mês)
- [ ] Clicar em **Exportar CSV**
- [ ] ✅ Arquivo `.csv` baixado automaticamente
- [ ] Abrir no Excel / Google Planilhas
- [ ] ✅ Colunas: Data/Hora, Peso (g), Preço/g, Valor, Pagamento, Status
- [ ] ✅ Valores decimais com vírgula (formato BR)
- [ ] ✅ Caracteres especiais corretos (sem problemas de acentuação)

---

## 11. Dashboard Financeiro

- [ ] Acessar **Dashboard**
- [ ] ✅ Cards mostram: Faturamento, Total de Vendas, Ticket Médio, Turnos
- [ ] ✅ Gráfico de vendas por dia renderiza
- [ ] ✅ Breakdown de pagamentos (PIX / Cartão / Dinheiro) exibido
- [ ] ✅ Histórico de turnos na parte inferior com totais expandíveis
- [ ] Trocar entre Hoje / Semana / Mês
- [ ] ✅ Todos os dados atualizam conforme o período
- [ ] Clicar em **Atualizar**
- [ ] ✅ Dados buscados novamente

---

## 12. Teste de Offline

> Simula queda de internet durante operação.

- [ ] Desconectar o Wi-Fi ou cabo de rede do notebook
- [ ] ✅ Banner/indicador "Offline" aparece na sidebar
- [ ] Realizar uma venda normalmente no PDV
- [ ] ✅ Toast "Sem conexão. Venda salva offline."
- [ ] ✅ Venda aparece na seção "Pendente offline" (fundo amarelo) na tabela do turno
- [ ] Reconectar o Wi-Fi
- [ ] ✅ Toast "X venda(s) sincronizada(s)." aparece automaticamente
- [ ] ✅ Venda some da seção amarela e vai para a lista normal

Cancelar venda offline (enquanto ainda pendente):
- [ ] Com Wi-Fi desconectado, fazer uma venda
- [ ] Clicar no **×** na linha amarela da venda offline
- [ ] ✅ Dialog de confirmação abre
- [ ] Confirmar remoção
- [ ] ✅ Venda removida, total do turno corrigido

---

## 13. Fechamento de Turno

- [ ] Clicar em **Fechar Turno** na barra de status do PDV
- [ ] ✅ Confirmação solicitada
- [ ] Confirmar fechamento
- [ ] ✅ Tela de "Abrir Turno" retorna
- [ ] ✅ No Dashboard, turno fechado aparece no histórico com totais corretos

---

## 14. Encerramento

- [ ] Revisar os totais do turno no Dashboard com o dono
- [ ] Exportar CSV do dia para conferência
- [ ] Fazer logout
- [ ] ✅ Redireciona para tela de login

---

## Problemas Conhecidos e Soluções Rápidas

| Problema | Solução |
|----------|---------|
| Balança não aparece no pop-up do Chrome | Verificar cabo USB; tentar porta USB diferente; usar Chrome/Edge (nunca Firefox) |
| Pop-up de balança não abre | Checar se `VITE_USE_MOCK_SCALE=false` nas variáveis de ambiente da Vercel |
| Venda salva offline mas não sincroniza | Verificar conexão com internet; aguardar 10 segundos ao reconectar |
| Erro "Turno já encerrado" ao cancelar | Venda não pode ser cancelada após fechamento do turno — comportamento esperado |
| CSV com texto embaralhado no Excel | Abrir pelo menu Dados > Importar, selecionar UTF-8 e separador ponto-e-vírgula |
| Dashboard vazio | Verificar se há um turno encerrado com vendas no período selecionado |

---

*Documento gerado para instalação do AçaíMix PDV — manter em arquivo para referência futura.*
