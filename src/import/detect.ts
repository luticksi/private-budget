import { parseAmountToCents } from '../money/cents'
import { detectDateFormat, parseDate } from './dates'
import type { MappingConfig, RawTable } from './types'
import type { AccountType, SignConvention } from '../db/schema'

/**
 * Best-effort auto-detection of how a CSV maps to transactions: which column
 * is the date, which is the description, and how amounts are represented. The
 * user can override anything in the import wizard, so this just needs to get
 * close.
 */

interface ColumnStat {
  header: string
  index: number
  nonEmpty: number
  amountLike: number
  /** Cells that carry a fractional part (e.g. "12.34") — i.e. look like cents. */
  decimalLike: number
  dateFormat: string | null
  dateLike: number
  avgLen: number
}

function isAmountLike(cell: string): boolean {
  const v = cell.trim()
  if (!v || /[A-Za-z/]/.test(v)) return false
  return parseAmountToCents(v) !== null
}

/** A digit, a `.`/`,` separator, then 1–2 digits: the signature of cents. */
const hasDecimals = (cell: string): boolean => /\d[.,]\d{1,2}\b/.test(cell.trim())

function analyze(table: RawTable): ColumnStat[] {
  const sample = table.rows.slice(0, 100)
  return table.headers.map((header, index) => {
    const cells = sample.map((r) => (r[index] ?? '').trim())
    const nonEmptyCells = cells.filter(Boolean)
    const dateFormat = detectDateFormat(nonEmptyCells)
    const dateLike = dateFormat
      ? nonEmptyCells.filter((c) => parseDate(c, dateFormat) !== null).length
      : 0
    return {
      header,
      index,
      nonEmpty: nonEmptyCells.length,
      amountLike: nonEmptyCells.filter(isAmountLike).length,
      decimalLike: nonEmptyCells.filter(hasDecimals).length,
      dateFormat,
      dateLike,
      avgLen: nonEmptyCells.length
        ? nonEmptyCells.reduce((a, c) => a + c.length, 0) / nonEmptyCells.length
        : 0,
    }
  })
}

const rate = (n: number, total: number) => (total ? n / total : 0)
const hint = (header: string, re: RegExp) => re.test(header)

/** Headers that name a money value, used to rescue whole-dollar columns. */
const MONEY_HEADER =
  /amount|amt|charge|debit|credit|balance|payment|deposit|withdraw|spent|total|value|price|\bfee/i

/**
 * A column is a money column if its cells parse as amounts AND it isn't an
 * integer-only id column (account #, zip, reference). We allow integer-only
 * columns through only when the header explicitly names money — that's what
 * keeps "Account #" (-41004) from being mistaken for a debit column.
 */
function isAmountColumn(s: ColumnStat): boolean {
  if (rate(s.amountLike, s.nonEmpty) <= 0.6) return false
  return rate(s.decimalLike, s.nonEmpty) >= 0.5 || MONEY_HEADER.test(s.header)
}

export function detectMapping(
  table: RawTable,
  opts?: { accountType?: AccountType },
): MappingConfig {
  const stats = analyze(table)

  // --- Date column: highest date-parse rate, header hint breaks ties. ---
  const dateCol =
    [...stats]
      .filter((s) => rate(s.dateLike, s.nonEmpty) > 0.6)
      .sort(
        (a, b) =>
          rate(b.dateLike, b.nonEmpty) - rate(a.dateLike, a.nonEmpty) ||
          Number(hint(b.header, /date|posted|trans/i)) -
            Number(hint(a.header, /date|posted|trans/i)),
      )[0] ?? stats[0]

  // --- Amount columns: money-like, excluding the date column. ---
  const amountCols = stats.filter((s) => s.index !== dateCol.index && isAmountColumn(s))

  let signConvention: SignConvention = 'negativeIsOutflow'
  let amount: string | undefined
  let debit: string | undefined
  let credit: string | undefined

  if (amountCols.length >= 2) {
    // Separate debit/credit columns: assign by header hint, else by position.
    const debitCol =
      amountCols.find((s) => hint(s.header, /debit|withdraw|charge|out/i)) ??
      amountCols[0]
    const creditCol =
      amountCols.find(
        (s) => hint(s.header, /credit|deposit|payment|in\b/i) && s.index !== debitCol.index,
      ) ?? amountCols.find((s) => s.index !== debitCol.index) ?? amountCols[1]
    signConvention = 'separateColumns'
    debit = debitCol.header
    credit = creditCol.header
  } else if (amountCols.length === 1) {
    amount = amountCols[0].header
    // If the column reads like charges, positive likely means money out. On a
    // credit-card account the same is true even for a plainly-named "Amount"
    // column (Amex et al. list charges positive, payments negative).
    if (
      hint(amountCols[0].header, /charge|debit|withdraw|spent/i) ||
      opts?.accountType === 'credit'
    ) {
      signConvention = 'positiveIsOutflow'
    }
  }

  // --- Description: remaining column with the most text, header hint wins. ---
  const usedIndexes = new Set(
    [dateCol.index, ...amountCols.map((c) => c.index)].filter((i) => i != null),
  )
  const descCandidates = stats.filter((s) => !usedIndexes.has(s.index))
  const descCol =
    [...descCandidates].sort(
      (a, b) =>
        Number(hint(b.header, /desc|name|payee|memo|detail|merchant|narrative|transaction/i)) -
          Number(hint(a.header, /desc|name|payee|memo|detail|merchant|narrative|transaction/i)) ||
        b.avgLen - a.avgLen,
    )[0] ??
    descCandidates[0] ??
    stats[0]

  return {
    columnMap: { date: dateCol.header, description: descCol.header, amount, debit, credit },
    dateFormat: dateCol.dateFormat ?? 'YYYY-MM-DD',
    signConvention,
  }
}
