import { db } from './index'
import type { Category, CategoryKind } from './schema'

// v2: added Pets, Taxes, Loans, Investments (transfer), Postage & Shipping.
const SEED_FLAG = 'seed:categories:v2'

/**
 * Default category tree. Top-level entries are parents; their `children`
 * become sub-categories. `kind` (defaulting to "expense") drives how reports
 * treat a category and its children. "Transfers" is a system category used by
 * transfer detection so account-to-account moves don't count as spending;
 * "Investments" lives under it because moving money into a brokerage isn't
 * spending either.
 */
export const CATEGORY_TREE: Array<{
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
  { name: 'Pets', children: [] },
  { name: 'Gifts & Donations', children: [] },
  { name: 'Taxes', children: [] },
  { name: 'Loans', children: [] },
  { name: 'Fees & Charges', children: ['Bank Fees', 'Interest Charges', 'ATM', 'Postage & Shipping'] },
  { name: 'Transfers', system: true, kind: 'transfer', children: ['Credit Card Payment', 'Investments'] },
]

/**
 * Seed default categories. Idempotent and upgrade-safe: categories are matched
 * by name (case-insensitive), so a v1 user keeps every existing category —
 * edits included — and only gains the ones added since. A category the user
 * renamed will be re-added under its original name; they can delete it.
 */
export async function ensureSeeded(): Promise<void> {
  const done = await db.meta.get(SEED_FLAG)
  if (done) return

  await db.transaction('rw', db.categories, db.meta, async () => {
    // Re-check inside the transaction to avoid a double-seed race.
    if (await db.meta.get(SEED_FLAG)) return

    const existing = await db.categories.toArray()
    const idByName = new Map(existing.map((c) => [c.name.toLowerCase(), c.id!]))

    for (const parent of CATEGORY_TREE) {
      const kind: CategoryKind = parent.kind ?? 'expense'
      let parentId = idByName.get(parent.name.toLowerCase())
      if (parentId == null) {
        parentId = (await db.categories.add({
          name: parent.name,
          parentId: null,
          kind,
          isSystem: !!parent.system,
        } satisfies Category)) as number
        idByName.set(parent.name.toLowerCase(), parentId)
      }

      for (const child of parent.children ?? []) {
        if (idByName.has(child.toLowerCase())) continue
        const childId = (await db.categories.add({
          name: child,
          parentId,
          kind,
          isSystem: !!parent.system,
        } satisfies Category)) as number
        idByName.set(child.toLowerCase(), childId)
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
