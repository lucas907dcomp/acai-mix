import { ShiftSalesContent } from './ShiftSalesTable'
import { UnitProductsGrid } from './UnitProductsGrid'

export function RightPanel() {
  return (
    <div className="flex flex-col h-full rounded-xl bg-[#1a0b2e] border border-[#2d1550] overflow-hidden min-h-0">
      {/* Topo: Produtos Avulsos — altura natural, limitada a 45% do painel */}
      <div className="shrink-0 border-b border-[#2d1550] p-3 overflow-y-auto max-h-[45%]">
        <UnitProductsGrid />
      </div>

      {/* Base: Vendas do turno — ocupa o restante */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-4 py-2.5 border-b border-[#2d1550] shrink-0">
          <h3 className="text-sm font-semibold text-white">Vendas do turno</h3>
        </div>
        <ShiftSalesContent />
      </div>
    </div>
  )
}
