import { db } from '../db'
import type { Rule } from '../db/schema'

/**
 * Deterministic, rule-based categorization. Rules are applied in priority
 * order (user/learned rules outrank the built-in starter dictionary); the
 * first match wins. Everything runs locally and is fully transparent — you can
 * see exactly which rule assigned a category.
 */

export interface CategorizerInput {
  normalizedMerchant: string
  rawDescription: string
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

/** Categorize against a preloaded rule set (sync — for tight loops). */
export function categorizeWith(rules: Rule[], input: CategorizerInput): number | null {
  for (const rule of rules) {
    if (matchRule(rule, input)) return rule.categoryId
  }
  return null
}

/** Categorize a single transaction (loads rules from the DB). */
export async function categorize(input: CategorizerInput): Promise<number | null> {
  return categorizeWith(await loadEnabledRules(), input)
}

/** Apply rules to every uncategorized, non-transfer transaction. Returns count changed. */
export async function recategorizeUncategorized(): Promise<number> {
  const rules = await loadEnabledRules()
  let changed = 0
  await db.transaction('rw', db.transactions, async () => {
    const pending = await db.transactions
      .filter((t) => t.categoryId == null && !t.isTransfer)
      .toArray()
    for (const t of pending) {
      const categoryId = categorizeWith(rules, {
        normalizedMerchant: t.normalizedMerchant,
        rawDescription: t.rawDescription,
      })
      if (categoryId != null) {
        await db.transactions.update(t.id!, { categoryId, updatedAt: Date.now() })
        changed++
      }
    }
  })
  return changed
}
