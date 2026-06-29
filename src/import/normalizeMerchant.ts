/**
 * Turn a raw, messy statement descriptor into a clean merchant name suitable
 * for grouping and display, e.g.:
 *   "SQ *BLUE BOTTLE 0123 OAKLAND CA"      -> "Blue Bottle"
 *   "TST* THE COFFEE BAR 555-1212"          -> "The Coffee Bar"
 *   "PURCHASE AUTHORIZED ON 01/02 TRADER JOE'S #123 SF CA" -> "Trader Joe's"
 *
 * This is best-effort: categorization rules match on substrings, so they keep
 * working even when normalization isn't perfect.
 */

const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL',
  'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT',
  'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
])

// Payment-processor / network prefixes that often lead a descriptor.
const PREFIX_RE = /^(SQ|TST|PYPL|PAYPAL|POS|AMZN MKTP|EBAY O)\b[\s*#:.-]*/i

// Common bank "noise" phrases that wrap the real merchant.
const NOISE_PHRASES = [
  /\bpurchase\s+authorized\s+on\s+\d{1,2}\/\d{1,2}\b/i,
  /\bpos\s+(debit|purchase)\b/i,
  /\b(debit|credit)\s+card\s+(purchase|payment)\b/i,
  /\bcheckcard\b/i,
  /\brecurring\s+payment\b/i,
  /\bach\s+(debit|credit|payment)\b/i,
  /\bvisa\b|\bmastercard\b/i,
]

export function normalizeMerchant(raw: string): string {
  if (!raw) return ''
  let s = raw.toUpperCase().trim()

  for (const re of NOISE_PHRASES) s = s.replace(re, ' ')
  s = s.trimStart().replace(PREFIX_RE, ' ')

  // Strip URL noise but keep the brand: "NETFLIX.COM" -> "NETFLIX",
  // "AMZN.COM/BILL" -> "AMZN", "HELP.UBER.COM" -> "HELP.UBER".
  s = s.replace(/\b[\w.+-]+@[\w.-]+\b/g, ' ') // emails
  s = s.replace(/HTTPS?:\/\//g, ' ')
  s = s.replace(/\bWWW\./g, ' ')
  s = s.replace(/\.(COM|NET|ORG|CO|IO|GOV|EDU|US|BIZ)\b(\/\S*)?/g, ' ') // TLD + path
  s = s.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, ' ') // phone numbers

  // Drop store/reference numbers like "#1234" or standalone 3+ digit runs.
  s = s.replace(/#\s*\d+/g, ' ')
  s = s.replace(/\b\d{3,}\b/g, ' ')

  // Drop a trailing US state code (e.g. "... OAKLAND CA").
  s = s.replace(/\s+([A-Z]{2})\s*$/g, (full, code) =>
    US_STATES.has(code) ? ' ' : full,
  )

  // Collapse any leftover punctuation (keep apostrophes & ampersands) and spaces.
  s = s.replace(/[^A-Za-z0-9'&]+/g, ' ').replace(/\s{2,}/g, ' ').trim()

  // Title-case the result while keeping apostrophes (Trader Joe's).
  return s
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
