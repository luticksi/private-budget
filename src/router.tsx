import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './routes/Dashboard'
import { Import } from './routes/Import'
import { Transactions } from './routes/Transactions'
import { Categories } from './routes/Categories'
import { Accounts } from './routes/Accounts'
import { Settings } from './routes/Settings'
import { Privacy } from './routes/Privacy'

// Reports pulls in the charting library; load it only when visited (same-origin
// chunk fetch, allowed by the strict CSP).
const Reports = lazy(() =>
  import('./routes/Reports').then((m) => ({ default: m.Reports })),
)

const loading = <div className="p-6 text-sm text-slate-400">Loading…</div>

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'import', element: <Import /> },
      { path: 'transactions', element: <Transactions /> },
      { path: 'reports', element: <Suspense fallback={loading}>{<Reports />}</Suspense> },
      { path: 'categories', element: <Categories /> },
      { path: 'accounts', element: <Accounts /> },
      { path: 'settings', element: <Settings /> },
      { path: 'privacy', element: <Privacy /> },
    ],
  },
])
