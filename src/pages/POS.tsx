import { useEffect } from 'react'
import { useScale } from '@/hooks/useScale'
import { usePdvKeyboard } from '@/hooks/usePdvKeyboard'
import { useAuthStore } from '@/stores/authStore'
import { useShiftStore } from '@/stores/shiftStore'
import { useSaleStore } from '@/stores/saleStore'
import { useScaleStore } from '@/stores/scaleStore'
import { useCombinedOrderStore } from '@/stores/combinedOrderStore'
import { ShiftStatusBar } from '@/components/shifts/ShiftStatusBar'
import { ShiftOpenScreen } from '@/components/pdv/ShiftOpenScreen'
import { ScaleConnectionStatus } from '@/components/pdv/ScaleConnectionStatus'
import { WeightDisplay } from '@/components/pdv/WeightDisplay'
import { PriceDisplay } from '@/components/pdv/PriceDisplay'
import { PaymentMethodSelector } from '@/components/pdv/PaymentMethodSelector'
import { CashFlow } from '@/components/pdv/CashFlow'
import { ConfirmSaleButton } from '@/components/pdv/ConfirmSaleButton'
import { CombinedOrderBar } from '@/components/pdv/CombinedOrderBar'
import { ManualModeDialog } from '@/components/pdv/ManualModeDialog'
import { RightPanel } from '@/components/pdv/RightPanel'

export default function POS() {
  useScale()
  usePdvKeyboard()
  const profile = useAuthStore((s) => s.profile)
  const activeShift = useShiftStore((s) => s.activeShift)
  const isShiftLoading = useShiftStore((s) => s.isLoading)
  const loadActiveShift = useShiftStore((s) => s.loadActiveShift)
  const startPolling = useShiftStore((s) => s.startPolling)
  const stopPolling = useShiftStore((s) => s.stopPolling)
  const paymentMethod = useSaleStore((s) => s.paymentMethod)
  const isManualMode = useScaleStore((s) => s.providerType === 'manual')
  const activeOrderId = useCombinedOrderStore((s) => s.activeOrderId)

  useEffect(() => {
    if (profile?.location_id && !activeShift) {
      loadActiveShift(profile.location_id)
    }
  }, [profile?.location_id, activeShift, loadActiveShift])

  useEffect(() => {
    if (profile?.location_id && activeShift?.id) {
      startPolling(profile.location_id)
    }
    return () => stopPolling()
  }, [profile?.location_id, activeShift?.id, startPolling, stopPolling])

  if (isShiftLoading && !activeShift) {
    return (
      <div className="flex items-center justify-center h-full text-[#9d7bc8]">
        Verificando turno...
      </div>
    )
  }

  if (!activeShift) {
    return <ShiftOpenScreen />
  }

  return (
    <div className="h-full flex flex-col p-4 gap-4 min-h-0">
      <ShiftStatusBar />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Fluxo principal — 2/3 */}
        <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
          <ScaleConnectionStatus />
          <WeightDisplay />
          {!isManualMode && <PriceDisplay />}

          <div className="flex-1" />

          {/* Pagamento só aparece no fluxo normal — pedido conjunto não usa */}
          {!activeOrderId && <PaymentMethodSelector />}

          {!activeOrderId && (
            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                paymentMethod === 'cash' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <CashFlow />
              </div>
            </div>
          )}

          <ConfirmSaleButton />
          <CombinedOrderBar />
        </div>

        {/* Painel direito — 1/3 */}
        <div className="lg:col-span-1 min-h-0">
          <RightPanel />
        </div>
      </div>

      <ManualModeDialog />
    </div>
  )
}
