import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatCents } from '../money/cents'
import { Page, EmptyState } from '../components/Page'
import { useCategoryMap } from '../categorize/useCategories'
import { filterTransactions, spendingByCategory, totals } from '../reports/aggregate'

function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function Dashboard() {
  const allTx = useLiveQuery(() => db.transactions.toArray(), [])
  const batches = useLiveQuery(
    () => db.importBatches.orderBy('importedAt').reverse().limit(5).toArray(),
    [],
  )
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const categoryMap = useCategoryMap()
  const currency = accounts?.[0]?.currency ?? 'USD'
  const creditAccountIds = useMemo(
    () => new Set((accounts ?? []).filter((a) => a.type === 'credit').map((a) => a.id!)),
    [accounts],
  )

  const latestMonth = useMemo(() => {
    if (!allTx?.length) return null
    return allTx.reduce((max, t) => (t.date.slice(0, 7) > max ? t.date.slice(0, 7) : max), '0000-00')
  }, [allTx])

  const monthTx = useMemo(
    () =>
      allTx && latestMonth
        ? filterTransactions(allTx, { from: `${latestMonth}-01`, to: `${latestMonth}-31` })
        : [],
    [allTx, latestMonth],
  )

  const monthTotals = useMemo(
    () => totals(monthTx, categoryMap, creditAccountIds),
    [monthTx, categoryMap, creditAccountIds],
  )
  const topCategories = useMemo(
    () => spendingByCategory(monthTx, categoryMap, creditAccountIds).tree.slice(0, 5),
    [monthTx, categoryMap, creditAccountIds],
  )

  if (allTx && allTx.length === 0) {
    return (
      <Page
        title="Dashboard"
        description="An at-a-glance view of your spending — all computed on your device."
      >
        <EmptyState>
          No data yet. Start by{' '}
          <Link to="/import" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            importing a statement
          </Link>
          .
        </EmptyState>
      </Page>
    )
  }

  return (
    <Page
      title="Dashboard"
      description="An at-a-glance view of your spending — all computed on your device."
    >
      {latestMonth && (
        <>
          <h2 className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">{monthLabel(latestMonth)}</h2>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card label="Spending" value={formatCents(monthTotals.spendCents, currency)} />
            <Card label="Income" value={formatCents(monthTotals.incomeCents, currency)} positive />
            <Card
              label="Net"
              value={formatCents(monthTotals.netCents, currency)}
              positive={monthTotals.netCents >= 0}
            />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top categories this month</h2>
            <Link to="/reports" className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400">
              Full reports →
            </Link>
          </div>
          {topCategories.length === 0 ? (
            <EmptyState>No spending recorded for {latestMonth ? monthLabel(latestMonth) : 'this period'}.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {topCategories.map((c) => (
                <li key={c.name} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{c.name}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCents(c.amountCents, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Recent imports</h2>
          {batches && batches.length > 0 ? (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {batches.map((b) => (
                <li key={b.id} className="px-4 py-3 text-sm">
                  <div className="truncate font-medium text-slate-700 dark:text-slate-300">{b.fileName}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    {b.addedCount} added
                    {b.duplicateCount > 0 && ` · ${b.duplicateCount} dup`} ·{' '}
                    {new Date(b.importedAt).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No imports yet.</EmptyState>
          )}
        </div>
      </div>
    </Page>
  )
}

function Card({
  label,
  value,
  positive,
}: {
  label: string
  value: string
  positive?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div
        className={`text-2xl font-semibold ${
          positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}
