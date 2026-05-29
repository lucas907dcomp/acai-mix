import { useState } from 'react'
import { useCombinedOrderStore } from '@/stores/combinedOrderStore'
import { ShiftSalesContent } from './ShiftSalesTable'
import { UnitProductsGrid } from './UnitProductsGrid'
import { CombinedOrderBar } from './CombinedOrderBar'

type Tab = 'vendas' | 'avulsos' | 'conjunto'

const TAB_LABELS: Record<Tab, string> = {
  vendas: 'Vendas',
  avulsos: 'Avulsos',
  conjunto: 'Conjunto',
}

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('vendas')
  const orderCount = useCombinedOrderStore((s) => s.orders.length)

  return (
    <div className="flex flex-col h-full rounded-xl bg-[#1a0b2e] border border-[#2d1550] overflow-hidden min-h-0">
      {/* Tab bar */}
      <div className="flex border-b border-[#2d1550] shrink-0">
        {(['vendas', 'avulsos', 'conjunto'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'text-white border-b-2 border-[#7c3aed]'
                : 'text-[#9d7bc8] hover:text-white hover:bg-[#0f0720]'
            }`}
          >
            {TAB_LABELS[tab]}
            {tab === 'conjunto' && orderCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#7c3aed] text-[10px] font-bold text-white leading-none">
                {orderCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Vendas */}
      {activeTab === 'vendas' && (
        <div className="flex flex-col flex-1 min-h-0">
          <ShiftSalesContent />
        </div>
      )}

      {/* Avulsos */}
      {activeTab === 'avulsos' && (
        <div className="flex-1 overflow-y-auto p-3">
          <UnitProductsGrid />
        </div>
      )}

      {/* Conjunto */}
      {activeTab === 'conjunto' && (
        <div className="flex-1 overflow-y-auto p-3">
          <CombinedOrderBar />
        </div>
      )}
    </div>
  )
}
