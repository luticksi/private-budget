import { describe, it, expect } from 'vitest'
import { spendingByCategory, monthlyTrend, topMerchants, totals } from './aggregate'
import type { Category, Transaction } from '../db/schema'

const categories = new Map<number, Category>([
  [1, { id: 1, name: 'Food & Dining', parentId: null, isSystem: false }],
  [2, { id: 2, name: 'Coffee Shops', parentId: 1, isSystem: false }],
  [3, { id: 3, name: 'Groceries', parentId: 1, isSystem: false }],
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

describe('monthlyTrend', () => {
  it('aggregates income and expense per month', () => {
    const points = monthlyTrend([
      tx({ date: '2024-01-05', amountCents: -1000 }),
      tx({ date: '2024-01-20', amountCents: 5000 }),
      tx({ date: '2024-02-10', amountCents: -2000 }),
    ])
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
    const top = topMerchants(txs)
    expect(top[0]).toEqual({ merchant: 'B', amountCents: 2000, count: 1 })
    expect(top[1]).toEqual({ merchant: 'A', amountCents: 1500, count: 2 })
  })
  it('computes totals', () => {
    expect(totals(txs)).toEqual({ spendCents: 3500, incomeCents: 3000, netCents: -500 })
  })
})
