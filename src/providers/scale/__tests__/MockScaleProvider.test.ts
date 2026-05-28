import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MockScaleProvider } from '../MockScaleProvider'

describe('MockScaleProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tem type "mock"', () => {
    const provider = new MockScaleProvider()
    expect(provider.type).toBe('mock')
  })

  it('emite connected:true ao chamar connect()', async () => {
    const provider = new MockScaleProvider()
    const onConnection = vi.fn()
    provider.onConnectionChange(onConnection)
    await provider.connect()
    expect(onConnection).toHaveBeenCalledWith(true)
  })

  it('emite peso logo após connect (300ms)', async () => {
    const provider = new MockScaleProvider()
    const onWeight = vi.fn()
    provider.onWeight(onWeight)
    await provider.connect()

    vi.advanceTimersByTime(300)
    expect(onWeight).toHaveBeenCalledTimes(1)
    expect(onWeight.mock.calls[0][0]).toBeGreaterThan(0)
  })

  it('peso emitido está na faixa realista (200–660g com jitter)', async () => {
    const provider = new MockScaleProvider()
    const weights: number[] = []
    provider.onWeight((g) => weights.push(g))
    await provider.connect()

    vi.advanceTimersByTime(3000) // 10 emissões antes do ciclo resetar
    expect(weights.length).toBeGreaterThan(0)
    weights.forEach((w) => {
      expect(w).toBeGreaterThanOrEqual(0)
      expect(w).toBeLessThanOrEqual(660) // MAX_WEIGHT + JITTER
    })
  })

  it('emite 0 após o tempo de estabilidade (5000ms)', async () => {
    const provider = new MockScaleProvider()
    const weights: number[] = []
    provider.onWeight((g) => weights.push(g))
    await provider.connect()

    vi.advanceTimersByTime(5001) // passa do STABLE_DURATION_MS
    expect(weights).toContain(0)
  })

  it('inicia novo ciclo com peso diferente após o vazio (7000ms)', async () => {
    const provider = new MockScaleProvider()
    const weights: number[] = []
    provider.onWeight((g) => weights.push(g))
    await provider.connect()

    vi.advanceTimersByTime(7400) // 5000 estável + 2000 vazio + 300 primeiro emit do novo ciclo
    const nonZeroAfterEmpty = weights.slice(weights.lastIndexOf(0) + 1)
    expect(nonZeroAfterEmpty.length).toBeGreaterThan(0)
    expect(nonZeroAfterEmpty[0]).toBeGreaterThan(0)
  })

  it('unsubscribe para de receber atualizações de peso', async () => {
    const provider = new MockScaleProvider()
    const onWeight = vi.fn()
    const unsubscribe = provider.onWeight(onWeight)
    await provider.connect()

    vi.advanceTimersByTime(300)
    expect(onWeight).toHaveBeenCalledTimes(1)

    unsubscribe()
    vi.advanceTimersByTime(3000)
    expect(onWeight).toHaveBeenCalledTimes(1)
  })

  it('disconnect para as emissões e emite connected:false', async () => {
    const provider = new MockScaleProvider()
    const onWeight = vi.fn()
    const onConnection = vi.fn()
    provider.onWeight(onWeight)
    provider.onConnectionChange(onConnection)
    await provider.connect()

    await provider.disconnect()
    onWeight.mockClear()
    vi.advanceTimersByTime(3000)

    expect(onWeight).not.toHaveBeenCalled()
    expect(onConnection).toHaveBeenCalledWith(false)
  })

  it('peso nunca é negativo', async () => {
    const provider = new MockScaleProvider()
    const weights: number[] = []
    provider.onWeight((g) => weights.push(g))
    await provider.connect()

    vi.advanceTimersByTime(8000) // cobre um ciclo completo
    expect(weights.every((w) => w >= 0)).toBe(true)
  })
})
