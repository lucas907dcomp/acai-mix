import { describe, it, expect, vi } from 'vitest'
import { ManualInputProvider } from '../ManualInputProvider'

describe('ManualInputProvider', () => {
  it('tem type "manual"', () => {
    expect(new ManualInputProvider().type).toBe('manual')
  })

  it('emite connected:true ao conectar', async () => {
    const provider = new ManualInputProvider()
    const onConnection = vi.fn()
    provider.onConnectionChange(onConnection)
    await provider.connect()
    expect(onConnection).toHaveBeenCalledWith(true)
  })

  it('emite connected:false ao desconectar', async () => {
    const provider = new ManualInputProvider()
    const onConnection = vi.fn()
    provider.onConnectionChange(onConnection)
    await provider.connect()
    provider.disconnect()
    expect(onConnection).toHaveBeenCalledWith(false)
  })

  it('setWeight dispara onWeight com o valor correto', async () => {
    const provider = new ManualInputProvider()
    const onWeight = vi.fn()
    provider.onWeight(onWeight)
    provider.setWeight(420)
    expect(onWeight).toHaveBeenCalledWith(420)
  })

  it('unsubscribe para de receber atualizações', () => {
    const provider = new ManualInputProvider()
    const onWeight = vi.fn()
    const unsubscribe = provider.onWeight(onWeight)
    provider.setWeight(100)
    unsubscribe()
    provider.setWeight(200)
    expect(onWeight).toHaveBeenCalledTimes(1)
    expect(onWeight).toHaveBeenCalledWith(100)
  })
})
