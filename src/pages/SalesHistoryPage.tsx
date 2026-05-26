import { useState } from 'react'
import { startOfDay, endOfDay, subDays } from 'date-fns'
import { SalesHistoryFilters } from '@/components/sales/SalesHistoryFilters'
import { SalesHistoryTable } from '@/components/sales/SalesHistoryTable'
import { useSalesHistory } from '@/hooks/useSalesHistory'
import { useHistoryProductOptions } from '@/hooks/useHistoryProductOptions'
import type { PaymentMethod, SaleStatus } from '@/types'

function defaultFrom() {
  return startOfDay(subDays(new Date(), 29))
}

function defaultTo() {
  return endOfDay(new Date())
}

export default function SalesHistoryPage() {
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [statuses, setStatuses] = useState<SaleStatus[]>([])
  const [productIds, setProductIds] = useState<string[]>([])
  const [page, setPage] = useState(0)

  const { data, isLoading } = useSalesHistory({ from, to, paymentMethods, statuses, productIds, page })
  const { data: productOptions = [] } = useHistoryProductOptions()

  function handleFromChange(d: Date) {
    setFrom(d)
    setPage(0)
  }

  function handleToChange(d: Date) {
    setTo(d)
    setPage(0)
  }

  function handlePaymentMethodsChange(v: PaymentMethod[]) {
    setPaymentMethods(v)
    setPage(0)
  }

  function handleStatusesChange(v: SaleStatus[]) {
    setStatuses(v)
    setPage(0)
  }

  function handleProductIdsChange(v: string[]) {
    setProductIds(v)
    setPage(0)
  }

  function handleClearFilters() {
    setFrom(defaultFrom())
    setTo(defaultTo())
    setPaymentMethods([])
    setStatuses([])
    setProductIds([])
    setPage(0)
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold text-white">Histórico de Vendas</h1>
      <SalesHistoryFilters
        from={from}
        to={to}
        paymentMethods={paymentMethods}
        statuses={statuses}
        productIds={productIds}
        productOptions={productOptions}
        page={page}
        totalPages={data?.totalPages ?? 0}
        onFromChange={handleFromChange}
        onToChange={handleToChange}
        onPaymentMethodsChange={handlePaymentMethodsChange}
        onStatusesChange={handleStatusesChange}
        onProductIdsChange={handleProductIdsChange}
        onPageChange={setPage}
        onClearFilters={handleClearFilters}
      />
      <SalesHistoryTable sales={data?.data ?? []} isLoading={isLoading} />
    </div>
  )
}
