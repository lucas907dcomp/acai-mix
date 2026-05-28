import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCombinedOrderStore } from '@/stores/combinedOrderStore'

interface Props {
  open: boolean
  onClose: () => void
}

export function CreateCombinedOrderDialog({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const createOrder = useCombinedOrderStore((s) => s.createOrder)
  const activateOrder = useCombinedOrderStore((s) => s.activateOrder)

  function handleClose() {
    setName('')
    onClose()
  }

  function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    createOrder(trimmed)
    // Zustand state is synchronously updated — read the new order immediately
    const updated = useCombinedOrderStore.getState().orders
    const newOrder = updated[updated.length - 1]
    if (newOrder) activateOrder(newOrder.id)
    setName('')
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="bg-[#1a0b2e] border-[#2d1550] text-white max-w-sm w-full">
        <DialogHeader>
          <DialogTitle className="text-white">Novo pedido conjunto</DialogTitle>
          <p className="text-[#9d7bc8] text-sm">Dê um nome para identificar este pedido.</p>
        </DialogHeader>

        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex: Família Silva, Mesa 3..."
          maxLength={40}
          className="w-full px-3 py-3 rounded-xl bg-[#0f0720] border border-[#2d1550] text-white placeholder-[#4a3570] focus:outline-none focus:ring-2 focus:ring-amber-500 text-base"
        />

        <div className="flex gap-2">
          <button
            onClick={handleClose}
            className="flex-1 py-3 rounded-xl border border-[#2d1550] text-[#9d7bc8] text-sm hover:bg-[#2d1550] hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
          >
            Criar Pedido
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
