import { describe, it, expect, vi, afterEach } from 'vitest'

// A store importa o cliente do Supabase, que exige variáveis de ambiente que
// não existem em teste. Como aqui só interessa a conta do número do turno,
// o cliente é trocado por um stub.
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }) },
}))
vi.mock('@/lib/queryClient', () => ({ queryClient: { invalidateQueries: () => {} } }))
vi.mock('sonner', () => ({ toast: { success: () => {}, error: () => {} } }))

import { getShiftNumber } from '../shiftStore'

// A hora de troca era 16 fixo, com uma loja só. A AçaiMix Barra troca às 15h,
// e por isso um turno aberto à mão entre 15h e 16h lá nascia como turno 1
// quando já devia ser o 2. Estes testes fixam as duas bordas.

function fixarHora(hora: number, minuto = 0) {
  const data = new Date(2026, 7, 19, hora, minuto, 0)
  vi.useFakeTimers()
  vi.setSystemTime(data)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('getShiftNumber — loja que troca às 16h (padrão)', () => {
  it('de manhã é turno 1', () => {
    fixarHora(10)
    expect(getShiftNumber(16)).toBe(1)
  })

  it('15h59 ainda é turno 1', () => {
    fixarHora(15, 59)
    expect(getShiftNumber(16)).toBe(1)
  })

  it('16h em ponto já é turno 2', () => {
    fixarHora(16)
    expect(getShiftNumber(16)).toBe(2)
  })

  it('à noite é turno 2', () => {
    fixarHora(22)
    expect(getShiftNumber(16)).toBe(2)
  })
})

describe('getShiftNumber — loja que troca às 15h (Barra)', () => {
  it('14h59 ainda é turno 1', () => {
    fixarHora(14, 59)
    expect(getShiftNumber(15)).toBe(1)
  })

  it('15h em ponto já é turno 2', () => {
    fixarHora(15)
    expect(getShiftNumber(15)).toBe(2)
  })

  it('15h30 é turno 2 — o caso que dava errado', () => {
    // Com o 16 fixo, este horário devolvia 1 na Barra.
    fixarHora(15, 30)
    expect(getShiftNumber(15)).toBe(2)
    expect(getShiftNumber(16)).toBe(1) // como era antes, para deixar o contraste explícito
  })
})

describe('getShiftNumber — sem argumento', () => {
  it('mantém as 16h de antes, para quem não passa nada', () => {
    fixarHora(15, 30)
    expect(getShiftNumber()).toBe(1)
    fixarHora(16, 1)
    expect(getShiftNumber()).toBe(2)
  })
})
