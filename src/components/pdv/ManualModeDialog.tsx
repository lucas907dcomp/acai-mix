import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useScaleStore } from '@/stores/scaleStore'
import { useSwitchToManual } from '@/hooks/useScale'

export function ManualModeDialog() {
  const showManualDialog = useScaleStore((s) => s.showManualDialog)
  const closeManualDialog = useScaleStore((s) => s.closeManualDialog)
  const { confirmManual } = useSwitchToManual()

  return (
    <Dialog open={showManualDialog} onOpenChange={(open) => !open && closeManualDialog()}>
      <DialogContent className="bg-[#1a0b2e] border-[#2d1550] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Ativar Modo Manual</DialogTitle>
          <DialogDescription className="text-[#9d7bc8]">
            A balança não está conectada ou você optou por digitar o peso manualmente.
            Esta venda será registrada com <strong className="text-[#fcd34d]">peso manual</strong>{' '}
            para fins de auditoria.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={closeManualDialog}
            className="border-[#2d1550] text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmManual}
            className="bg-[#4c1e8c] hover:bg-[#5d2aaa] text-white"
          >
            Confirmar Modo Manual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
