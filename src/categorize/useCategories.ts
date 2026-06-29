import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Category } from '../db/schema'

export function useCategories(): Category[] {
  return useLiveQuery(() => db.categories.toArray(), [], [] as Category[])
}

export function useCategoryMap(): Map<number, Category> {
  const cats = useCategories()
  return useMemo(() => new Map(cats.map((c) => [c.id!, c])), [cats])
}

/** "Food & Dining › Coffee Shops" for a leaf, or just the name for a parent. */
export function categoryPath(map: Map<number, Category>, id: number | null): string {
  if (id == null) return 'Uncategorized'
  const cat = map.get(id)
  if (!cat) return 'Uncategorized'
  if (cat.parentId == null) return cat.name
  const parent = map.get(cat.parentId)
  return parent ? `${parent.name} › ${cat.name}` : cat.name
}

export interface CategoryGroup {
  parent: Category
  children: Category[]
}

/** Categories arranged as parent groups with their children, for pickers. */
export function useCategoryGroups(): CategoryGroup[] {
  const cats = useCategories()
  return useMemo(() => {
    const parents = cats.filter((c) => c.parentId == null).sort(byName)
    return parents.map((parent) => ({
      parent,
      children: cats.filter((c) => c.parentId === parent.id).sort(byName),
    }))
  }, [cats])
}

const byName = (a: Category, b: Category) => a.name.localeCompare(b.name)
