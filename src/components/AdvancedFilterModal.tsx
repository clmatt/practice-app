import { useState, useRef, useEffect } from 'react'
import { parseFilter, evaluateFilter } from '../filterParser'
import { getSavedFilters, upsertSavedFilter, deleteSavedFilter } from '../storage'
import { generateId } from '../utils'
import type { Item, SavedFilter } from '../types'

interface Props {
  activityId: string
  allTags: string[]
  items: Item[]
  initialExpression: string
  onApply: (expression: string | null) => void
  onClose: () => void
}

export default function AdvancedFilterModal({ activityId, allTags, items, initialExpression, onApply, onClose }: Props) {
  const [expression, setExpression] = useState(initialExpression)
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setSavedFilters(getSavedFilters(activityId))
  }, [activityId])

  const trimmed = expression.trim()
  const parseResult = trimmed ? parseFilter(trimmed) : null
  const isValid = parseResult !== null && typeof parseResult !== 'string'
  const matchCount = isValid ? items.filter(i => evaluateFilter(parseResult, i.tags ?? [])).length : 0
  const parseError = parseResult !== null && typeof parseResult === 'string' ? parseResult : null

  function insertSnippet(text: string) {
    const el = textareaRef.current
    const start = el?.selectionStart ?? expression.length
    const end = el?.selectionEnd ?? expression.length
    const next = expression.slice(0, start) + text + expression.slice(end)
    setExpression(next)
    setTimeout(() => {
      el?.focus()
      el?.setSelectionRange(start + text.length, start + text.length)
    }, 0)
  }

  function handleApply() {
    if (trimmed === '') {
      onApply(null)
    } else if (isValid) {
      onApply(trimmed)
    }
  }

  function handleSaveAs() {
    if (!isValid) return
    const name = window.prompt('Name this filter:')
    if (!name?.trim()) return
    const filter: SavedFilter = {
      id: generateId(),
      activityId,
      name: name.trim(),
      expression: trimmed,
      createdAt: new Date().toISOString(),
    }
    upsertSavedFilter(filter)
    setSavedFilters(getSavedFilters(activityId))
    onApply(trimmed)
  }

  function handleLoad(filter: SavedFilter) {
    setExpression(filter.expression)
    setExpandedId(null)
  }

  function handleRename(filter: SavedFilter) {
    const name = window.prompt('New name:', filter.name)
    if (!name?.trim()) return
    upsertSavedFilter({ ...filter, name: name.trim() })
    setSavedFilters(getSavedFilters(activityId))
    setExpandedId(null)
  }

  function handleDelete(filter: SavedFilter) {
    if (!window.confirm(`Delete "${filter.name}"?`)) return
    deleteSavedFilter(filter.id)
    setSavedFilters(getSavedFilters(activityId))
    setExpandedId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-t-2xl p-4 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg">Advanced Filter</h2>
          <button onClick={onClose} className="text-slate-400 text-sm">Cancel</button>
        </div>

        {savedFilters.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Saved Filters</p>
            {savedFilters.map(f => (
              <div key={f.id} className="bg-slate-800 rounded-xl overflow-hidden">
                <div className="flex items-center px-3 py-2.5">
                  <button className="flex-1 text-left min-w-0" onClick={() => handleLoad(f)}>
                    <p className="text-sm text-slate-100 font-medium">{f.name}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">{f.expression}</p>
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                    className="text-slate-400 px-2 py-1 text-base leading-none shrink-0"
                  >
                    ···
                  </button>
                </div>
                {expandedId === f.id && (
                  <div className="flex border-t border-slate-700">
                    <button
                      onClick={() => handleRename(f)}
                      className="flex-1 py-2 text-sm text-slate-300 hover:bg-slate-700"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(f)}
                      className="flex-1 py-2 text-sm text-red-400 hover:bg-slate-700 border-l border-slate-700"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Expression</p>
          <textarea
            ref={textareaRef}
            value={expression}
            onChange={e => setExpression(e.target.value)}
            rows={3}
            placeholder={'"tag1" && ("tag2" || "tag3")'}
            className="bg-slate-800 rounded-xl px-4 py-3 text-sm font-mono w-full outline-none resize-none text-slate-100 placeholder:text-slate-600 border border-transparent focus:border-violet-600"
          />
          {trimmed && (
            isValid
              ? <p className="text-xs text-green-400">● {matchCount} {matchCount === 1 ? 'item' : 'items'} match</p>
              : <p className="text-xs text-red-400">{parseError}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Operators</p>
          <div className="flex gap-2">
            {(['&&', '||', '!', '(', ')'] as const).map(op => (
              <button
                key={op}
                onClick={() => insertSnippet(op === '&&' ? ' && ' : op === '||' ? ' || ' : op)}
                className="bg-slate-900 border border-slate-600 hover:border-violet-500 text-slate-300 hover:text-violet-400 rounded-lg px-3 py-1 text-xs font-mono transition-colors"
              >
                {op}
              </button>
            ))}
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Tap to insert tag</p>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => insertSnippet(`"${tag}"`)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full px-3 py-1 text-xs font-medium"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleApply}
            disabled={trimmed !== '' && !isValid}
            className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl py-3 font-semibold text-sm"
          >
            {trimmed === '' ? 'Clear Filter' : 'Apply'}
          </button>
          <button
            onClick={handleSaveAs}
            disabled={!isValid}
            className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-violet-600 text-violet-400 rounded-xl py-3 font-semibold text-sm"
          >
            Save As…
          </button>
        </div>
      </div>
    </div>
  )
}
