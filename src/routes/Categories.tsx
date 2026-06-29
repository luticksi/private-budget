import { useMemo, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Category, CategoryKind, RuleField, RuleMatch } from '../db/schema'
import { Page } from '../components/Page'
import { CategoryPicker } from '../components/CategoryPicker'
import { useCategoryGroups, useCategoryMap, categoryPath } from '../categorize/useCategories'

const inputCls =
  'rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

export function Categories() {
  return (
    <Page
      title="Categories & rules"
      description="Rules decide how transactions are auto-categorized. They run top to bottom by priority; the first match wins. Everything is local and editable."
    >
      <div className="space-y-8">
        <RulesSection />
        <CategoryTreeSection />
      </div>
    </Page>
  )
}

function RulesSection() {
  const map = useCategoryMap()
  const rules = useLiveQuery(
    () => db.rules.toArray().then((rs) => rs.sort((a, b) => b.priority - a.priority)),
    [],
  )
  const [search, setSearch] = useState('')
  const [pattern, setPattern] = useState('')
  const [field, setField] = useState<RuleField>('rawDescription')
  const [match, setMatch] = useState<RuleMatch>('contains')
  const [categoryId, setCategoryId] = useState<number | null>(null)

  const filtered = useMemo(
    () =>
      (rules ?? []).filter((r) =>
        search ? r.pattern.includes(search.toLowerCase()) : true,
      ),
    [rules, search],
  )

  async function addRule(e: FormEvent) {
    e.preventDefault()
    if (!pattern.trim() || categoryId == null) return
    await db.rules.add({
      field,
      match,
      pattern: match === 'regex' ? pattern.trim() : pattern.trim().toLowerCase(),
      categoryId,
      priority: 50, // user rules sit above built-ins, below learned
      source: 'user',
      enabled: true,
      createdAt: Date.now(),
    })
    setPattern('')
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Rules</h2>
        <input
          className={`${inputCls} w-56`}
          placeholder="Filter rules…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <form
        onSubmit={addRule}
        className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <input
          className={`${inputCls} flex-1`}
          placeholder="Text to match, e.g. STARBUCKS"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
        />
        <select className={inputCls} value={field} onChange={(e) => setField(e.target.value as RuleField)}>
          <option value="rawDescription">in description</option>
          <option value="normalizedMerchant">in merchant</option>
        </select>
        <select className={inputCls} value={match} onChange={(e) => setMatch(e.target.value as RuleMatch)}>
          <option value="contains">contains</option>
          <option value="startsWith">starts with</option>
          <option value="equals">equals</option>
          <option value="regex">regex</option>
        </select>
        <CategoryPicker value={categoryId} onChange={setCategoryId} allowParents />
        <button
          type="submit"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          Add rule
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Pattern</th>
              <th className="px-4 py-2 font-medium">Match</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.slice(0, 300).map((r) => (
              <tr key={r.id} className={r.enabled ? '' : 'opacity-40'}>
                <td className="px-4 py-2 font-mono text-xs">{r.pattern}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                  {r.match} · {r.field === 'rawDescription' ? 'desc' : 'merchant'}
                </td>
                <td className="px-4 py-2">{categoryPath(map, r.categoryId)}</td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {r.source}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => db.rules.update(r.id!, { enabled: !r.enabled })}
                    className="mr-3 text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
                  >
                    {r.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => db.rules.delete(r.id!)}
                    className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        {filtered.length} rule(s){search ? ' matching filter' : ''}.
      </p>
    </section>
  )
}

function CategoryTreeSection() {
  const groups = useCategoryGroups()
  const [newParent, setNewParent] = useState('')

  async function addChild(parent: Category, name: string) {
    if (!name.trim()) return
    // Children inherit their parent's kind so a whole group stays consistent.
    await db.categories.add({ name: name.trim(), parentId: parent.id!, kind: parent.kind, isSystem: false })
  }

  async function addParent(e: FormEvent) {
    e.preventDefault()
    if (!newParent.trim()) return
    await db.categories.add({ name: newParent.trim(), parentId: null, kind: 'expense', isSystem: false })
    setNewParent('')
  }

  // Setting a top-level category's kind applies to its children too, so reports
  // treat the group consistently (income, spending, or excluded transfers).
  async function setGroupKind(parent: Category, children: Category[], kind: CategoryKind) {
    const ids = [parent.id!, ...children.map((c) => c.id!)]
    await db.categories.where('id').anyOf(ids).modify({ kind })
  }

  async function removeCategory(id: number) {
    const childCount = await db.categories.where('parentId').equals(id).count()
    if (childCount > 0) {
      alert('Delete or move its sub-categories first.')
      return
    }
    if (!confirm('Delete this category? Transactions using it become uncategorized.')) return
    await db.transaction('rw', db.categories, db.transactions, db.rules, async () => {
      await db.transactions.where('categoryId').equals(id).modify({ categoryId: null })
      await db.rules.where('categoryId').equals(id).delete()
      await db.categories.delete(id)
    })
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Categories</h2>
      <form onSubmit={addParent} className="mb-4 flex gap-2">
        <input
          className={`${inputCls} w-64`}
          placeholder="New top-level category…"
          value={newParent}
          onChange={(e) => setNewParent(e.target.value)}
        />
        <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          Add
        </button>
      </form>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {groups.map(({ parent, children }) => (
          <div key={parent.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {parent.name}
                {parent.isSystem && (
                  <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">system</span>
                )}
              </h3>
              <label className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                counts as
                <select
                  className={`${inputCls} py-1`}
                  value={parent.kind}
                  onChange={(e) => setGroupKind(parent, children, e.target.value as CategoryKind)}
                >
                  <option value="expense">spending</option>
                  <option value="income">income</option>
                  <option value="transfer">transfer</option>
                </select>
              </label>
            </div>
            <ul className="space-y-1">
              {children.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{c.name}</span>
                  {!c.isSystem && (
                    <button
                      onClick={() => removeCategory(c.id!)}
                      className="text-xs text-red-500 hover:underline dark:text-red-400"
                    >
                      delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!parent.isSystem && <AddChild onAdd={(name) => addChild(parent, name)} />}
          </div>
        ))}
      </div>
    </section>
  )
}

function AddChild({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onAdd(name)
        setName('')
      }}
      className="mt-3 flex gap-2"
    >
      <input
        className={`${inputCls} flex-1`}
        placeholder="Add sub-category…"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
        Add
      </button>
    </form>
  )
}
