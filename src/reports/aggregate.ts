import type { Category, Transaction } from '../db/schema'

/**
 * Pure aggregation over transactions. These functions power the reports and
 * dashboard. Spending means outflows; income means deposits. Transfers and
 * credit-card payments/credits are excluded from both — see `classifyTxn`.
 */

export interface ReportFilters {
  from?: string // ISO date inclusive
  to?: string // ISO date inclusive
  accountId?: number | 'all'
}

export function filterTransactions(txs: Transaction[], f: ReportFilters): Transaction[] {
  return txs.filter((t) => {
    if (f.accountId && f.accountId !== 'all' && t.accountId !== f.accountId) return false
    if (f.from && t.date < f.from) return false
    if (f.to && t.date > f.to) return false
    return true
  })
}

export type TxnClass = 'income' | 'spending' | 'excluded'

/**
 * Decide whether a transaction counts as income, spending, or neither.
 *
 * Income is driven by the category's `kind`, not by sign alone — a positive
 * amount is only treated as income when it's an actual bank deposit (an inflow
 * into a non-credit account) or sits in an income-kind category the user chose.
 * A positive amount on a credit-card account is a payment/refund/credit, so it
 * counts as neither income nor spending. Transfers are always excluded.
 */
export function classifyTxn(
  t: Transaction,
  categories: Map<number, Category>,
  creditAccountIds?: Set<number>,
): TxnClass {
  if (t.isTransfer) return 'excluded'
  const kind = t.categoryId != null ? categories.get(t.categoryId)?.kind : undefined
  if (kind === 'transfer') return 'excluded'
  if (kind === 'income') return 'income'
  if (t.amountCents < 0) return 'spending'
  // A positive amount not explicitly in an income category: count it as income
  // only when it's a genuine bank deposit; otherwise it's a card payment/credit.
  if (kind === 'expense') return 'excluded'
  return creditAccountIds?.has(t.accountId) ? 'excluded' : 'income'
}

export interface MerchantSpend {
  merchant: string
  amountCents: number
  count: number
}

export interface CategorySpend {
  categoryId: number | null
  name: string
  amountCents: number
  children: CategorySpend[]
  merchants: MerchantSpend[]
}

interface Bucket {
  amount: number
  merchants: Map<string, { amt: number; count: number }>
}

function merchantName(t: Transaction): string {
  return t.normalizedMerchant || t.rawDescription || 'Unknown'
}

function sortMerchants(m: Bucket['merchants']): MerchantSpend[] {
  return [...m.entries()]
    .map(([merchant, e]) => ({ merchant, amountCents: e.amt, count: e.count }))
    .sort((a, b) => b.amountCents - a.amountCents)
}

/**
 * Spending grouped into a two-level tree: top-level categories, each with leaf
 * sub-categories, each carrying its merchant breakdown — i.e. the drill-down
 * "Food & Dining → Coffee Shops → Blue Bottle".
 */
export function spendingByCategory(
  txs: Transaction[],
  categories: Map<number, Category>,
  creditAccountIds?: Set<number>,
): { tree: CategorySpend[]; totalCents: number } {
  const byCat = new Map<number | null, Bucket>()
  let total = 0

  for (const t of txs) {
    if (classifyTxn(t, categories, creditAccountIds) !== 'spending') continue
    const amt = Math.abs(t.amountCents)
    total += amt
    const bucket = byCat.get(t.categoryId) ?? { amount: 0, merchants: new Map() }
    bucket.amount += amt
    const name = merchantName(t)
    const m = bucket.merchants.get(name) ?? { amt: 0, count: 0 }
    m.amt += amt
    m.count += 1
    bucket.merchants.set(name, m)
    byCat.set(t.categoryId, bucket)
  }

  // Assemble into parent groups.
  const parents = new Map<number, CategorySpend>()
  const ensureParent = (parent: Category): CategorySpend => {
    let node = parents.get(parent.id!)
    if (!node) {
      node = { categoryId: parent.id!, name: parent.name, amountCents: 0, children: [], merchants: [] }
      parents.set(parent.id!, node)
    }
    return node
  }

  const orphans: CategorySpend[] = []

  for (const [categoryId, bucket] of byCat) {
    const leaf: CategorySpend = {
      categoryId,
      name: categoryId == null ? 'Uncategorized' : (categories.get(categoryId)?.name ?? 'Unknown'),
      amountCents: bucket.amount,
      children: [],
      merchants: sortMerchants(bucket.merchants),
    }

    if (categoryId == null) {
      orphans.push(leaf)
      continue
    }
    const cat = categories.get(categoryId)
    if (cat?.parentId != null) {
      const parent = categories.get(cat.parentId)
      if (parent) {
        ensureParent(parent).children.push(leaf)
        continue
      }
    }
    if (cat && cat.parentId == null) {
      // Spend assigned directly to a top-level category.
      const node = ensureParent(cat)
      node.merchants = mergeMerchants(node.merchants, leaf.merchants)
      node.children.push({ ...leaf, name: `${cat.name} (general)` })
      continue
    }
    orphans.push(leaf)
  }

  const tree = [...parents.values(), ...orphans].map((node) => {
    node.children.sort((a, b) => b.amountCents - a.amountCents)
    node.amountCents = node.children.length
      ? node.children.reduce((s, c) => s + c.amountCents, 0)
      : node.amountCents
    return node
  })
  tree.sort((a, b) => b.amountCents - a.amountCents)

  return { tree, totalCents: total }
}

function mergeMerchants(a: MerchantSpend[], b: MerchantSpend[]): MerchantSpend[] {
  const map = new Map(a.map((m) => [m.merchant, { ...m }]))
  for (const m of b) {
    const e = map.get(m.merchant)
    if (e) {
      e.amountCents += m.amountCents
      e.count += m.count
    } else {
      map.set(m.merchant, { ...m })
    }
  }
  return [...map.values()].sort((x, y) => y.amountCents - x.amountCents)
}

export interface MonthPoint {
  month: string // "YYYY-MM"
  incomeCents: number
  expenseCents: number
  netCents: number
}

export function monthlyTrend(
  txs: Transaction[],
  categories: Map<number, Category>,
  creditAccountIds?: Set<number>,
): MonthPoint[] {
  const months = new Map<string, { inc: number; exp: number }>()
  for (const t of txs) {
    const cls = classifyTxn(t, categories, creditAccountIds)
    if (cls === 'excluded') continue
    const month = t.date.slice(0, 7)
    const e = months.get(month) ?? { inc: 0, exp: 0 }
    if (cls === 'income') e.inc += t.amountCents
    else e.exp += Math.abs(t.amountCents)
    months.set(month, e)
  }
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, e]) => ({
      month,
      incomeCents: e.inc,
      expenseCents: e.exp,
      netCents: e.inc - e.exp,
    }))
}

export function topMerchants(
  txs: Transaction[],
  categories: Map<number, Category>,
  creditAccountIds?: Set<number>,
  limit = 10,
): MerchantSpend[] {
  const m = new Map<string, { amt: number; count: number }>()
  for (const t of txs) {
    if (classifyTxn(t, categories, creditAccountIds) !== 'spending') continue
    const name = merchantName(t)
    const e = m.get(name) ?? { amt: 0, count: 0 }
    e.amt += Math.abs(t.amountCents)
    e.count += 1
    m.set(name, e)
  }
  return sortMerchants(m).slice(0, limit)
}

export interface Totals {
  spendCents: number
  incomeCents: number
  netCents: number
}

export function totals(
  txs: Transaction[],
  categories: Map<number, Category>,
  creditAccountIds?: Set<number>,
): Totals {
  let spend = 0
  let income = 0
  for (const t of txs) {
    const cls = classifyTxn(t, categories, creditAccountIds)
    if (cls === 'spending') spend += Math.abs(t.amountCents)
    else if (cls === 'income') income += t.amountCents
  }
  return { spendCents: spend, incomeCents: income, netCents: income - spend }
}
