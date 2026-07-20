/**
 * The secondary line shown beneath a transaction's merchant/description: the
 * check number and the bank's memo/type. The memo is only shown when it adds
 * something the primary line doesn't — when the description was blank it was
 * already folded into `rawDescription`, so repeating it here would be noise.
 */
export function transactionDetail(t: {
  rawDescription: string
  memo?: string | null
  checkNumber?: string | null
}): string {
  const parts: string[] = []
  if (t.checkNumber) parts.push(`Check #${t.checkNumber}`)
  if (t.memo && t.memo !== t.rawDescription) parts.push(t.memo)
  return parts.join(' · ')
}
