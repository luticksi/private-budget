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

/**
 * Descriptions for the one thing that is unambiguously money *in* on a credit
 * card: paying the card off. Card issuers disagree about which sign a charge
 * carries (Amex and Discover list charges positive; Chase lists them negative),
 * so the file's own payment rows are the most reliable evidence available.
 */
const CARD_PAYMENT = /\bpayments?\b|autopay|thank\s*you|\bpmt\b|direct\s*debit/i

/**
 * Work out which sign means "money out" by reading the data rather than
 * assuming per-account-type. Returns null when the file offers no evidence.
 */
function inferSignFromData(
  table: RawTable,
  amountIndex: number,
  descIndex: number,
): SignConvention | null {
  let paymentPositive = 0
  let paymentNegative = 0
  let positive = 0
  let negative = 0

  for (const row of table.rows) {
    const cents = parseAmountToCents(row[amountIndex] ?? '')
    if (cents == null || cents === 0) continue
    if (cents > 0) positive++
    else negative++

    if (CARD_PAYMENT.test(row[descIndex] ?? '')) {
      if (cents > 0) paymentPositive++
      else paymentNegative++
    }
  }

  // Payments are inflows. If they're negative in the file, negative means
  // money in — so positive means money out.
  if (paymentPositive + paymentNegative > 0 && paymentPositive !== paymentNegative) {
    return paymentNegative > paymentPositive ? 'positiveIsOutflow' : 'negativeIsOutflow'
  }

  // Otherwise lean on the fact that a card statement is mostly charges.
  if (positive + negative >= 3 && positive !== negative) {
    return positive > negative ? 'positiveIsOutflow' : 'negativeIsOutflow'
  }

  return null
}

/**
 * Headers whose cells read as money. Used by the wizard to seed the debit and
 * credit selects with plausible columns instead of whatever came first.
 */
export function amountLikeHeaders(table: RawTable): string[] {
  return analyze(table).filter(isAmountColumn).map((s) => s.header)
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

  // --- Description: remaining column with the most text, header hint wins. ---
  // Resolved before the sign convention because payment rows are the strongest
  // evidence of which sign means "money out".
  const usedIndexes = new Set(
    [dateCol.index, ...amountCols.map((c) => c.index)].filter((i) => i != null),
  )
  const descCandidates = stats.filter((s) => !usedIndexes.has(s.index))
  const DESC_HINT = /desc|name|payee|memo|detail|merchant|narrative|transaction/i
  const descCol =
    [...descCandidates].sort(
      (a, b) =>
        Number(hint(b.header, DESC_HINT)) - Number(hint(a.header, DESC_HINT)) ||
        b.avgLen - a.avgLen,
    )[0] ??
    descCandidates[0] ??
    stats[0]

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
    // A column named for charges is money out when positive, whatever the file
    // otherwise looks like.
    if (hint(amountCols[0].header, /charge|debit|withdraw|spent/i)) {
      signConvention = 'positiveIsOutflow'
    } else if (opts?.accountType === 'credit') {
      // On a card, read the file's own rows: issuers disagree about the sign of
      // a charge, so guessing from the account type alone silently inverts
      // every amount for about half of them. Fall back to the standard
      // convention only when the data says nothing.
      signConvention =
        inferSignFromData(table, amountCols[0].index, descCol.index) ?? 'negativeIsOutflow'
    }
  }

  return {
    columnMap: { date: dateCol.header, description: descCol.header, amount, debit, credit },
    dateFormat: dateCol.dateFormat ?? 'YYYY-MM-DD',
    signConvention,
  }
}

export interface SignWarning {
  message: string
  /** The convention to switch to if the user accepts. */
  suggested: SignConvention
}

/**
 * Sanity-check the mapped result before it's committed. Detection can only ever
 * guess, and an inverted sign convention is invisible in a row count — it turns
 * a month of spending into a month of income. This gives the user a chance to
 * catch that in the preview.
 */
export function checkSignConvention(
  transactions: Array<{ amountCents: number; rawDescription: string }>,
  signConvention: SignConvention,
  accountType?: AccountType,
): SignWarning | null {
  // Separate debit/credit columns carry their own direction; nothing to flip.
  if (signConvention === 'separateColumns') return null
  if (transactions.length < 4) return null

  const flipped: SignConvention =
    signConvention === 'positiveIsOutflow' ? 'negativeIsOutflow' : 'positiveIsOutflow'

  // A card payment must come out as money in. If it didn't, the file is inverted.
  const payments = transactions.filter((t) => CARD_PAYMENT.test(t.rawDescription))
  if (accountType === 'credit' && payments.length) {
    const outflowPayments = payments.filter((t) => t.amountCents < 0).length
    if (outflowPayments > payments.length / 2) {
      return {
        message:
          'Payments to this card are showing as money out. The sign convention is probably inverted.',
        suggested: flipped,
      }
    }
  }

  const inflows = transactions.filter((t) => t.amountCents > 0).length
  const share = inflows / transactions.length
  // Statements are mostly spending. Near-total inflow means an inverted file
  // far more often than it means a genuine month of pure income.
  const threshold = accountType === 'credit' ? 0.7 : 0.9
  if (share > threshold) {
    return {
      message: `${inflows} of ${transactions.length} rows are money in. If that looks wrong, the sign convention is probably inverted.`,
      suggested: flipped,
    }
  }

  return null
}
