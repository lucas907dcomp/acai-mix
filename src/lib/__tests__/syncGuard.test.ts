import { describe, it, expect } from 'vitest'
import { shouldBlockLocationSwitch } from '@/lib/syncGuard'

describe('shouldBlockLocationSwitch (DA-4)', () => {
  it('permite a troca quando não há sync pendente', () => {
    expect(shouldBlockLocationSwitch(0, false)).toBe(false)
  })

  it('bloqueia quando há vendas offline pendentes', () => {
    expect(shouldBlockLocationSwitch(3, false)).toBe(true)
  })

  it('bloqueia quando está sincronizando, mesmo com pendingCount=0', () => {
    expect(shouldBlockLocationSwitch(0, true)).toBe(true)
  })

  it('bloqueia quando ambos são verdadeiros', () => {
    expect(shouldBlockLocationSwitch(2, true)).toBe(true)
  })
})
