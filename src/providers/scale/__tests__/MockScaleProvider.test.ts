import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MockScaleProvider } from '../MockScaleProvider'

describe('MockScaleProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emite connected:true ao chamar connect()', async () => {
    const provider = new MockScaleProvider()
    const onConnection = vi.fn()
    provider.onConnectionChange(onConnection)
    await provider.connect()
    expect(onConnection).toHaveBeenCalledWith(true)
  })

  it('tem type "mock"', () => {
    const provider = new MockScaleProvider()
    expect(provider.type).toBe('mock')
  })

  it('emite peso no intervalo configurado', async () => {
    const provider = new MockScaleProvider({ initialWeight: 300, interval: 500 })
    const onWeight = vi.fn()
    provider.onWeight(onWeight)
    await provider.connect()

    vi.advanceTimersByTime(500)
    expect(onWeight).toHaveBeenCalledTimes(1)
    expect(onWeight).toHaveBeenCalledWith(300)

    vi.advanceTimersByTime(500)
    expect(onWeight).toHaveBeenCalledTimes(2)
  })

  it('unsubscribe para de receber atualizações de peso', async () => {
    const provider = new MockScaleProvider({ initialWeight: 200, interval: 500 })
    const onWeight = vi.fn()
    const unsubscribe = provider.onWeight(onWeight)
    await provider.connect()

    vi.advanceTimersByTime(500)
    expect(onWeight).toHaveBeenCalledTimes(1)

    unsubscribe()
    vi.advanceTimersByTime(1000)
    expect(onWeight).toHaveBeenCalledTimes(1)
  })

  it('disconnect para as emissões e emite connected:false', async () => {
    const provider = new MockScaleProvider({ initialWeight: 100, interval: 500 })
    const onWeight = vi.fn()
    const onConnection = vi.fn()
    provider.onWeight(onWeight)
    provider.onConnectionChange(onConnection)
    await provider.connect()

    await provider.disconnect()
    vi.advanceTimersByTime(1000)

    expect(onWeight).not.toHaveBeenCalled()
    expect(onConnection).toHaveBeenCalledWith(false)
  })

  it('aplica variância ao peso emitido', async () => {
    const provider = new MockScaleProvider({ initialWeight: 500, interval: 500, variance: 50 })
    const weights: number[] = []
    provider.onWeight((g) => weights.push(g))
    await provider.connect()

    vi.advanceTimersByTime(5000)
    expect(weights.length).toBe(10)
    expect(weights.every((w) => w >= 0)).toBe(true)
  })

  it('peso nunca é negativo com variância alta', async () => {
    const provider = new MockScaleProvider({ initialWeight: 10, interval: 100, variance: 100 })
    const weights: number[] = []
    provider.onWeight((g) => weights.push(g))
    await provider.connect()

    vi.advanceTimersByTime(1000)
    expect(weights.every((w) => w >= 0)).toBe(true)
  })
})
