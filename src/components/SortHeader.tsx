import type { ReactNode } from 'react'
import type { Sort } from './sort'

/**
 * A clickable table header cell. Drop it into a `<thead>` row in place of a
 * plain `<th>`; the parent owns the `Sort` state and applies the ordering.
 */
export function SortHeader<K extends string>({
  sort,
  sortKey,
  onSort,
  align = 'left',
  children,
}: {
  sort: Sort<K>
  sortKey: K
  onSort: (key: K) => void
  align?: 'left' | 'right'
  children: ReactNode
}) {
  const active = sort.key === sortKey
  return (
    <th
      className={`px-4 py-2 font-medium ${align === 'right' ? 'text-right' : ''}`}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-700 dark:hover:text-slate-200 ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        {children}
        {/* Rendered even when inactive so headers don't jump as the sort moves. */}
        <span aria-hidden className={active ? '' : 'invisible'}>
          {sort.dir === 'asc' ? '↑' : '↓'}
        </span>
      </button>
    </th>
  )
}
