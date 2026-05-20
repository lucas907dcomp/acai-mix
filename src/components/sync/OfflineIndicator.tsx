import { Loader2, WifiOff } from 'lucide-react'
import { useSyncStore } from '@/stores/syncStore'
import { Badge } from '@/components/ui/badge'

export function OfflineIndicator() {
  const isOnline = useSyncStore((s) => s.isOnline)
  const pendingCount = useSyncStore((s) => s.pendingCount)
  const isSyncing = useSyncStore((s) => s.isSyncing)

  if (isSyncing) {
    return (
      <Badge
        variant="secondary"
        className="flex items-center gap-1 text-xs"
        aria-live="polite"
        aria-label="Sincronizando vendas offline"
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        Sincronizando...
      </Badge>
    )
  }

  if (!isOnline || pendingCount > 0) {
    return (
      <Badge
        variant="destructive"
        className="flex items-center gap-1 text-xs"
        aria-live="assertive"
        aria-label={
          !isOnline
            ? `Offline — ${pendingCount} venda${pendingCount !== 1 ? 's' : ''} pendente${pendingCount !== 1 ? 's' : ''}`
            : `${pendingCount} venda${pendingCount !== 1 ? 's' : ''} pendente${pendingCount !== 1 ? 's' : ''} de sincronização`
        }
      >
        <WifiOff className="w-3 h-3" />
        {!isOnline ? 'Offline' : 'Pendente'}
        {pendingCount > 0 && ` — ${pendingCount}`}
      </Badge>
    )
  }

  return (
    <span
      className="text-xs text-green-500 flex items-center gap-1"
      aria-label="Online"
    >
      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" aria-hidden="true" />
      Online
    </span>
  )
}
