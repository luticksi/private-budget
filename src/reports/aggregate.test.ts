import { describe, it, expect } from 'vitest'
import {
  spendingByCategory,
  monthlyTrend,
  monthRange,
  percentChange,
  previousMonth,
  topMerchants,
  totals,
  trailingMonths,
} from './aggregate'
import type { Category, Transaction } from '../db/schema'

const categories = new Map<number, Category>([
  [1, { id: 1, name: 'Food & Dining', parentId: null, kind: 'expense', isSystem: false }],
  [2, { id: 2, name: 'Coffee Shops', parentId: 1, kind: 'expense', isSystem: false }],
  [3, { id: 3, name: 'Groceries', parentId: 1, kind: 'expense', isSystem: false }],
  [10, { id: 10, name: 'Salary', parentId: null, kind: 'income', isSystem: false }],
  [20, { id: 20, name: 'Credit Card Payment', parentId: null, kind: 'transfer', isSystem: true }],
])

function tx(over: Partial<Transaction>): Transaction {
  return {
    accountId: 1,
    date: '2024-01-15',
    amountCents: -500,
    currency: 'USD',
    rawDescription: 'X',
    normalizedMerchant: 'X',
    categoryId: 2,
    isTransfer: false,
    importBatchId: 0,
    dedupHash: Math.random().toString(),
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }
}

describe('spendingByCategory', () => {
  it('rolls leaves up to parents with merchant drill-down', () => {
    const txs = [
      tx({ categoryId: 2, normalizedMerchant: 'Blue Bottle', amountCents: -500 }),
      tx({ categoryId: 2, normalizedMerchant: 'Blue Bottle', amountCents: -700 }),
      tx({ categoryId: 2, normalizedMerchant: 'Starbucks', amountCents: -400 }),
      tx({ categoryId: 3, normalizedMerchant: 'Whole Foods', amountCents: -8000 }),
      tx({ categoryId: null, normalizedMerchant: 'Mystery', amountCents: -100 }),
    ]
    const { tree, totalCents } = spendingByCategory(txs, categories)
    expect(totalCents).toBe(9700)

    const food = tree.find((n) => n.name === 'Food & Dining')!
    expect(food.amountCents).toBe(9600)
    const coffee = food.children.find((c) => c.name === 'Coffee Shops')!
    expect(coffee.amountCents).toBe(1600)
    expect(coffee.merchants[0]).toEqual({ merchant: 'Blue Bottle', amountCents: 1200, count: 2 })

    expect(tree.find((n) => n.name === 'Uncategorized')?.amountCents).toBe(100)
  })

  it('ignores transfers and income', () => {
    const txs = [
      tx({ amountCents: -500 }),
      tx({ amountCents: -500, isTransfer: true }),
      tx({ amountCents: 2000, categoryId: null }),
    ]
    expect(spendingByCategory(txs, categories).totalCents).toBe(500)
  })
})

describe('credit-card payments and income recognition', () => {
  it('does not count a positive amount on a credit account as income', () => {
    const creditAccountIds = new Set([2])
    const txs = [
      // A credit-card payment lands as a positive (inflow) amount on the card.
      tx({ accountId: 2, amountCents: 174644, categoryId: null }),
      // A genuine bank deposit on a checking account.
      tx({ accountId: 1, amountCents: 5000, categoryId: null }),
    ]
    expect(totals(txs, categories, creditAccountIds)).toEqual({
      spendCents: 0,
      incomeCents: 5000,
      netCents: 5000,
    })
  })

  it('excludes a transfer-kind category from income even on a bank account', () => {
    const txs = [tx({ accountId: 1, amountCents: 174644, categoryId: 20 })]
    expect(totals(txs, categories).incomeCents).toBe(0)
  })

  it('counts an income-kind category as income when the user assigns it', () => {
    const txs = [tx({ accountId: 1, amountCents: 250000, categoryId: 10 })]
    expect(totals(txs, categories).incomeCents).toBe(250000)
  })
})

describe('monthlyTrend', () => {
  it('aggregates income and expense per month', () => {
    const points = monthlyTrend(
      [
        tx({ date: '2024-01-05', amountCents: -1000 }),
        tx({ date: '2024-01-20', amountCents: 5000, categoryId: null }),
        tx({ date: '2024-02-10', amountCents: -2000 }),
      ],
      categories,
    )
    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({ month: '2024-01', expenseCents: 1000, incomeCents: 5000, netCents: 4000 })
    expect(points[1]).toMatchObject({ month: '2024-02', expenseCents: 2000 })
  })
})

describe('topMerchants & totals', () => {
  const txs = [
    tx({ normalizedMerchant: 'A', amountCents: -1000 }),
    tx({ normalizedMerchant: 'A', amountCents: -500 }),
    tx({ normalizedMerchant: 'B', amountCents: -2000 }),
    tx({ amountCents: 3000, categoryId: null }),
  ]
  it('ranks merchants by spend', () => {
    const top = topMerchants(txs, categories)
    expect(top[0]).toEqual({ merchant: 'B', amountCents: 2000, count: 1 })
    expect(top[1]).toEqual({ merchant: 'A', amountCents: 1500, count: 2 })
  })
  it('computes totals', () => {
    expect(totals(txs, categories)).toEqual({ spendCents: 3500, incomeCents: 3000, netCents: -500 })
  })
})

describe('month helpers', () => {
  it('covers a whole month, including short and leap-year February', () => {
    expect(monthRange('2024-01')).toEqual({ from: '2024-01-01', to: '2024-01-31' })
    expect(monthRange('2023-02')).toEqual({ from: '2023-02-01', to: '2023-02-28' })
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
    expect(monthRange('2024-04')).toEqual({ from: '2024-04-01', to: '2024-04-30' })
  })

  it('steps back across a year boundary', () => {
    expect(previousMonth('2024-03')).toBe('2024-02')
    expect(previousMonth('2024-01')).toBe('2023-12')
  })
})

describe('percentChange', () => {
  it('reports the change relative to the prior value', () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(80, 100)).toBe(-20)
    expect(percentChange(100, 100)).toBe(0)
  })

  it('has no answer when there is no baseline to compare against', () => {
    expect(percentChange(500, 0)).toBeNull()
  })

  it('treats a negative baseline improving as a rise', () => {
    // Net went from -$1.00 to -$0.50 — half the shortfall, so up 50%.
    expect(percentChange(-50, -100)).toBe(50)
    expect(percentChange(-200, -100)).toBe(-100)
  })
})

describe('trailingMonths', () => {
  it('returns a contiguous window ending at the given month, oldest first', () => {
    expect(trailingMonths('2024-03', 4)).toEqual(['2023-12', '2024-01', '2024-02', '2024-03'])
  })

  it('handles the degenerate window sizes', () => {
    expect(trailingMonths('2024-03', 1)).toEqual(['2024-03'])
    expect(trailingMonths('2024-03', 0)).toEqual([])
  })
})
