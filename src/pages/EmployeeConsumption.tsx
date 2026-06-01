import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/stores/saleStore'
import {
  useStaffMembers,
  useEmployeeConsumptions,
  useAddConsumption,
  useDeleteConsumption,
} from '@/hooks/useEmployeeConsumptions'

// ─── Schema ───────────────────────────────────────────────────────────────────

const formSchema = z.object({
  user_id: z.string().min(1, 'Selecione a funcionária'),
  amount: z.number().positive('Valor deve ser positivo'),
  description: z.string().max(200, 'Máximo 200 caracteres').optional(),
  consumed_at: z.string().min(1, 'Informe a data'),
})
type FormValues = z.infer<typeof formSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthLabel(year: number, month: number) {
  return format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: ptBR })
}

function todayISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

// ─── AddConsumptionDialog ─────────────────────────────────────────────────────

interface AddDialogProps {
  open: boolean
  onClose: () => void
  staffMembers: { id: string; display_name: string | null }[]
}

function AddConsumptionDialog({ open, onClose, staffMembers }: AddDialogProps) {
  const addConsumption = useAddConsumption()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { consumed_at: todayISO(), description: '' },
  })

  async function onSubmit(values: FormValues) {
    try {
      await addConsumption.mutateAsync({
        user_id: values.user_id,
        amount: values.amount,
        description: values.description || '',
        consumed_at: values.consumed_at,
      })
      toast.success('Consumo registrado!')
      reset({ consumed_at: todayISO(), description: '' })
      onClose()
    } catch {
      toast.error('Erro ao registrar consumo. Tente novamente.')
    }
  }

  function handleClose() {
    reset({ consumed_at: todayISO(), description: '' })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-[#1a0b2e] border-[#2d1550] text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Registrar consumo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-sm text-[#9d7bc8]">Funcionária</label>
            <select
              {...register('user_id')}
              className="w-full bg-[#0f0720] border border-[#2d1550] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4c1e8c]"
            >
              <option value="">Selecione...</option>
              {staffMembers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name ?? 'Sem nome'}
                </option>
              ))}
            </select>
            {errors.user_id && <p className="text-red-400 text-xs">{errors.user_id.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-[#9d7bc8]">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              {...register('amount', { valueAsNumber: true })}
              className="w-full bg-[#0f0720] border border-[#2d1550] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4c1e8c]"
            />
            {errors.amount && <p className="text-red-400 text-xs">{errors.amount.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-[#9d7bc8]">Data</label>
            <input
              type="date"
              {...register('consumed_at')}
              className="w-full bg-[#0f0720] border border-[#2d1550] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4c1e8c] [color-scheme:dark]"
            />
            {errors.consumed_at && (
              <p className="text-red-400 text-xs">{errors.consumed_at.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-[#9d7bc8]">
              Descrição <span className="text-xs">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ex: açaí + picolé"
              {...register('description')}
              className="w-full bg-[#0f0720] border border-[#2d1550] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4c1e8c]"
            />
            {errors.description && (
              <p className="text-red-400 text-xs">{errors.description.message}</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 text-sm rounded-lg bg-[#4c1e8c] text-white hover:bg-[#5B2D8E] disabled:opacity-40 transition-colors"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded-lg text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── StaffSummaryCard ─────────────────────────────────────────────────────────

interface StaffSummaryCardProps {
  name: string
  total: number
  entries: { id: string; amount: number; description: string | null; consumed_at: string }[]
  onDelete: (id: string) => void
}

function StaffSummaryCard({ name, total, entries, onDelete }: StaffSummaryCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="bg-[#1a0b2e] border-[#2d1550]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-white">{name}</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-[#c084fc]">{formatCurrency(total)}</span>
            {entries.length > 0 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-[#9d7bc8] hover:text-white transition-colors"
              >
                {expanded ? <X className="w-4 h-4" /> : `${entries.length} lançamento${entries.length > 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
        {entries.length === 0 && (
          <p className="text-xs text-[#9d7bc8] mt-1">Nenhum consumo neste mês</p>
        )}
      </CardHeader>

      {expanded && entries.length > 0 && (
        <CardContent className="pt-0">
          <div className="space-y-2 border-t border-[#2d1550] pt-3">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <span className="text-white font-medium">{formatCurrency(e.amount)}</span>
                  {e.description && (
                    <span className="text-[#9d7bc8] ml-2 truncate">{e.description}</span>
                  )}
                  <span className="text-[#9d7bc8] ml-2 text-xs">
                    {format(parseISO(e.consumed_at), 'dd/MM', { locale: ptBR })}
                  </span>
                </div>
                <button
                  onClick={() => onDelete(e.id)}
                  className="text-[#9d7bc8] hover:text-red-400 transition-colors flex-shrink-0"
                  aria-label="Remover lançamento"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeeConsumptionPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: staff, isLoading: staffLoading } = useStaffMembers()
  const { data: consumptions, isLoading: consumptionsLoading } = useEmployeeConsumptions(year, month)
  const deleteConsumption = useDeleteConsumption()

  function prevMonth() {
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    const current = new Date()
    if (year === current.getFullYear() && month === current.getMonth() + 1) return
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteConsumption.mutateAsync(id)
      toast.success('Lançamento removido.')
    } catch {
      toast.error('Erro ao remover lançamento.')
    }
  }

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1

  const totalMonth = consumptions?.reduce((sum, c) => sum + c.amount, 0) ?? 0

  const isLoading = staffLoading || consumptionsLoading

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Consumo de Funcionárias</h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[#4c1e8c] text-white hover:bg-[#5B2D8E] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Registrar
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white transition-colors"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-white font-medium capitalize">{monthLabel(year, month)}</p>
          {!isLoading && (
            <p className="text-xs text-[#9d7bc8]">
              Total: <span className="text-[#c084fc] font-medium">{formatCurrency(totalMonth)}</span>
            </p>
          )}
        </div>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="p-1.5 rounded-lg text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Próximo mês"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Staff cards */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : staff && staff.length > 0 ? (
        <div className="space-y-3">
          {staff.map((member) => {
            const entries = (consumptions ?? []).filter((c) => c.user_id === member.id)
            const total = entries.reduce((sum, c) => sum + c.amount, 0)
            return (
              <StaffSummaryCard
                key={member.id}
                name={member.display_name ?? 'Sem nome'}
                total={total}
                entries={entries}
                onDelete={handleDelete}
              />
            )
          })}
        </div>
      ) : (
        <Card className="bg-[#1a0b2e] border-[#2d1550]">
          <CardContent className="py-8 text-center">
            <p className="text-[#9d7bc8] text-sm">
              Nenhuma funcionária cadastrada nesta loja.
            </p>
          </CardContent>
        </Card>
      )}

      <AddConsumptionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        staffMembers={staff ?? []}
      />
    </div>
  )
}
