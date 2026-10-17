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
        // Standalone print page — no AppLayout (no sidebar/nav)
        path: '/shift-report',
        lazy: () => import('@/pages/ShiftReport').then((m) => ({ Component: m.default })),
      },
      {
        element: <AppLayout />,
        children: [
          {
            path: '/pos',
            lazy: () => import('@/pages/POS').then((m) => ({ Component: m.default })),
          },
          {
            // EPIC-11 / Story 11.4 — estrito: admin/staff não acessam,
            // nem por URL direta (satisfiesRequiredRole não amplia
            // "owner" para admin/staff, só o inverso).
            element: <ProtectedRoute requiredRole="owner" />,
            children: [
              {
                path: '/overview',
                lazy: () => import('@/pages/OwnerOverview').then((m) => ({ Component: m.default })),
              },
            ],
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
              {
                path: '/employee-consumption',
                lazy: () =>
                  import('@/pages/EmployeeConsumption').then((m) => ({ Component: m.default })),
              },
            ],
          },
        ],
      },
    ],
  },
])
