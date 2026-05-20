import { Clock } from 'lucide-react'
import { useShiftStore } from '@/stores/shiftStore'
import { formatCurrency } from '@/stores/saleStore'

export function ShiftStatusBar() {
  const activeShift = useShiftStore((s) => s.activeShift)

  if (!activeShift) return null

  const openedAt = new Date(activeShift.opened_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#1a0b2e] border border-[#2d1550] rounded-lg text-sm">
      <div className="flex items-center gap-2 text-[#9d7bc8]">
        <Clock className="w-4 h-4" />
        <span>
          Turno {activeShift.shift_number} — aberto às {openedAt}
        </span>
      </div>
      <div className="flex items-center gap-4 text-white">
        <span className="text-[#9d7bc8]">
          {activeShift.sale_count} {activeShift.sale_count === 1 ? 'venda' : 'vendas'}
        </span>
        <span className="font-semibold text-[#10b981]">
          {formatCurrency(activeShift.total_sales)}
        </span>
      </div>
    </div>
  )
}
