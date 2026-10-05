export const BILLING_DAY = 20

/**
 * Até quando um pagamento libera o sistema: o fim (23h59 BRT) do primeiro
 * dia 20 a partir do vencimento da cobrança paga.
 *   avulsa de setembro, vence 07/10  -> libera até 20/10
 *   mensal de 20/10, paga dia 23     -> libera até 20/11
 * Usa o vencimento, não a data do pagamento: pagar atrasado não empurra o ciclo.
 */
export function paidUntilFor(dueDate: string): string {
  const [y, m, d] = dueDate.split('-').map(Number)
  const month = d < BILLING_DAY ? m - 1 : m // Date.UTC usa mês 0-based
  // fim do dia 20 em BRT = dia 21 03:00 UTC
  return new Date(Date.UTC(y, month, BILLING_DAY + 1, 3)).toISOString()
}
