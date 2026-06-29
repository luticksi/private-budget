import { db } from './index'
import type { Category, CategoryKind } from './schema'

const SEED_FLAG = 'seed:categories:v1'

/**
 * Default category tree. Top-level entries are parents; their `children`
 * become sub-categories. `kind` (defaulting to "expense") drives how reports
 * treat a category and its children. "Transfers" is a system category used by
 * transfer detection so account-to-account moves don't count as spending.
 */
const CATEGORY_TREE: Array<{
  name: string
  system?: boolean
  kind?: CategoryKind
  children?: string[]
}> = [
  { name: 'Income', kind: 'income', children: ['Salary', 'Refunds & Reimbursements', 'Interest', 'Other Income'] },
  {
    name: 'Food & Dining',
    children: ['Groceries', 'Restaurants', 'Coffee Shops', 'Fast Food', 'Alcohol & Bars', 'Food Delivery'],
  },
  {
    name: 'Transportation',
    children: ['Gas', 'Rideshare & Taxi', 'Public Transit', 'Parking & Tolls', 'Auto & Maintenance'],
  },
  {
    name: 'Housing',
    children: ['Rent & Mortgage', 'Utilities', 'Internet & Phone', 'Home Maintenance'],
  },
  { name: 'Shopping', children: ['Clothing', 'Electronics', 'General Merchandise', 'Online Shopping'] },
  { name: 'Entertainment', children: ['Streaming', 'Movies & Events', 'Hobbies', 'Games'] },
  { name: 'Health', children: ['Pharmacy', 'Doctor & Dental', 'Fitness', 'Insurance'] },
  { name: 'Travel', children: ['Flights', 'Hotels', 'Car Rental'] },
  { name: 'Bills & Subscriptions', children: ['Software', 'Memberships'] },
  { name: 'Personal Care', children: [] },
  { name: 'Education', children: [] },
  { name: 'Gifts & Donations', children: [] },
  { name: 'Fees & Charges', children: ['Bank Fees', 'Interest Charges', 'ATM'] },
  { name: 'Transfers', system: true, kind: 'transfer', children: ['Credit Card Payment'] },
]

/** Seed default categories once. Safe to call on every app start. */
export async function ensureSeeded(): Promise<void> {
  const done = await db.meta.get(SEED_FLAG)
  if (done) return

  await db.transaction('rw', db.categories, db.meta, async () => {
    // Re-check inside the transaction to avoid a double-seed race.
    if (await db.meta.get(SEED_FLAG)) return

    for (const parent of CATEGORY_TREE) {
      const kind: CategoryKind = parent.kind ?? 'expense'
      const parentId = await db.categories.add({
        name: parent.name,
        parentId: null,
        kind,
        isSystem: !!parent.system,
      } satisfies Category)

      for (const child of parent.children ?? []) {
        await db.categories.add({
          name: child,
          parentId,
          kind,
          isSystem: !!parent.system,
        } satisfies Category)
      }
    }

    await db.meta.put({ key: SEED_FLAG, value: Date.now() })
  })
}

/** Look up a category id by exact name (case-insensitive). Used by rule seeding. */
export async function categoryIdByName(name: string): Promise<number | undefined> {
  const lower = name.toLowerCase()
  const all = await db.categories.toArray()
  return all.find((c) => c.name.toLowerCase() === lower)?.id
}
