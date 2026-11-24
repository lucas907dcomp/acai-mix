import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from '@/router'
import { AuthProvider } from '@/providers/AuthProvider'
import { queryClient } from '@/lib/queryClient'
import './index.css'

// Página aberta de antes de uma publicação pede arquivos que não existem mais
// ("Failed to fetch dynamically imported module"). Recarregar traz a versão
// nova. No máximo uma vez por minuto, para não entrar em laço se for a rede; e
// só com internet, senão trocaria uma aba quebrada pelo caixa inteiro fora.
window.addEventListener('vite:preloadError', (e) => {
  const ultima = Number(sessionStorage.getItem('recarregou-em') ?? 0)
  if (!navigator.onLine || Date.now() - ultima < 60_000) return
  sessionStorage.setItem('recarregou-em', String(Date.now()))
  e.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
      </AuthProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>
)
