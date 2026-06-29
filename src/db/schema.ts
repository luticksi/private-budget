/**
 * Data model for PrivateBudget. Every record lives in the user's browser
 * (IndexedDB) and never leaves it.
 *
 * Money is stored as signed integer cents: negative = money out (a "debit"
 * or outflow), positive = money in (a "credit" or inflow).
 */

export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'other'

export interface Account {
  id?: number
  name: string
  type: AccountType
  institution?: string
  currency: string // ISO 4217, e.g. "USD"
  createdAt: number
}

/**
 * How reports treat a category:
 * - `income`: counted as income. Auto-categorization only assigns these to
 *   genuine bank deposits (a positive amount on a non-credit account).
 * - `transfer`: account-to-account movement (e.g. a credit-card payment);
 *   excluded from both income and spending.
 * - `expense`: everything else; counted as spending.
 */
export type CategoryKind = 'income' | 'expense' | 'transfer'

export interface Category {
  id?: number
  name: string
  parentId: number | null
  color?: string
  kind: CategoryKind
  /** True for categories seeded by the app (e.g. "Transfers"). */
  isSystem: boolean
}

export type RuleField = 'normalizedMerchant' | 'rawDescription'
export type RuleMatch = 'contains' | 'startsWith' | 'equals' | 'regex'
export type RuleSource = 'builtin' | 'user' | 'learned'

export interface Rule {
  id?: number
  field: RuleField
  match: RuleMatch
  /** Stored lowercased for case-insensitive matching (except regex). */
  pattern: string
  categoryId: number
  /** Higher priority wins. user/learned rules outrank builtin ones. */
  priority: number
  source: RuleSource
  enabled: boolean
  createdAt: number
}

export interface Transaction {
  id?: number
  accountId: number
  date: string // ISO date, "YYYY-MM-DD"
  amountCents: number // signed: negative = outflow, positive = inflow
  currency: string
  rawDescription: string
  normalizedMerchant: string
  categoryId: number | null // null = uncategorized
  isTransfer: boolean
  /** Links the two sides of a detected transfer. */
  transferGroupId?: string | null
  importBatchId: number
  /** Stable hash used to skip duplicates on re-import. */
  dedupHash: string
  /** Unique id from the source file (e.g. OFX FITID), when available. */
  fitId?: string | null
  notes?: string
  createdAt: number
  updatedAt: number
}

export type FileType = 'csv'

export type SignConvention =
  /** One amount column; negative numbers are money out. (Most common.) */
  | 'negativeIsOutflow'
  /** One amount column; positive numbers are money out. (Some card exports.) */
  | 'positiveIsOutflow'
  /** Separate debit and credit columns. */
  | 'separateColumns'

export interface ColumnMap {
  date: string
  description: string
  amount?: string // single signed-amount column
  debit?: string // used with separateColumns
  credit?: string // used with separateColumns
}

export interface ImportProfile {
  id?: number
  name: string
  institution?: string
  fileType: FileType
  delimiter?: string
  hasHeader: boolean
  columnMap: ColumnMap
  /** e.g. "MM/DD/YYYY", "YYYY-MM-DD", "DD/MM/YYYY". */
  dateFormat: string
  signConvention: SignConvention
  /**
   * Extra header names (beyond the mapped columns) that must also be present
   * for this profile to auto-match a file. Used to disambiguate issuers whose
   * mapped columns are generically named — e.g. Amex's "Card Member" /
   * "Account #" distinguish it from any other Date/Description/Amount export.
   */
  matchHeaders?: string[]
  defaultAccountId?: number
  /** True for profiles seeded by the app; users can still edit them. */
  isBuiltin?: boolean
  createdAt: number
}

export interface ImportBatch {
  id?: number
  profileId?: number | null
  accountId: number
  fileName: string
  importedAt: number
  rowCount: number
  addedCount: number
  duplicateCount: number
}

export interface Meta {
  key: string
  value: unknown
}
