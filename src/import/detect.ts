import { parseAmountToCents } from '../money/cents'
import { detectDateFormat, parseDate } from './dates'
import type { MappingConfig, RawTable } from './types'
import type { SignConvention } from '../db/schema'

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
  dateFormat: string | null
  dateLike: number
  avgLen: number
}

function isAmountLike(cell: string): boolean {
  const v = cell.trim()
  if (!v || /[A-Za-z/]/.test(v)) return false
  return parseAmountToCents(v) !== null
}

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

export function detectMapping(table: RawTable): MappingConfig {
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

  // --- Amount columns: high amount-like rate, excluding the date column. ---
  const amountCols = stats.filter(
    (s) => s.index !== dateCol.index && rate(s.amountLike, s.nonEmpty) > 0.6,
  )

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
    // If the column reads like charges, positive likely means money out.
    if (hint(amountCols[0].header, /charge|debit|withdraw|spent/i)) {
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
