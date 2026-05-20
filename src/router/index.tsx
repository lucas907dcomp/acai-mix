import { createBrowserRouter } from 'react-router-dom'

export const router = createBrowserRouter([
  {
    path: '/',
    lazy: () => import('@/pages/Landing').then((m) => ({ Component: m.default })),
  },
  {
    path: '/login',
    lazy: () => import('@/pages/Login').then((m) => ({ Component: m.default })),
  },
  {
    path: '/pos',
    lazy: () => import('@/pages/POS').then((m) => ({ Component: m.default })),
  },
  {
    path: '/dashboard',
    lazy: () => import('@/pages/Dashboard').then((m) => ({ Component: m.default })),
  },
  {
    path: '/admin/settings',
    lazy: () => import('@/pages/AdminSettings').then((m) => ({ Component: m.default })),
  },
])
