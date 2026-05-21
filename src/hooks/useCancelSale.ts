import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { useShiftStore } from '@/stores/shiftStore'
import type { Sale } from '@/types'

interface CancelSaleVars {
  sale: Sale
  cancelledBy: string
}

export function useCancelSale() {
  return useMutation({
    mutationFn: async ({ sale, cancelledBy }: CancelSaleVars) => {
      const { error } = await supabase
        .from('sales')
        .update({
          status: 'CANCELLED' as const,
          cancelled_at: new Date().toISOString(),
          cancelled_by: cancelledBy,
        })
        .eq('id', sale.id)
      if (error) throw error
    },
    onSuccess: (_, { sale }) => {
      const { activeShift } = useShiftStore.getState()
      if (activeShift && activeShift.id === sale.shift_id) {
        useShiftStore.getState().reverseTotals(sale.amount, sale.payment_method)
      }
      queryClient.invalidateQueries({ queryKey: ['sales-history'] })
      queryClient.invalidateQueries({ queryKey: ['shift-sales'] })
      toast.success('Venda cancelada.')
    },
    onError: (err) => {
      const isRls = err instanceof Error && err.message.includes('policy')
      const msg = isRls
        ? 'Não foi possível cancelar — turno já encerrado ou permissão negada.'
        : (err instanceof Error ? err.message : 'Erro ao cancelar venda')
      toast.error(msg)
    },
  })
}
