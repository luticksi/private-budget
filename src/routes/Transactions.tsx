import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { formatCents } from '../money/cents'
import { Page, EmptyState } from '../components/Page'
import { CategoryPicker } from '../components/CategoryPicker'
import { useCategoryMap } from '../categorize/useCategories'
import { applyMerchantCategory, countByMerchant, upsertLearnedRule } from '../categorize/learn'
import type { Transaction } from '../db/schema'

export function Transactions() {
  const [search, setSearch] = useState('')
  const [accountId, setAccountId] = useState<number | 'all'>('all')
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false)

  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const categoryMap = useCategoryMap()

  const transactions = useLiveQuery(
    () => db.transactions.orderBy('date').reverse().limit(1000).toArray(),
    [],
  )

  const filtered = useMemo(() => {
    if (!transactions) return []
    const q = search.trim().toLowerCase()
    return transactions.filter((t) => {
      if (accountId !== 'all' && t.accountId !== accountId) return false
      if (uncategorizedOnly && t.categoryId != null) return false
      if (!q) return true
      return (
        t.rawDescription.toLowerCase().includes(q) ||
        t.normalizedMerchant.toLowerCase().includes(q)
      )
    })
  }, [transactions, search, accountId, uncategorizedOnly])

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
      description="Search, filter, and categorize. Click a category to change it."
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          placeholder="Search description or merchant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          value={accountId}
          onChange={(e) =>
            setAccountId(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
        >
          <option value="all">All accounts</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800"
            checked={uncategorizedOnly}
            onChange={(e) => setUncategorizedOnly(e.target.checked)}
          />
          Uncategorized only
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Merchant</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.slice(0, 500).map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <td className="whitespace-nowrap px-4 py-2 text-slate-500 dark:text-slate-400">{t.date}</td>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {t.normalizedMerchant || t.rawDescription}
                  </div>
                  {t.isTransfer && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">transfer</span>
                  )}
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
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        Showing {Math.min(filtered.length, 500)} of {filtered.length} matching
        transactions. Category map has {categoryMap.size} entries.
      </p>
    </Page>
  )
}
