import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Trash2, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/stores/saleStore'
import {
  useEmployees,
  useAddEmployee,
  useToggleEmployee,
  useEmployeeConsumptions,
  useAddConsumption,
  useDeleteConsumption,
} from '@/hooks/useEmployeeConsumptions'
import type { Employee } from '@/types'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const consumptionSchema = z.object({
  employee_id: z.string().min(1, 'Selecione a funcionária'),
  amount: z.number().positive('Valor deve ser positivo'),
  description: z.string().max(200).optional(),
  consumed_at: z.string().min(1, 'Informe a data'),
})
type ConsumptionForm = z.infer<typeof consumptionSchema>

const employeeSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Máximo 100 caracteres'),
})
type EmployeeForm = z.infer<typeof employeeSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthLabel(year: number, month: number) {
  return format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: ptBR })
}

function todayISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

// ─── AddConsumptionDialog ─────────────────────────────────────────────────────

function AddConsumptionDialog({
  open,
  onClose,
  employees,
}: {
  open: boolean
  onClose: () => void
  employees: Employee[]
}) {
  const addConsumption = useAddConsumption()
  const activeEmployees = employees.filter((e) => e.active)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsumptionForm>({
    resolver: zodResolver(consumptionSchema),
    defaultValues: { consumed_at: todayISO(), description: '' },
  })

  async function onSubmit(values: ConsumptionForm) {
    try {
      await addConsumption.mutateAsync({
        employee_id: values.employee_id,
        amount: values.amount,
        description: values.description || '',
        consumed_at: values.consumed_at,
      })
      toast.success('Consumo registrado!')
      reset({ consumed_at: todayISO(), description: '' })
      onClose()
    } catch {
      toast.error('Erro ao registrar consumo.')
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
              {...register('employee_id')}
              className="w-full bg-[#0f0720] border border-[#2d1550] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4c1e8c]"
            >
              <option value="">Selecione...</option>
              {activeEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            {errors.employee_id && (
              <p className="text-red-400 text-xs">{errors.employee_id.message}</p>
            )}
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

// ─── EmployeeCard (consumo mensal por funcionária) ────────────────────────────

function EmployeeConsumptionCard({
  employee,
  entries,
  onDelete,
}: {
  employee: Employee
  entries: { id: string; amount: number; description: string | null; consumed_at: string }[]
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const total = entries.reduce((sum, e) => sum + e.amount, 0)

  return (
    <Card className="bg-[#1a0b2e] border-[#2d1550]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-white">{employee.name}</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-[#c084fc]">{formatCurrency(total)}</span>
            {entries.length > 0 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-[#9d7bc8] hover:text-white transition-colors"
              >
                {expanded ? (
                  <X className="w-4 h-4" />
                ) : (
                  `${entries.length} lançamento${entries.length > 1 ? 's' : ''}`
                )}
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
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium">{formatCurrency(e.amount)}</span>
                  {e.description && (
                    <span className="text-[#9d7bc8] truncate">{e.description}</span>
                  )}
                  <span className="text-[#9d7bc8] text-xs">
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

// ─── ConsumptionsTab ──────────────────────────────────────────────────────────

function ConsumptionsTab({ employees }: { employees: Employee[] }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: consumptions, isLoading } = useEmployeeConsumptions(year, month)
  const deleteConsumption = useDeleteConsumption()

  const activeEmployees = employees.filter((e) => e.active)
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const totalMonth = consumptions?.reduce((sum, c) => sum + c.amount, 0) ?? 0

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (isCurrentMonth) return
    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  async function handleDelete(id: string) {
    try {
      await deleteConsumption.mutateAsync(id)
      toast.success('Lançamento removido.')
    } catch {
      toast.error('Erro ao remover lançamento.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center min-w-[140px]">
            <p className="text-white font-medium capitalize">{monthLabel(year, month)}</p>
            {!isLoading && (
              <p className="text-xs text-[#9d7bc8]">
                Total:{' '}
                <span className="text-[#c084fc] font-medium">{formatCurrency(totalMonth)}</span>
              </p>
            )}
          </div>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-lg text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          disabled={activeEmployees.length === 0}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[#4c1e8c] text-white hover:bg-[#5B2D8E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          Registrar
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : activeEmployees.length === 0 ? (
        <Card className="bg-[#1a0b2e] border-[#2d1550]">
          <CardContent className="py-8 text-center">
            <p className="text-[#9d7bc8] text-sm">
              Nenhuma funcionária ativa. Cadastre na aba Funcionárias.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeEmployees.map((employee) => {
            const entries = (consumptions ?? []).filter((c) => c.employee_id === employee.id)
            return (
              <EmployeeConsumptionCard
                key={employee.id}
                employee={employee}
                entries={entries}
                onDelete={handleDelete}
              />
            )
          })}
        </div>
      )}

      <AddConsumptionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        employees={employees}
      />
    </div>
  )
}

// ─── EmployeesTab ─────────────────────────────────────────────────────────────

function EmployeesTab() {
  const { data: employees, isLoading } = useEmployees()
  const addEmployee = useAddEmployee()
  const toggleEmployee = useToggleEmployee()
  const [adding, setAdding] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeForm>({ resolver: zodResolver(employeeSchema) })

  async function onSubmit(values: EmployeeForm) {
    try {
      await addEmployee.mutateAsync(values.name)
      toast.success('Funcionária cadastrada!')
      reset()
      setAdding(false)
    } catch {
      toast.error('Erro ao cadastrar. Tente novamente.')
    }
  }

  async function handleToggle(id: string, active: boolean) {
    try {
      await toggleEmployee.mutateAsync({ id, active: !active })
      toast.success(active ? 'Funcionária desativada.' : 'Funcionária reativada.')
    } catch {
      toast.error('Erro ao atualizar.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[#4c1e8c] text-white hover:bg-[#5B2D8E] transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Nova funcionária
        </button>
      </div>

      {adding && (
        <Card className="bg-[#1a0b2e] border-[#2d1550]">
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2">
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  placeholder="Nome da funcionária"
                  autoFocus
                  {...register('name')}
                  className="w-full bg-[#0f0720] border border-[#2d1550] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4c1e8c]"
                />
                {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm rounded-lg bg-[#4c1e8c] text-white hover:bg-[#5B2D8E] disabled:opacity-40 transition-colors"
              >
                {isSubmitting ? '...' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={() => { reset(); setAdding(false) }}
                className="px-3 py-2 text-sm rounded-lg text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : employees && employees.length > 0 ? (
        <Card className="bg-[#1a0b2e] border-[#2d1550]">
          <CardContent className="p-0">
            <ul className="divide-y divide-[#2d1550]">
              {employees.map((emp) => (
                <li key={emp.id} className="flex items-center justify-between px-4 py-3">
                  <span
                    className={`text-sm font-medium ${emp.active ? 'text-white' : 'text-[#9d7bc8] line-through'}`}
                  >
                    {emp.name}
                  </span>
                  <button
                    onClick={() => handleToggle(emp.id, emp.active)}
                    className={`text-xs px-3 py-1 rounded-full transition-colors ${
                      emp.active
                        ? 'text-red-400 hover:bg-red-950/30'
                        : 'text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white'
                    }`}
                  >
                    {emp.active ? 'Desativar' : 'Reativar'}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#1a0b2e] border-[#2d1550]">
          <CardContent className="py-8 text-center">
            <p className="text-[#9d7bc8] text-sm">Nenhuma funcionária cadastrada ainda.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeeConsumptionPage() {
  const { data: employees = [], isLoading } = useEmployees()

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-white">Consumo de Funcionárias</h1>

      <Tabs defaultValue="consumptions">
        <TabsList className="bg-[#1a0b2e] border border-[#2d1550] w-full">
          <TabsTrigger
            value="consumptions"
            className="flex-1 data-[state=active]:bg-[#4c1e8c] data-[state=active]:text-white text-[#9d7bc8]"
          >
            Consumos
          </TabsTrigger>
          <TabsTrigger
            value="employees"
            className="flex-1 data-[state=active]:bg-[#4c1e8c] data-[state=active]:text-white text-[#9d7bc8]"
          >
            Funcionárias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consumptions" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <ConsumptionsTab employees={employees} />
          )}
        </TabsContent>

        <TabsContent value="employees" className="mt-4">
          <EmployeesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
