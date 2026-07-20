import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatCents } from '../money/cents'
import { Page, EmptyState } from '../components/Page'
import { useCategoryMap } from '../categorize/useCategories'
import {
  filterTransactions,
  monthRange,
  monthlyTrend,
  percentChange,
  previousMonth,
  spendingByCategory,
  totals,
  trailingMonths,
} from '../reports/aggregate'

/** How many months of history each stat card's sparkline covers. */
const SPARK_MONTHS = 6

const controlCls =
  'rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

const stepCls =
  'rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

function monthLabel(month: string, withYear = true): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString(undefined, {
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
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

  const [accountId, setAccountId] = useState<number | 'all'>('all')
  const [month, setMonth] = useState<string | null>(null)

  const account = accountId === 'all' ? undefined : accounts?.find((a) => a.id === accountId)
  const currency = account?.currency ?? accounts?.[0]?.currency ?? 'USD'
  const creditAccountIds = useMemo(
    () => new Set((accounts ?? []).filter((a) => a.type === 'credit').map((a) => a.id!)),
    [accounts],
  )

  const scopedTx = useMemo(
    () => filterTransactions(allTx ?? [], { accountId }),
    [allTx, accountId],
  )

  /** Only months that actually have data, so stepping never lands on a blank one. */
  const months = useMemo(
    () => [...new Set(scopedTx.map((t) => t.date.slice(0, 7)))].sort(),
    [scopedTx],
  )

  // Default to the newest month, and recover the same way if the chosen month
  // isn't in the list any more (switching source can drop it).
  const selected = month && months.includes(month) ? month : (months.at(-1) ?? null)
  const index = selected ? months.indexOf(selected) : -1

  const monthTx = useMemo(
    () => (selected ? filterTransactions(scopedTx, monthRange(selected)) : []),
    [scopedTx, selected],
  )
  // Compared against the *calendar* previous month, not the previous month with
  // data — "vs June" has to mean June. If June is empty the deltas drop out.
  const priorMonth = selected ? previousMonth(selected) : null
  const priorTx = useMemo(
    () => (priorMonth ? filterTransactions(scopedTx, monthRange(priorMonth)) : []),
    [scopedTx, priorMonth],
  )

  const monthTotals = useMemo(
    () => totals(monthTx, categoryMap, creditAccountIds),
    [monthTx, categoryMap, creditAccountIds],
  )
  const priorTotals = useMemo(
    () => totals(priorTx, categoryMap, creditAccountIds),
    [priorTx, categoryMap, creditAccountIds],
  )
  const topCategories = useMemo(
    () => spendingByCategory(monthTx, categoryMap, creditAccountIds).tree.slice(0, 5),
    [monthTx, categoryMap, creditAccountIds],
  )

  // A short history behind each stat, so a number reads as normal or unusual.
  const spark = useMemo(() => {
    if (!selected) return null
    const window = trailingMonths(selected, SPARK_MONTHS)
    const byMonth = new Map(
      monthlyTrend(scopedTx, categoryMap, creditAccountIds).map((p) => [p.month, p]),
    )
    return {
      spending: window.map((m) => byMonth.get(m)?.expenseCents ?? 0),
      income: window.map((m) => byMonth.get(m)?.incomeCents ?? 0),
      net: window.map((m) => byMonth.get(m)?.netCents ?? 0),
    }
  }, [scopedTx, selected, categoryMap, creditAccountIds])

  // Matches the Transactions "Uncategorized only" filter exactly, so the count
  // here is the count you land on after following the link.
  const uncategorized = useMemo(() => monthTx.filter((t) => t.categoryId == null).length, [monthTx])
  const reviewLink = selected
    ? `/transactions?uncategorized=1&month=${selected}${
        accountId === 'all' ? '' : `&account=${accountId}`
      }`
    : '/transactions?uncategorized=1'

  const vs = priorMonth ? monthLabel(priorMonth, priorMonth.slice(0, 4) !== selected?.slice(0, 4)) : ''
  const sparkLabel = selected ? `${SPARK_MONTHS} months to ${monthLabel(selected)}` : ''

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
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1">
            <button
              className={stepCls}
              onClick={() => setMonth(months[index - 1])}
              disabled={index <= 0}
              aria-label="Previous month"
            >
              ‹
            </button>
            <select
              className={controlCls}
              value={selected ?? ''}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Month"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <button
              className={stepCls}
              onClick={() => setMonth(months[index + 1])}
              disabled={index < 0 || index >= months.length - 1}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <select
            className={controlCls}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            aria-label="Source"
          >
            <option value="all">All sources</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card
          label="Spending"
          value={formatCents(monthTotals.spendCents, currency)}
          delta={percentChange(monthTotals.spendCents, priorTotals.spendCents)}
          higherIsBetter={false}
          vs={vs}
          series={spark?.spending}
          seriesLabel={`Spending, ${sparkLabel}`}
        />
        <Card
          label="Income"
          value={formatCents(monthTotals.incomeCents, currency)}
          positive
          delta={percentChange(monthTotals.incomeCents, priorTotals.incomeCents)}
          higherIsBetter
          vs={vs}
          series={spark?.income}
          seriesLabel={`Income, ${sparkLabel}`}
        />
        <Card
          label="Net"
          value={formatCents(monthTotals.netCents, currency)}
          positive={monthTotals.netCents >= 0}
          delta={percentChange(monthTotals.netCents, priorTotals.netCents)}
          higherIsBetter
          vs={vs}
          series={spark?.net}
          seriesLabel={`Net, ${sparkLabel}`}
        />
      </div>

      {uncategorized > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <span className="text-amber-900 dark:text-amber-200">
            {uncategorized} transaction(s) in {selected ? monthLabel(selected) : 'this month'} aren't
            categorized yet — they're missing from the breakdown below.
          </span>
          <Link
            to={reviewLink}
            className="shrink-0 font-medium text-amber-900 underline hover:no-underline dark:text-amber-200"
          >
            Review them →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top categories</h2>
            <Link to="/reports" className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400">
              Full reports →
            </Link>
          </div>
          {topCategories.length === 0 ? (
            <EmptyState>
              No spending recorded for {selected ? monthLabel(selected) : 'this period'}.
            </EmptyState>
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
  delta,
  higherIsBetter,
  vs,
  series,
  seriesLabel,
}: {
  label: string
  value: string
  positive?: boolean
  delta: number | null
  higherIsBetter: boolean
  vs: string
  series?: number[]
  seriesLabel: string
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
      <Delta pct={delta} higherIsBetter={higherIsBetter} vs={vs} />
      <Sparkline values={series} label={seriesLabel} />
    </div>
  )
}

/**
 * A bare inline-SVG trend line. Deliberately hand-rolled rather than pulling in
 * Recharts: that lives in the lazily-loaded Reports chunk, and importing it here
 * would drag a ~380 kB charting library into the app's first paint.
 */
function Sparkline({ values, label }: { values?: number[]; label: string }) {
  if (!values || values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1 // a flat series would otherwise divide by zero
  const width = 100
  const height = 24
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / span) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="mt-3 h-6 w-full text-slate-400 dark:text-slate-500"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        // The viewBox is stretched to the card width, which would smear the
        // stroke along with it.
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** "↑ 12% vs June", coloured by whether that direction is good for this stat. */
function Delta({
  pct,
  higherIsBetter,
  vs,
}: {
  pct: number | null
  higherIsBetter: boolean
  vs: string
}) {
  if (pct == null || !vs) return null
  if (pct === 0) {
    return <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">flat vs {vs}</div>
  }
  const good = pct > 0 === higherIsBetter
  return (
    <div
      className={`mt-1 text-xs font-medium ${
        good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      }`}
    >
      {pct > 0 ? '↑' : '↓'} {Math.abs(pct)}% vs {vs}
    </div>
  )
}
