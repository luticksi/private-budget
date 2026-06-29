import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { db } from '../db'
import { formatCents } from '../money/cents'
import { Page, EmptyState } from '../components/Page'
import { useTheme } from '../theme/ThemeProvider'
import { useCategoryMap } from '../categorize/useCategories'
import {
  filterTransactions,
  monthlyTrend,
  spendingByCategory,
  topMerchants,
  totals,
  type CategorySpend,
} from '../reports/aggregate'

const inputCls =
  'rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

export function Reports() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const allTx = useLiveQuery(() => db.transactions.toArray(), [])
  const categoryMap = useCategoryMap()
  const { theme } = useTheme()

  // Recharts renders to SVG/HTML and doesn't know about our `dark` class, so
  // axis, grid and legend colors are chosen explicitly from the active theme.
  const dark = theme === 'dark'
  const axisTick = { fontSize: 12, fill: dark ? '#94a3b8' : '#64748b' }
  const gridStroke = dark ? '#1e293b' : '#e2e8f0'
  const legendStyle = { fontSize: 12, color: dark ? '#cbd5e1' : '#334155' }

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [accountId, setAccountId] = useState<number | 'all'>('all')

  const txs = useMemo(
    () => (allTx ? filterTransactions(allTx, { from, to, accountId }) : []),
    [allTx, from, to, accountId],
  )

  const currency = accounts?.[0]?.currency ?? 'USD'
  const { tree, totalCents } = useMemo(
    () => spendingByCategory(txs, categoryMap),
    [txs, categoryMap],
  )
  const trend = useMemo(() => monthlyTrend(txs), [txs])
  const merchants = useMemo(() => topMerchants(txs, 10), [txs])
  const sums = useMemo(() => totals(txs), [txs])

  if (allTx && allTx.length === 0) {
    return (
      <Page title="Reports">
        <EmptyState>
          Nothing to report yet.{' '}
          <Link to="/import" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Import a statement
          </Link>{' '}
          first.
        </EmptyState>
      </Page>
    )
  }

  return (
    <Page
      title="Reports"
      description="Where your money goes — by category, by merchant, and over time. Computed on your device."
    >
      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          From
          <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          To
          <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Account
          <select
            className={inputCls}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">All accounts</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Totals */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Spending" value={formatCents(sums.spendCents, currency)} tone="slate" />
        <Stat label="Income" value={formatCents(sums.incomeCents, currency)} tone="emerald" />
        <Stat
          label="Net"
          value={formatCents(sums.netCents, currency)}
          tone={sums.netCents >= 0 ? 'emerald' : 'red'}
        />
      </div>

      {/* Trend */}
      {trend.length > 0 && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Monthly income vs. spending</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="month" tick={axisTick} />
                <YAxis tick={axisTick} tickFormatter={(v) => `$${Math.round(v / 100)}`} />
                <Tooltip
                  formatter={(v: number) => formatCents(v, currency)}
                  contentStyle={
                    dark
                      ? { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }
                      : undefined
                  }
                  labelStyle={dark ? { color: '#e2e8f0' } : undefined}
                  cursor={{ fill: dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.06)' }}
                />
                <Legend wrapperStyle={legendStyle} />
                <Bar dataKey="incomeCents" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenseCents" name="Spending" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Category drill-down */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Spending by category</h2>
          {tree.length === 0 ? (
            <EmptyState>No spending in this range.</EmptyState>
          ) : (
            <div className="space-y-2">
              {tree.map((node) => (
                <CategoryRow key={node.name} node={node} totalCents={totalCents} currency={currency} />
              ))}
            </div>
          )}
        </div>

        {/* Top merchants */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Top merchants</h2>
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {merchants.map((m) => (
                <li key={m.merchant} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="truncate text-slate-700 dark:text-slate-300">{m.merchant}</span>
                  <span className="ml-2 shrink-0 font-medium text-slate-900 dark:text-slate-100">
                    {formatCents(m.amountCents, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Page>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'slate' | 'emerald' | 'red'
}) {
  const color =
    tone === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'red'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-900 dark:text-slate-100'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}

/** A drill-down row: category → sub-categories → merchants. */
function CategoryRow({
  node,
  totalCents,
  currency,
}: {
  node: CategorySpend
  totalCents: number
  currency: string
}) {
  const [open, setOpen] = useState(false)
  const pct = totalCents ? Math.round((node.amountCents / totalCents) * 100) : 0
  const hasDetail = node.children.length > 0 || node.merchants.length > 0

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        onClick={() => hasDetail && setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="w-4 text-slate-400 dark:text-slate-500">{hasDetail ? (open ? '▾' : '▸') : ''}</span>
        <span className="flex-1">
          <span className="font-medium text-slate-900 dark:text-slate-100">{node.name}</span>
          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{pct}%</span>
          <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <span className="block h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
          </span>
        </span>
        <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCents(node.amountCents, currency)}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-3 dark:border-slate-800">
          {node.children.length > 0
            ? node.children.map((child) => (
                <SubRow key={child.name} node={child} currency={currency} />
              ))
            : node.merchants.map((m) => (
                <MerchantLine key={m.merchant} name={m.merchant} amountCents={m.amountCents} count={m.count} currency={currency} />
              ))}
        </div>
      )}
    </div>
  )
}

function SubRow({ node, currency }: { node: CategorySpend; currency: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button
        onClick={() => node.merchants.length > 0 && setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-sm"
      >
        <span className="text-slate-700 dark:text-slate-300">
          <span className="mr-1 text-slate-400 dark:text-slate-500">{node.merchants.length > 0 ? (open ? '▾' : '▸') : '·'}</span>
          {node.name}
        </span>
        <span className="font-medium text-slate-800 dark:text-slate-200">{formatCents(node.amountCents, currency)}</span>
      </button>
      {open && (
        <div className="ml-5 mt-1 space-y-1">
          {node.merchants.map((m) => (
            <MerchantLine key={m.merchant} name={m.merchant} amountCents={m.amountCents} count={m.count} currency={currency} />
          ))}
        </div>
      )}
    </div>
  )
}

function MerchantLine({
  name,
  amountCents,
  count,
  currency,
}: {
  name: string
  amountCents: number
  count: number
  currency: string
}) {
  return (
    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
      <span className="truncate">
        {name} <span className="text-slate-400 dark:text-slate-500">×{count}</span>
      </span>
      <span className="ml-2 shrink-0">{formatCents(amountCents, currency)}</span>
    </div>
  )
}
