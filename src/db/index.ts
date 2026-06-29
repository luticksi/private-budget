import Dexie, { type Table } from 'dexie'
import type {
  Account,
  Category,
  ImportBatch,
  ImportProfile,
  Meta,
  Rule,
  Transaction,
} from './schema'

/**
 * The entire database lives in the browser via IndexedDB. There is no server
 * counterpart — this class is the whole storage layer.
 */
export class BudgetDB extends Dexie {
  accounts!: Table<Account, number>
  categories!: Table<Category, number>
  rules!: Table<Rule, number>
  transactions!: Table<Transaction, number>
  importProfiles!: Table<ImportProfile, number>
  importBatches!: Table<ImportBatch, number>
  meta!: Table<Meta, string>

  constructor() {
    super('privatebudget')
    // The string after each table name lists its indexed properties.
    this.version(1).stores({
      accounts: '++id, name, type',
      categories: '++id, parentId, name',
      rules: '++id, categoryId, priority, source, enabled',
      transactions:
        '++id, accountId, date, categoryId, dedupHash, importBatchId, normalizedMerchant, isTransfer',
      importProfiles: '++id, name, institution',
      importBatches: '++id, accountId, importedAt',
      meta: 'key',
    })

    // v2 adds Category.kind (income/expense/transfer). It isn't indexed, so the
    // stores schema is unchanged; the upgrade backfills existing categories by
    // their tree position so income recognition no longer relies on sign alone.
    this.version(2).upgrade(async (tx) => {
      const table = tx.table<Category, number>('categories')
      const cats = await table.toArray()
      const byId = new Map(cats.map((c) => [c.id!, c]))
      const kindOf = (c: Category): Category['kind'] => {
        const top = c.parentId != null ? (byId.get(c.parentId) ?? c) : c
        if (top.name === 'Income') return 'income'
        if (top.name === 'Transfers') return 'transfer'
        return 'expense'
      }
      await Promise.all(
        cats.map((c) => table.update(c.id!, { kind: kindOf(c) })),
      )
    })
  }
}

export const db = new BudgetDB()

/** All table names, used by backup/restore and the "wipe everything" action. */
export const TABLE_NAMES = [
  'accounts',
  'categories',
  'rules',
  'transactions',
  'importProfiles',
  'importBatches',
  'meta',
] as const
