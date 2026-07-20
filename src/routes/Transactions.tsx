import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router-dom'
import { db } from '../db'
import { formatCents } from '../money/cents'
import { Page, EmptyState } from '../components/Page'
import { CategoryPicker } from '../components/CategoryPicker'
import { SortHeader } from '../components/SortHeader'
import { transactionDetail } from '../components/transactionDetail'
import { compareText, nextSort, sortRows, type Sort } from '../components/sort'
import { monthRange } from '../reports/aggregate'
import { useCategoryMap, categoryPath } from '../categorize/useCategories'
import { applyMerchantCategory, countByMerchant, upsertLearnedRule } from '../categorize/learn'
import type { Transaction } from '../db/schema'

const PAGE_SIZE = 100

type SortKey = 'date' | 'merchant' | 'source' | 'category' | 'amount'
/** Columns where the first click should show the largest values first. */
const DESC_FIRST: SortKey[] = ['date', 'amount']

const pagerCls =
  'rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

const MONTH_RE = /^\d{4}-\d{2}$/

/** Filters come from the URL, so a hand-edited param has to be treated as untrusted. */
function readAccount(params: URLSearchParams): number | 'all' {
  const id = Number(params.get('account'))
  return Number.isInteger(id) && id > 0 ? id : 'all'
}

function readMonth(params: URLSearchParams): string | 'all' {
  const m = params.get('month')
  return m && MONTH_RE.test(m) ? m : 'all'
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

export function Transactions() {
  // Filters live in the URL so the dashboard can deep-link into an exact slice
  // ("July's uncategorized Amex rows") and the back button behaves. Sort, page,
  // and selection stay local — they're view state, not a place worth linking to.
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const accountId = readAccount(params)
  const month = readMonth(params)
  const uncategorizedOnly = params.get('uncategorized') === '1'

  const [sort, setSort] = useState<Sort<SortKey>>({ key: 'date', dir: 'desc' })
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [page, setPage] = useState(0)
  // Which merchant cell is being renamed inline, and its working value.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const categoryMap = useCategoryMap()
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])

  function setFilter(key: string, value: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
    setPage(0)
  }

  const hasFilters =
    search !== '' || accountId !== 'all' || month !== 'all' || uncategorizedOnly

  /** Newest first — the month you'd reach for is almost always a recent one. */
  const months = useMemo(
    () => [...new Set((transactions ?? []).map((t) => t.date.slice(0, 7)))].sort().reverse(),
    [transactions],
  )

  /** A transaction's "source" is the account it was imported into. */
  const accountNames = useMemo(
    () => new Map(accounts?.map((a) => [a.id!, a.name]) ?? []),
    [accounts],
  )
  const sourceOf = (t: Transaction) => accountNames.get(t.accountId) ?? 'Unknown'
  const merchantOf = (t: Transaction) => t.normalizedMerchant || t.rawDescription

  const filtered = useMemo(() => {
    if (!transactions) return []
    const q = search.trim().toLowerCase()
    const range = month === 'all' ? null : monthRange(month)
    return transactions.filter((t) => {
      if (accountId !== 'all' && t.accountId !== accountId) return false
      if (range && (t.date < range.from || t.date > range.to)) return false
      if (uncategorizedOnly && t.categoryId != null) return false
      if (!q) return true
      return (
        t.rawDescription.toLowerCase().includes(q) ||
        t.normalizedMerchant.toLowerCase().includes(q) ||
        (t.memo?.toLowerCase().includes(q) ?? false) ||
        (t.checkNumber?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [transactions, search, accountId, month, uncategorizedOnly])

  const sorted = useMemo(() => {
    const comparators: Record<SortKey, (a: Transaction, b: Transaction) => number> = {
      date: (a, b) => a.date.localeCompare(b.date),
      merchant: (a, b) => compareText(merchantOf(a), merchantOf(b)),
      source: (a, b) => compareText(sourceOf(a), sourceOf(b)),
      category: (a, b) =>
        compareText(
          categoryPath(categoryMap, a.categoryId),
          categoryPath(categoryMap, b.categoryId),
        ),
      amount: (a, b) => a.amountCents - b.amountCents,
    }
    return sortRows(filtered, sort.dir, comparators[sort.key])
  }, [filtered, sort, categoryMap, accountNames])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  // Deleting or filtering can shrink the list out from under the current page.
  const currentPage = Math.min(page, pageCount - 1)
  const visible = sorted.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  // Select-all spans every row matching the current filters, not just the page
  // on screen — that's what makes "delete everything from Huntington" one click.
  const filteredIds = useMemo(() => filtered.map((t) => t.id!), [filtered])
  const selectedHere = filteredIds.reduce((n, id) => (selected.has(id) ? n + 1 : n), 0)
  const allSelected = filteredIds.length > 0 && selectedHere === filteredIds.length

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of filteredIds) {
        if (allSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  async function deleteSelected() {
    const ids = [...selected]
    if (!ids.length) return
    const ok = confirm(
      `Permanently delete ${ids.length} transaction(s)?\n\n` +
        'This cannot be undone, but re-importing the same statement will bring them back.',
    )
    if (!ok) return
    await db.transactions.bulkDelete(ids)
    setSelected(new Set())
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id!)
    setEditValue(merchantOf(t))
  }

  async function saveEdit(t: Transaction) {
    const value = editValue.trim()
    setEditingId(null)
    if (value === merchantOf(t)) return
    // The merchant is what the list shows and what category-learning groups by,
    // so an edited name flows straight into "apply to other X transactions".
    await db.transactions.update(t.id!, { normalizedMerchant: value, updatedAt: Date.now() })
  }

  async function setCategory(tx: Transaction, categoryId: number | null) {
    await db.transactions.update(tx.id!, { categoryId, updatedAt: Date.now() })

    // Offer to learn and bulk-apply for other transactions from this merchant.
    const merchant = tx.normalizedMerchant
    if (categoryId == null || !merchant) return
    const total = await countByMerchant(merchant)
    const others = total - 1
    if (others > 0) {
      const ok = confirm(
        `Apply this category to ${others} other "${merchant}" transaction(s) and remember it for future imports?`,
      )
      if (ok) {
        await applyMerchantCategory(merchant, categoryId)
        await upsertLearnedRule(merchant, categoryId)
      }
    }
  }

  if (transactions && transactions.length === 0) {
    return (
      <Page title="Transactions">
        <EmptyState>
          No transactions yet.{' '}
          <Link to="/import" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Import a statement
          </Link>{' '}
          to get started.
        </EmptyState>
      </Page>
    )
  }

  return (
    <Page
      title="Transactions"
      description="Search, filter, and categorize. Click a merchant name to rename it, a category to change it, or a column header to sort by it."
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          placeholder="Search description or merchant…"
          value={search}
          onChange={(e) => setFilter('q', e.target.value)}
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          value={accountId}
          onChange={(e) => setFilter('account', e.target.value === 'all' ? null : e.target.value)}
          aria-label="Source"
        >
          <option value="all">All sources</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          value={month}
          onChange={(e) => setFilter('month', e.target.value === 'all' ? null : e.target.value)}
          aria-label="Month"
        >
          <option value="all">All time</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800"
            checked={uncategorizedOnly}
            onChange={(e) => setFilter('uncategorized', e.target.checked ? '1' : null)}
          />
          Uncategorized only
        </label>
        {hasFilters && (
          <button
            onClick={() => {
              setParams({}, { replace: true })
              setPage(0)
            }}
            className="text-sm font-medium text-slate-500 hover:underline dark:text-slate-400"
          >
            Clear filters
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm dark:border-sky-900 dark:bg-sky-950/40">
          <span className="font-medium text-sky-900 dark:text-sky-200">
            {selected.size} transaction(s) selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelected(new Set())}
              className="font-medium text-slate-600 hover:underline dark:text-slate-300"
            >
              Clear selection
            </button>
            <button
              onClick={deleteSelected}
              className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700"
            >
              Delete selected
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all matching transactions"
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = selectedHere > 0 && !allSelected
                  }}
                  onChange={toggleAllFiltered}
                />
              </th>
              {(
                [
                  ['date', 'Date', 'left'],
                  ['merchant', 'Merchant', 'left'],
                  ['source', 'Source', 'left'],
                  ['category', 'Category', 'left'],
                  ['amount', 'Amount', 'right'],
                ] as const
              ).map(([key, label, align]) => (
                <SortHeader
                  key={key}
                  sort={sort}
                  sortKey={key}
                  align={align}
                  onSort={(k) => setSort((s) => nextSort(s, k, DESC_FIRST))}
                >
                  {label}
                </SortHeader>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {visible.map((t) => (
              <tr
                key={t.id}
                className={
                  selected.has(t.id!)
                    ? 'bg-sky-50 dark:bg-sky-950/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }
              >
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Select ${merchantOf(t)} on ${t.date}`}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800"
                    checked={selected.has(t.id!)}
                    onChange={() => toggleOne(t.id!)}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-500 dark:text-slate-400">{t.date}</td>
                <td className="px-4 py-2">
                  {editingId === t.id ? (
                    <input
                      autoFocus
                      className="w-full rounded-md border border-sky-400 px-2 py-1 text-sm font-medium focus:outline-none dark:border-sky-500 dark:bg-slate-800 dark:text-slate-100"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => void saveEdit(t)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveEdit(t)
                        else if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      title="Click to rename"
                      className="rounded text-left font-medium text-slate-900 hover:underline focus:outline-none focus:ring-2 focus:ring-sky-400 dark:text-slate-100"
                    >
                      {merchantOf(t) || (
                        <span className="italic text-slate-400 dark:text-slate-500">
                          (no description — click to name)
                        </span>
                      )}
                    </button>
                  )}
                  {transactionDetail(t) && (
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      {transactionDetail(t)}
                    </div>
                  )}
                  {t.isTransfer && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">transfer</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-500 dark:text-slate-400">
                  {sourceOf(t)}
                </td>
                <td className="px-4 py-2">
                  <CategoryPicker
                    value={t.categoryId}
                    onChange={(cid) => setCategory(t, cid)}
                    allowParents
                  />
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-2 text-right font-medium ${
                    t.amountCents < 0
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {formatCents(t.amountCents, t.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <p>
          {sorted.length} matching transaction(s)
          {sorted.length > 0 && (
            <>
              {' · showing '}
              {currentPage * PAGE_SIZE + 1}–{currentPage * PAGE_SIZE + visible.length}
            </>
          )}
        </p>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 0}
              className={pagerCls}
            >
              Previous
            </button>
            <span>
              Page {currentPage + 1} of {pageCount}
            </span>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= pageCount - 1}
              className={pagerCls}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </Page>
  )
}
