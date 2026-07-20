import { describe, expect, it } from 'vitest'
import { compareText, nextSort, sortRows, type Sort } from './sort'

type Key = 'name' | 'amount'

describe('nextSort', () => {
  const asc: Sort<Key> = { key: 'name', dir: 'asc' }

  it('flips direction when the active column is clicked again', () => {
    expect(nextSort(asc, 'name')).toEqual({ key: 'name', dir: 'desc' })
    expect(nextSort({ key: 'name', dir: 'desc' }, 'name')).toEqual(asc)
  })

  it('starts a new text column ascending', () => {
    expect(nextSort({ key: 'amount', dir: 'desc' }, 'name')).toEqual(asc)
  })

  it('starts a descending-first column descending', () => {
    expect(nextSort(asc, 'amount', ['amount'])).toEqual({ key: 'amount', dir: 'desc' })
  })
})

describe('compareText', () => {
  it('ignores case so mixed-case sources interleave correctly', () => {
    const names = ['huntington', 'Amex Blue', 'Chase']
    expect([...names].sort(compareText)).toEqual(['Amex Blue', 'Chase', 'huntington'])
  })
})

describe('sortRows', () => {
  const rows = [
    { id: 1, amount: -500 },
    { id: 2, amount: 100 },
    { id: 3, amount: -500 },
  ]
  const byAmount = (a: { amount: number }, b: { amount: number }) => a.amount - b.amount

  it('does not mutate the input', () => {
    sortRows(rows, 'desc', byAmount)
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3])
  })

  it('reverses for a descending sort', () => {
    expect(sortRows(rows, 'asc', byAmount).map((r) => r.id)).toEqual([1, 3, 2])
    expect(sortRows(rows, 'desc', byAmount).map((r) => r.id)).toEqual([2, 1, 3])
  })
})
