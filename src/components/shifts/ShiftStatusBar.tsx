import { useState, useEffect } from 'react'
import { Clock, LogOut, Loader2 } from 'lucide-react'
import { differenceInMinutes } from 'date-fns'
import { useShiftStore } from '@/stores/shiftStore'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/stores/saleStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

function getElapsed(openedAt: string): string {
  const minutes = differenceInMinutes(new Date(), new Date(openedAt))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

export function ShiftStatusBar() {
  const activeShift = useShiftStore((s) => s.activeShift)
  const closeShift = useShiftStore((s) => s.closeShift)
  const profile = useAuthStore((s) => s.profile)
  const [, setTick] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Re-render every minute to refresh elapsed time
  useEffect(() => {
    if (!activeShift?.opened_at) return
    const timer = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(timer)
  }, [activeShift?.opened_at])

  if (!activeShift) return null

  const openedAt = new Date(activeShift.opened_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const elapsed = getElapsed(activeShift.opened_at)

  const handleConfirmClose = async () => {
    if (!profile) return
    setIsClosing(true)
    const shiftId = activeShift?.id
    try {
      await closeShift(profile.id)
      setConfirmOpen(false)
      if (shiftId) {
        window.open(`/shift-report?shiftId=${shiftId}`, '_blank')
      }
    } finally {
      setIsClosing(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a0b2e] border border-[#2d1550] rounded-lg text-sm">
        <div className="flex items-center gap-2 text-[#9d7bc8]">
          <Clock className="w-4 h-4" />
          <span>
            Turno {activeShift.shift_number} — aberto às {openedAt}
          </span>
          <span className="text-[#4a3570]">·</span>
          <span>{elapsed}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[#9d7bc8] text-xs">
            {activeShift.sale_count} {activeShift.sale_count === 1 ? 'venda' : 'vendas'}
          </span>
          <span className="font-semibold text-[#10b981]">
            {formatCurrency(activeShift.total_sales)}
          </span>
          {profile?.role === 'admin' && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Encerrar
            </button>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-[#0f0720] border-[#2d1550] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Encerrar turno?</DialogTitle>
            <DialogDescription className="text-[#9d7bc8]">
              Tem certeza? Isso encerrará o turno atual e registrará os totais finais.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button
                variant="outline"
                className="border-[#2d1550] text-[#9d7bc8] hover:bg-[#1a0b2e] hover:text-white"
                disabled={isClosing}
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmClose} disabled={isClosing}>
              {isClosing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Encerrando...
                </>
              ) : (
                'Encerrar Turno'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
