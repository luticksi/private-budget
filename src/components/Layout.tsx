import { NavLink, Outlet } from 'react-router-dom'
import { NetworkBadge } from '../privacy/NetworkBadge'
import { ThemeToggle } from '../theme/ThemeToggle'
import { DONATE_URL } from '../config'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/import', label: 'Import' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/reports', label: 'Reports' },
  { to: '/categories', label: 'Categories' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/settings', label: 'Settings' },
]

export function Layout() {
  return (
    <div className="flex min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 px-5 py-5">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          <span className="text-lg font-semibold tracking-tight">
            Private<span className="text-sky-600 dark:text-sky-400">Budget</span>
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pb-4">
          <NavLink
            to="/privacy"
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`
            }
          >
            How your data stays private
          </NavLink>
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Donate ↗
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
          <NetworkBadge />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
        <footer className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-500">
          © {new Date().getFullYear()}{' '}
          <a
            href="https://grantingramdigital.com"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-slate-600 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
          >
            Grant-Ingram Digital
          </a>
        </footer>
      </div>
    </div>
  )
}
