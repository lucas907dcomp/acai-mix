import { describe, expect, it } from 'vitest'
import { isBillingBlocked } from '../billing'
import { paidUntilFor } from '../../../supabase/functions/asaas-webhook/period'

describe('paidUntilFor', () => {
  it('avulsa de setembro (vence 07/10) libera até 20/10', () =>
    expect(paidUntilFor('2026-10-07')).toBe('2026-10-21T03:00:00.000Z'))
  it('mensal de 20/10 libera até 20/11', () =>
    expect(paidUntilFor('2026-10-20')).toBe('2026-11-21T03:00:00.000Z'))
  it('mensal de 20/12 vira o ano', () =>
    expect(paidUntilFor('2026-12-20')).toBe('2027-01-21T03:00:00.000Z'))
})

describe('isBillingBlocked', () => {
  const pagoAte = '2026-10-21T03:00:00Z' // fim do dia 20/10 em BRT
  it('NULL nunca bloqueia', () => expect(isBillingBlocked(null)).toBe(false))
  it('dia 25 às 23h59 BRT ainda libera', () =>
    expect(isBillingBlocked(pagoAte, new Date('2026-10-26T02:59:00Z'))).toBe(false))
  it('dia 26 0h BRT bloqueia', () =>
    expect(isBillingBlocked(pagoAte, new Date('2026-10-26T03:01:00Z'))).toBe(true))
  it('data inválida não bloqueia', () => expect(isBillingBlocked('lixo')).toBe(false))
})
