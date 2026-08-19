import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { useShiftStore } from '@/stores/shiftStore'
import type { Sale } from '@/types'

interface EditSaleAmountVars {
  sale: Sale
  newAmount: number
}

/**
 * Corrige o valor de uma venda em DINHEIRO já registrada.
 *
 * Só dinheiro: pix e cartão têm comprovante do outro lado, e mexer no valor
 * aqui faria o sistema divergir do extrato. Em dinheiro não existe esse
 * contra-registro — é onde o erro de digitação acontece e onde a correção
 * é legítima.
 *
 * O total do turno se ajusta sozinho: o trigger em `sales` recalcula
 * `shifts` a cada UPDATE, ignorando canceladas. Por isso aqui não há nenhuma
 * conta de total — tentar somar/subtrair na mão foi justamente o que
 * desalinhou os números antes.
 */
export function useEditSaleAmount() {
  return useMutation({
    mutationFn: async ({ sale, newAmount }: EditSaleAmountVars) => {
      if (sale.payment_method !== 'cash') {
        throw new Error('Só é possível editar o valor de vendas em dinheiro.')
      }
      if (sale.status === 'CANCELLED') {
        throw new Error('Esta venda foi cancelada e não pode ser editada.')
      }
      if (!Number.isFinite(newAmount) || newAmount <= 0) {
        throw new Error('Informe um valor maior que zero.')
      }

      const { error } = await supabase
        .from('sales')
        .update({ amount: newAmount })
        .eq('id', sale.id)
        .eq('payment_method', 'cash')
      if (error) throw error
    },
    onSuccess: (_, { sale, newAmount }) => {
      // Releitura do turno: o valor autoritativo vem do banco, onde o trigger
      // acabou de recalcular. Ajustar o store na mão daria divergência.
      const { activeShift, loadActiveShift } = useShiftStore.getState()
      if (activeShift && activeShift.id === sale.shift_id) {
        void loadActiveShift(sale.location_id)
      }
      queryClient.invalidateQueries({ queryKey: ['sales-history'] })
      queryClient.invalidateQueries({ queryKey: ['shift-sales'] })
      toast.success(
        `Valor alterado de ${sale.amount.toFixed(2).replace('.', ',')} para ${newAmount
          .toFixed(2)
          .replace('.', ',')}.`,
      )
    },
    onError: (err) => {
      const isRls = err instanceof Error && err.message.includes('policy')
      toast.error(
        isRls
          ? 'Não foi possível editar — turno já encerrado ou permissão negada.'
          : err instanceof Error
            ? err.message
            : 'Erro ao editar venda',
      )
    },
  })
}
