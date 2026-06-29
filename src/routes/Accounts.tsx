import { useState, type FormEvent, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { AccountType } from '../db/schema'
import { Page, EmptyState } from '../components/Page'

const TYPES: AccountType[] = ['checking', 'savings', 'credit', 'cash', 'other']
const inputCls =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

export function Accounts() {
  const accounts = useLiveQuery(() => db.accounts.orderBy('name').toArray(), [])
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [institution, setInstitution] = useState('')
  const [currency, setCurrency] = useState('USD')

  async function addAccount(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await db.accounts.add({
      name: name.trim(),
      type,
      institution: institution.trim() || undefined,
      currency: currency.trim().toUpperCase() || 'USD',
      createdAt: Date.now(),
    })
    setName('')
    setInstitution('')
  }

  async function remove(id: number) {
    const count = await db.transactions.where('accountId').equals(id).count()
    const msg = count
      ? `Delete this account and its ${count} transaction(s)? This cannot be undone.`
      : 'Delete this account?'
    if (!confirm(msg)) return
    await db.transaction('rw', db.accounts, db.transactions, async () => {
      await db.transactions.where('accountId').equals(id).delete()
      await db.accounts.delete(id)
    })
  }

  return (
    <Page
      title="Accounts"
      description="The bank and credit-card accounts you import statements from."
    >
      <form
        onSubmit={addAccount}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <Field label="Name">
          <input
            className={inputCls}
            placeholder="e.g. Chase Checking"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Type">
          <select
            className={inputCls}
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Institution">
          <input
            className={inputCls}
            placeholder="optional"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          />
        </Field>
        <Field label="Currency">
          <input
            className={`${inputCls} w-24`}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
        </Field>
        <button
          type="submit"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          Add account
        </button>
      </form>

      {!accounts?.length ? (
        <EmptyState>No accounts yet. Add one above to get started.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">{a.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {a.type}
                  {a.institution ? ` · ${a.institution}` : ''} · {a.currency}
                </div>
              </div>
              <button
                onClick={() => remove(a.id!)}
                className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  )
}
