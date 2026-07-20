/**
 * Shared click-to-sort plumbing for the app's data tables. Everything here is
 * pure so the ordering rules can be tested without rendering a table.
 */

export type SortDir = 'asc' | 'desc'

export interface Sort<K extends string> {
  key: K
  dir: SortDir
}

/**
 * Where a click on `key` leaves the sort. Clicking the active column flips its
 * direction; clicking a new column starts at that column's natural direction —
 * text reads best A→Z, while dates and amounts are more useful biggest-first.
 */
export function nextSort<K extends string>(
  current: Sort<K>,
  key: K,
  descFirst: readonly K[] = [],
): Sort<K> {
  if (current.key === key) {
    return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  }
  return { key, dir: descFirst.includes(key) ? 'desc' : 'asc' }
}

/** Case- and accent-insensitive compare, so "amex" sorts next to "Amex". */
export function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

/**
 * Sorts a copy of `rows` with `cmp`, reversing it for a descending sort.
 * Array#sort is stable, so rows that compare equal keep their prior order.
 */
export function sortRows<T>(rows: T[], dir: SortDir, cmp: (a: T, b: T) => number): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => sign * cmp(a, b))
}
