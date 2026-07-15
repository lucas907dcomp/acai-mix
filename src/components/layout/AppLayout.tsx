import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BarChart2, History, LayoutGrid, LogOut, Menu, Settings, ShoppingCart, UtensilsCrossed, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useShiftStore } from '@/stores/shiftStore'
import { useSyncStore } from '@/stores/syncStore'
import { useLocationData } from '@/hooks/useLocationData'
import { OfflineIndicator } from '@/components/sync/OfflineIndicator'
import { LocationSelector } from '@/components/layout/LocationSelector'
import { cn } from '@/lib/utils'

const ADMIN_LINKS = [
  { to: '/pos', label: 'Caixa (PDV)', icon: ShoppingCart },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { to: '/sales-history', label: 'Histórico', icon: History },
  { to: '/employee-consumption', label: 'Consumo Func.', icon: UtensilsCrossed },
  { to: '/admin/settings', label: 'Configurações', icon: Settings },
]

// EPIC-11 / Story 11.4 — owner ganha "Visão Geral" além dos links de admin
// (opera como admin na loja ativa, mais a visão consolidada multi-loja).
const OWNER_LINKS = [
  { to: '/overview', label: 'Visão Geral', icon: LayoutGrid },
  ...ADMIN_LINKS,
]

const STAFF_LINKS = [
  { to: '/pos', label: 'Caixa (PDV)', icon: ShoppingCart },
]

export function AppLayout() {
  const profile = useAuthStore((s) => s.profile)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const clearShift = useShiftStore((s) => s.clearShift)
  const stopPolling = useShiftStore((s) => s.stopPolling)
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const syncInitialized = useRef(false)
  const { data: location } = useLocationData()

  useEffect(() => {
    if (syncInitialized.current) return
    syncInitialized.current = true
    useSyncStore.getState().initListeners()
    useSyncStore.getState().startClockWatch()
  }, [])

  const links =
    profile?.role === 'owner' ? OWNER_LINKS : profile?.role === 'admin' ? ADMIN_LINKS : STAFF_LINKS

  async function handleLogout() {
    await supabase.auth.signOut()
    stopPolling()
    clearShift()
    clearAuth()
    navigate('/login', { replace: true })
  }

  const navItems = links.map(({ to, label, icon: Icon }) => (
    <NavLink
      key={to}
      to={to}
      onClick={() => setMobileOpen(false)}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
          isActive
            ? 'bg-[#4c1e8c] text-white'
            : 'text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white'
        )
      }
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </NavLink>
  ))

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-[#2d1550]">
        <div className="w-8 h-8 rounded-full bg-[#4c1e8c] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">
            {(location?.name ?? 'A')[0].toUpperCase()}
          </span>
        </div>
        <span className="text-white font-semibold text-lg truncate">
          {location?.name ?? 'AçaiMix'}
        </span>
      </div>

      {profile?.role === 'owner' && <LocationSelector />}

      <nav className="flex-1 px-4 py-4 space-y-1" aria-label="Navegação principal">
        {navItems}
      </nav>

      <div className="px-4 py-4 border-t border-[#2d1550]">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm text-white font-medium truncate">
            {profile?.display_name || 'Usuário'}
          </p>
          <p className="text-xs text-[#9d7bc8] capitalize">{profile?.role}</p>
        </div>
        <div className="px-3 py-1 mb-1">
          <OfflineIndicator />
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#9d7bc8] hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#0f0720]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col flex-shrink-0 bg-[#1a0b2e] border-r border-[#2d1550]">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-[#1a0b2e] border-r border-[#2d1550] transition-transform duration-300 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Menu lateral"
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-[#9d7bc8] hover:text-white"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-4 px-4 py-3 bg-[#1a0b2e] border-b border-[#2d1550]">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-[#9d7bc8] hover:text-white"
            aria-label="Abrir menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-white font-semibold">{location?.name ?? 'AçaiMix'}</span>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
