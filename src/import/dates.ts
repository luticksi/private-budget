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
      case 'MM': pattern += '(\\d{2})'; break
      case 'M': pattern += '(\\d{1,2})'; break
      case 'DD': pattern += '(\\d{2})'; break
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

/** Parse a date string with a known format into an ISO "YYYY-MM-DD", or null. */
export function parseDate(value: string, format: string): string | null {
  const v = value.trim()
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

/** Pick the format that best parses a column of date strings, or null. */
export function detectDateFormat(samples: string[]): string | null {
  const values = samples.map((s) => s.trim()).filter(Boolean)
  if (!values.length) return null

  const parseAll = (fmt: string) => values.every((v) => parseDate(v, fmt) !== null)
  const viable = CANDIDATE_FORMATS.filter(parseAll)
  if (!viable.length) return null
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
