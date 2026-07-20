/**
 * Lightweight date parsing for statement imports. We support a fixed set of
 * common formats described by tokens (YYYY, YY, MM, M, DD, D, MMM, MMMM) and
 * can auto-detect which one a column uses.
 */

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
]

/** Formats tried during auto-detection, roughly most-specific first. */
export const CANDIDATE_FORMATS = [
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'MM/DD/YYYY',
  'DD/MM/YYYY',
  'M/D/YYYY',
  'D/M/YYYY',
  'MM-DD-YYYY',
  'DD-MM-YYYY',
  'DD.MM.YYYY',
  'MM/DD/YY',
  'DD/MM/YY',
  'MMM DD, YYYY',
  'MMM D, YYYY',
  'DD MMM YYYY',
  'D MMM YYYY',
  'MMMM D, YYYY',
]

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface Matcher {
  regex: RegExp
  order: string[]
}

const matcherCache = new Map<string, Matcher>()

function buildMatcher(format: string): Matcher {
  const cached = matcherCache.get(format)
  if (cached) return cached

  const tokenRe = /YYYY|YY|MMMM|MMM|MM|M|DD|D/g
  let pattern = ''
  const order: string[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(format))) {
    pattern += escapeRegex(format.slice(last, m.index))
    const tok = m[0]
    order.push(tok)
    switch (tok) {
      case 'YYYY': pattern += '(\\d{4})'; break
      case 'YY': pattern += '(\\d{2})'; break
      case 'MMMM':
      case 'MMM': pattern += '([A-Za-z]+)'; break
      // MM/DD accept an unpadded number too: banks are inconsistent about
      // zero-padding ("6/29/26" vs "06/29/26"), sometimes within one file, and
      // a format that rejects half a column is no use to anyone.
      case 'MM':
      case 'M': pattern += '(\\d{1,2})'; break
      case 'DD':
      case 'D': pattern += '(\\d{1,2})'; break
    }
    last = m.index + tok.length
  }
  pattern += escapeRegex(format.slice(last))
  const matcher = { regex: new RegExp('^' + pattern + '$'), order }
  matcherCache.set(format, matcher)
  return matcher
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * A time-of-day tacked onto a date, as fintech exports tend to emit:
 * "2026-07-01T14:03:22Z", "2026-07-01 14:03:22 UTC", "07/01/2026 2:03 PM".
 * We budget on whole days, so the time is dropped rather than parsed.
 */
const TIME_SUFFIX =
  /[T\s]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\s*(?:[AaPp]\.?[Mm]\.?)?\s*(?:Z|UTC|GMT|[+-]\d{2}:?\d{2})?$/

/** Strip a trailing time so date-only formats can still match. */
export function stripTime(value: string): string {
  return value.trim().replace(TIME_SUFFIX, '').trim()
}

/** Parse a date string with a known format into an ISO "YYYY-MM-DD", or null. */
export function parseDate(value: string, format: string): string | null {
  const v = stripTime(value)
  if (!v) return null
  const { regex, order } = buildMatcher(format)
  const match = regex.exec(v)
  if (!match) return null

  let year = 0
  let month = 0
  let day = 0
  for (let i = 0; i < order.length; i++) {
    const tok = order[i]
    const raw = match[i + 1]
    if (tok === 'YYYY') year = Number(raw)
    else if (tok === 'YY') year = 2000 + Number(raw)
    else if (tok === 'MM' || tok === 'M') month = Number(raw)
    else if (tok === 'MMM' || tok === 'MMMM') {
      const idx = MONTHS.indexOf(raw.slice(0, 3).toLowerCase())
      if (idx === -1) return null
      month = idx + 1
    } else if (tok === 'DD' || tok === 'D') day = Number(raw)
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * Share of a column a format must parse to be considered. Deliberately below
 * 1 so a stray footer ("Total:") or blank-ish cell can't disqualify the format
 * the other 99% of the column uses — `mapCsvRows` skips those rows and reports
 * them instead.
 */
const MIN_PARSE_RATE = 0.9

/** Pick the format that best parses a column of date strings, or null. */
export function detectDateFormat(samples: string[]): string | null {
  const values = samples.map((s) => s.trim()).filter(Boolean)
  if (!values.length) return null

  const parseRate = (fmt: string) =>
    values.filter((v) => parseDate(v, fmt) !== null).length / values.length

  const scored = CANDIDATE_FORMATS.map((f) => ({ format: f, rate: parseRate(f) })).filter(
    (s) => s.rate >= MIN_PARSE_RATE,
  )
  if (!scored.length) return null

  // Only formats tied at the best rate compete; a format that explains more of
  // the column always beats one that explains less.
  const bestRate = Math.max(...scored.map((s) => s.rate))
  const viable = scored.filter((s) => s.rate === bestRate).map((s) => s.format)
  if (viable.length === 1) return viable[0]

  // If month-first and day-first both parse everything, disambiguate by looking
  // for a first-position value > 12 (which can only be a day).
  const dayFirst = viable.find((f) => /^D/.test(f))
  const monthFirst = viable.find((f) => /^M/.test(f))
  if (dayFirst && monthFirst) {
    const firstNumberTooBigForMonth = values.some((v) => {
      const n = Number((v.match(/^(\d{1,2})/) ?? [])[1])
      return n > 12
    })
    return firstNumberTooBigForMonth ? dayFirst : monthFirst
  }

  return viable[0]
}
