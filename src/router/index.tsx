import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'

export const router = createBrowserRouter([
  {
    path: '/',
    lazy: () => import('@/router/RootRedirect').then((m) => ({ Component: m.default })),
  },
  {
    path: '/login',
    lazy: () => import('@/pages/Login').then((m) => ({ Component: m.default })),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/pos',
            lazy: () => import('@/pages/POS').then((m) => ({ Component: m.default })),
          },
          {
            element: <ProtectedRoute requiredRole="admin" />,
            children: [
              {
                path: '/dashboard',
                lazy: () => import('@/pages/Dashboard').then((m) => ({ Component: m.default })),
              },
              {
                path: '/admin/settings',
                lazy: () =>
                  import('@/pages/AdminSettings').then((m) => ({ Component: m.default })),
              },
              {
                path: '/sales-history',
                lazy: () =>
                  import('@/pages/SalesHistoryPage').then((m) => ({ Component: m.default })),
              },
            ],
          },
        ],
      },
    ],
  },
])
