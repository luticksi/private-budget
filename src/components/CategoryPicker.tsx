import { useCategoryGroups } from '../categorize/useCategories'

/** A grouped <select> for choosing a (leaf) category, or "Uncategorized". */
export function CategoryPicker({
  value,
  onChange,
  allowParents = false,
}: {
  value: number | null
  onChange: (categoryId: number | null) => void
  allowParents?: boolean
}) {
  const groups = useCategoryGroups()

  return (
    <select
      className="max-w-[14rem] rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">Uncategorized</option>
      {groups.map(({ parent, children }) => (
        <optgroup key={parent.id} label={parent.name}>
          {allowParents && <option value={parent.id}>{parent.name} (all)</option>}
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
