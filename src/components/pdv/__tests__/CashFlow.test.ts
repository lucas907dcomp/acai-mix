import { describe, it, expect } from 'vitest'
import { getQuickValues } from '@/lib/quickValues'

describe('getQuickValues', () => {
  it('R$22,43 → [25, 30, 40, 50, 100]', () => {
    expect(getQuickValues(22.43)).toEqual([25, 30, 40, 50, 100])
  })

  it('R$8,50 → inclui valores acima de 8.50', () => {
    const values = getQuickValues(8.5)
    expect(values.every((v) => v >= 8.5)).toBe(true)
  })

  it('R$3,00 → começa no próximo múltiplo de 5', () => {
    const values = getQuickValues(3)
    expect(values[0]).toBe(5)
  })

  it('R$50,00 → começa em 50', () => {
    const values = getQuickValues(50)
    expect(values[0]).toBe(50)
  })

  it('retorna no máximo 5 valores', () => {
    expect(getQuickValues(1).length).toBeLessThanOrEqual(5)
  })

  it('valores são únicos e ordenados', () => {
    const values = getQuickValues(22.43)
    const sorted = [...values].sort((a, b) => a - b)
    expect(values).toEqual(sorted)
    expect(new Set(values).size).toBe(values.length)
  })
})
