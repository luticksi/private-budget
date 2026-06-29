import { db } from '../db'
import type { CategoryKind, Rule } from '../db/schema'

/**
 * Deterministic, rule-based categorization. Rules are applied in priority
 * order (user/learned rules outrank the built-in starter dictionary); the
 * first match wins. Everything runs locally and is fully transparent — you can
 * see exactly which rule assigned a category.
 */

export interface CategorizerInput {
  normalizedMerchant: string
  rawDescription: string
  /** Signed cents — needed so income rules only match actual deposits. */
  amountCents: number
  /** A credit-card account: a positive amount here is a payment, not income. */
  isCreditAccount: boolean
}

/** A deposit is an inflow into a non-credit account — the only place income belongs. */
function isBankDeposit(input: CategorizerInput): boolean {
  return input.amountCents > 0 && !input.isCreditAccount
}

export function matchRule(rule: Rule, input: CategorizerInput): boolean {
  const value = (
    rule.field === 'rawDescription' ? input.rawDescription : input.normalizedMerchant
  ).toLowerCase()

  if (rule.match === 'regex') {
    try {
      return new RegExp(rule.pattern, 'i').test(value)
    } catch {
      return false
    }
  }

  const pattern = rule.pattern.toLowerCase()
  switch (rule.match) {
    case 'contains':
      return value.includes(pattern)
    case 'startsWith':
      return value.startsWith(pattern)
    case 'equals':
      return value === pattern
  }
}

/** Load enabled rules, highest priority first. */
export async function loadEnabledRules(): Promise<Rule[]> {
  const rules = await db.rules.filter((r) => r.enabled).toArray()
  return rules.sort((a, b) => b.priority - a.priority)
}

/**
 * Categorize against a preloaded rule set (sync — for tight loops). Pass
 * `categoryKinds` so income-kind rules are only applied to genuine bank
 * deposits — this keeps a credit-card payment (a positive amount on a credit
 * account) from being labelled, and counted, as income.
 */
export function categorizeWith(
  rules: Rule[],
  input: CategorizerInput,
  categoryKinds?: Map<number, CategoryKind>,
): number | null {
  for (const rule of rules) {
    if (!matchRule(rule, input)) continue
    if (categoryKinds?.get(rule.categoryId) === 'income' && !isBankDeposit(input)) continue
    return rule.categoryId
  }
  return null
}

/** Map of categoryId → kind, used to guard income matching. */
export async function loadCategoryKinds(): Promise<Map<number, CategoryKind>> {
  const cats = await db.categories.toArray()
  return new Map(cats.map((c) => [c.id!, c.kind]))
}

/** Set of credit-card account ids, used to tell deposits from card payments. */
export async function loadCreditAccountIds(): Promise<Set<number>> {
  const accounts = await db.accounts.toArray()
  return new Set(accounts.filter((a) => a.type === 'credit').map((a) => a.id!))
}

/** Categorize a single transaction (loads rules and category kinds from the DB). */
export async function categorize(input: CategorizerInput): Promise<number | null> {
  return categorizeWith(await loadEnabledRules(), input, await loadCategoryKinds())
}

/** Apply rules to every uncategorized, non-transfer transaction. Returns count changed. */
export async function recategorizeUncategorized(): Promise<number> {
  const [rules, categoryKinds, creditAccountIds] = await Promise.all([
    loadEnabledRules(),
    loadCategoryKinds(),
    loadCreditAccountIds(),
  ])
  let changed = 0
  await db.transaction('rw', db.transactions, async () => {
    const pending = await db.transactions
      .filter((t) => t.categoryId == null && !t.isTransfer)
      .toArray()
    for (const t of pending) {
      const categoryId = categorizeWith(
        rules,
        {
          normalizedMerchant: t.normalizedMerchant,
          rawDescription: t.rawDescription,
          amountCents: t.amountCents,
          isCreditAccount: creditAccountIds.has(t.accountId),
        },
        categoryKinds,
      )
      if (categoryId != null) {
        await db.transactions.update(t.id!, { categoryId, updatedAt: Date.now() })
        changed++
      }
    }
  })
  return changed
}
