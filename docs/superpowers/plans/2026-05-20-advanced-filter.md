# Advanced Filter for Auto Practice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add boolean tag-expression filtering (`&&`, `||`, `!`, parentheses) to the Auto Practice session screen, with per-activity saved filters that can be named, loaded, renamed, and deleted.

**Architecture:** A new `src/filterParser.ts` module handles expression parsing (recursive descent) and evaluation independently of UI. A new `AdvancedFilterModal` component houses the full filter UX (expression editor, saved filters, tag chips). `PracticeSessionScreen` grows an `advancedFilter` state string that, when set, replaces the simple tag-toggle logic and UI.

**Tech Stack:** React, TypeScript, Tailwind CSS, localStorage (via existing `load`/`save` helpers in `storage.ts`), Vitest for tests.

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify | `src/types.ts` | Add `SavedFilter` interface |
| Modify | `src/storage.ts` | Add `savedFilters` CRUD functions + `deleteActivity` cleanup |
| Create | `src/filterParser.ts` | Tokenizer, recursive descent parser, evaluator |
| Create | `src/tests/filterParser.test.ts` | Unit tests for parser + evaluator |
| Modify | `src/tests/storage.test.ts` | Tests for saved filter CRUD |
| Modify | `src/screens/AddEditItemScreen.tsx` | Strip `"` from tag names on add |
| Create | `src/components/AdvancedFilterModal.tsx` | Bottom sheet modal component |
| Modify | `src/screens/PracticeSessionScreen.tsx` | Wire in advanced filter state, modal, updated filter logic |

---

## Task 1: Add SavedFilter type

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add `SavedFilter` to `src/types.ts`**

Append after the `PracticeLog` interface (after line 28):

```typescript
export interface SavedFilter {
  id: string
  activityId: string
  name: string
  expression: string
  createdAt: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add SavedFilter type"
```

---

## Task 2: Add saved filter storage functions

**Files:**
- Modify: `src/storage.ts`
- Modify: `src/tests/storage.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/tests/storage.test.ts` (after the existing imports, add `SavedFilter` to the import from `../types`, and add `getSavedFilters`, `upsertSavedFilter`, `deleteSavedFilter` to the import from `../storage`):

```typescript
import {
  getActivities, saveActivity, deleteActivity,
  getItems, saveItem, deleteItem, deleteItemWithLogs,
  getLogs, appendLog, getTodayPracticedItemIds,
  getSessionHistory,
  getSavedFilters, upsertSavedFilter, deleteSavedFilter,
} from '../storage'
import type { Activity, Item, PracticeLog, SavedFilter } from '../types'
```

Then append at the end of the file:

```typescript
const makeSavedFilter = (overrides: Partial<SavedFilter> = {}): SavedFilter => ({
  id: 'sf-1',
  activityId: 'act-1',
  name: 'Test Filter',
  expression: '"good" && "V2"',
  createdAt: new Date().toISOString(),
  ...overrides,
})

describe('savedFilters', () => {
  it('returns empty array when nothing stored', () => {
    expect(getSavedFilters('act-1')).toEqual([])
  })

  it('saves and retrieves a filter', () => {
    const f = makeSavedFilter()
    upsertSavedFilter(f)
    expect(getSavedFilters('act-1')).toEqual([f])
  })

  it('scopes filters by activityId', () => {
    upsertSavedFilter(makeSavedFilter({ activityId: 'act-1' }))
    upsertSavedFilter(makeSavedFilter({ id: 'sf-2', activityId: 'act-2' }))
    expect(getSavedFilters('act-1')).toHaveLength(1)
    expect(getSavedFilters('act-2')).toHaveLength(1)
  })

  it('updates an existing filter on upsert', () => {
    const f = makeSavedFilter()
    upsertSavedFilter(f)
    upsertSavedFilter({ ...f, name: 'Renamed' })
    const result = getSavedFilters('act-1')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Renamed')
  })

  it('deletes a filter by id', () => {
    const f = makeSavedFilter()
    upsertSavedFilter(f)
    deleteSavedFilter(f.id)
    expect(getSavedFilters('act-1')).toEqual([])
  })

  it('deleteActivity also removes its saved filters', () => {
    const activity = makeActivity()
    saveActivity(activity)
    upsertSavedFilter(makeSavedFilter({ activityId: 'act-1' }))
    deleteActivity('act-1')
    expect(getSavedFilters('act-1')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/tests/storage.test.ts
```

Expected: FAIL — `getSavedFilters is not a function` (or similar)

- [ ] **Step 3: Implement saved filter CRUD in `src/storage.ts`**

Add `savedFilters` to the `KEYS` object:

```typescript
const KEYS = {
  activities: 'practice:activities',
  items: 'practice:items',
  logs: 'practice:logs',
  savedFilters: 'practice:saved-filters',
}
```

Add the import for `SavedFilter` at the top:

```typescript
import type { Activity, Item, PracticeLog, Color, SessionSummary, SavedFilter } from './types'
```

Also add `SavedFilter` to the re-export line:

```typescript
export type { SessionSummary, SavedFilter } from './types'
```

Add CRUD functions at the end of the file (before the last closing):

```typescript
// --- Saved Filters ---

export function getSavedFilters(activityId: string): SavedFilter[] {
  return load<SavedFilter>(KEYS.savedFilters).filter(f => f.activityId === activityId)
}

export function upsertSavedFilter(filter: SavedFilter): void {
  const all = load<SavedFilter>(KEYS.savedFilters)
  const idx = all.findIndex(f => f.id === filter.id)
  if (idx >= 0) all[idx] = filter
  else all.push(filter)
  save(KEYS.savedFilters, all)
}

export function deleteSavedFilter(id: string): void {
  save(KEYS.savedFilters, load<SavedFilter>(KEYS.savedFilters).filter(f => f.id !== id))
}
```

Update `deleteActivity` to also remove saved filters. Replace the existing `deleteActivity` function:

```typescript
export function deleteActivity(id: string): void {
  save(KEYS.activities, getActivities().filter(a => a.id !== id))
  const allItems = load<Item>(KEYS.items)
  const deletedItemIds = new Set(allItems.filter(i => i.activityId === id).map(i => i.id))
  save(KEYS.items, allItems.filter(i => !deletedItemIds.has(i.id)))
  save(KEYS.logs, load<PracticeLog>(KEYS.logs).filter(l => !deletedItemIds.has(l.itemId)))
  save(KEYS.savedFilters, load<SavedFilter>(KEYS.savedFilters).filter(f => f.activityId !== id))
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/tests/storage.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage.ts src/tests/storage.test.ts
git commit -m "feat: add saved filter CRUD to storage"
```

---

## Task 3: Build the expression parser

**Files:**
- Create: `src/filterParser.ts`
- Create: `src/tests/filterParser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/filterParser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseFilter, evaluateFilter } from '../filterParser'
import type { FilterNode } from '../filterParser'

describe('parseFilter', () => {
  it('parses a single quoted tag', () => {
    const result = parseFilter('"good"')
    expect(result).toEqual({ type: 'tag', value: 'good' })
  })

  it('parses AND of two tags', () => {
    const result = parseFilter('"good" && "V2"')
    expect(result).toEqual({
      type: 'and',
      left: { type: 'tag', value: 'good' },
      right: { type: 'tag', value: 'V2' },
    })
  })

  it('parses OR of two tags', () => {
    const result = parseFilter('"V2" || "V3"')
    expect(result).toEqual({
      type: 'or',
      left: { type: 'tag', value: 'V2' },
      right: { type: 'tag', value: 'V3' },
    })
  })

  it('parses NOT of a tag', () => {
    const result = parseFilter('!"bad"')
    expect(result).toEqual({
      type: 'not',
      operand: { type: 'tag', value: 'bad' },
    })
  })

  it('parses complex grouped expression', () => {
    const result = parseFilter('"good" && ("V2" || "V3" || "V4")')
    expect(typeof result).not.toBe('string')
    expect((result as FilterNode).type).toBe('and')
  })

  it('returns error string for empty expression', () => {
    expect(typeof parseFilter('')).toBe('string')
    expect(typeof parseFilter('   ')).toBe('string')
  })

  it('returns error string for unterminated string literal', () => {
    expect(typeof parseFilter('"good')).toBe('string')
  })

  it('returns error string for unexpected character', () => {
    expect(typeof parseFilter('"good" & "V2"')).toBe('string')
  })

  it('returns error string for unmatched open paren', () => {
    expect(typeof parseFilter('("good" && "V2"')).toBe('string')
  })

  it('returns error string for trailing content', () => {
    expect(typeof parseFilter('"good" "V2"')).toBe('string')
  })
})

describe('evaluateFilter', () => {
  it('matches a single tag present in the list', () => {
    const ast = parseFilter('"good"') as FilterNode
    expect(evaluateFilter(ast, ['good', 'V2'])).toBe(true)
    expect(evaluateFilter(ast, ['V2'])).toBe(false)
    expect(evaluateFilter(ast, [])).toBe(false)
  })

  it('AND requires both tags present', () => {
    const ast = parseFilter('"good" && "V2"') as FilterNode
    expect(evaluateFilter(ast, ['good', 'V2'])).toBe(true)
    expect(evaluateFilter(ast, ['good'])).toBe(false)
    expect(evaluateFilter(ast, ['V2'])).toBe(false)
  })

  it('OR requires at least one tag present', () => {
    const ast = parseFilter('"V2" || "V3"') as FilterNode
    expect(evaluateFilter(ast, ['V2'])).toBe(true)
    expect(evaluateFilter(ast, ['V3'])).toBe(true)
    expect(evaluateFilter(ast, ['V2', 'V3'])).toBe(true)
    expect(evaluateFilter(ast, ['V4'])).toBe(false)
  })

  it('NOT inverts the match', () => {
    const ast = parseFilter('!"bad"') as FilterNode
    expect(evaluateFilter(ast, ['good'])).toBe(true)
    expect(evaluateFilter(ast, ['bad'])).toBe(false)
    expect(evaluateFilter(ast, [])).toBe(true)
  })

  it('complex: "good" && ("V2" || "V3" || "V4")', () => {
    const ast = parseFilter('"good" && ("V2" || "V3" || "V4")') as FilterNode
    expect(evaluateFilter(ast, ['good', 'V2'])).toBe(true)
    expect(evaluateFilter(ast, ['good', 'V3'])).toBe(true)
    expect(evaluateFilter(ast, ['good', 'V4'])).toBe(true)
    expect(evaluateFilter(ast, ['good', 'V5'])).toBe(false)
    expect(evaluateFilter(ast, ['V2'])).toBe(false)
  })

  it('tag matching is case-sensitive', () => {
    const ast = parseFilter('"Good"') as FilterNode
    expect(evaluateFilter(ast, ['Good'])).toBe(true)
    expect(evaluateFilter(ast, ['good'])).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/tests/filterParser.test.ts
```

Expected: FAIL — `Cannot find module '../filterParser'`

- [ ] **Step 3: Implement `src/filterParser.ts`**

Create the file:

```typescript
export type FilterNode =
  | { type: 'tag'; value: string }
  | { type: 'and'; left: FilterNode; right: FilterNode }
  | { type: 'or'; left: FilterNode; right: FilterNode }
  | { type: 'not'; operand: FilterNode }

type Token =
  | { type: 'STRING'; value: string }
  | { type: 'AND' }
  | { type: 'OR' }
  | { type: 'NOT' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' }
  | { type: 'EOF' }

function tokenize(input: string): Token[] | string {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
    } else if (ch === '"') {
      i++
      let value = ''
      while (i < input.length && input[i] !== '"') {
        value += input[i++]
      }
      if (i >= input.length) return 'Unterminated string literal'
      i++ // consume closing "
      tokens.push({ type: 'STRING', value })
    } else if (ch === '&' && input[i + 1] === '&') {
      tokens.push({ type: 'AND' })
      i += 2
    } else if (ch === '|' && input[i + 1] === '|') {
      tokens.push({ type: 'OR' })
      i += 2
    } else if (ch === '!') {
      tokens.push({ type: 'NOT' })
      i++
    } else if (ch === '(') {
      tokens.push({ type: 'LPAREN' })
      i++
    } else if (ch === ')') {
      tokens.push({ type: 'RPAREN' })
      i++
    } else {
      return `Unexpected character: "${ch}"`
    }
  }
  tokens.push({ type: 'EOF' })
  return tokens
}

class Parser {
  private pos = 0
  constructor(private tokens: Token[]) {}

  private peek(): Token { return this.tokens[this.pos] }
  private consume(): Token { return this.tokens[this.pos++] }

  parse(): FilterNode | string {
    const result = this.parseOr()
    if (typeof result === 'string') return result
    if (this.peek().type !== 'EOF') return 'Unexpected token after expression'
    return result
  }

  private parseOr(): FilterNode | string {
    let left = this.parseAnd()
    if (typeof left === 'string') return left
    while (this.peek().type === 'OR') {
      this.consume()
      const right = this.parseAnd()
      if (typeof right === 'string') return right
      left = { type: 'or', left, right }
    }
    return left
  }

  private parseAnd(): FilterNode | string {
    let left = this.parseNot()
    if (typeof left === 'string') return left
    while (this.peek().type === 'AND') {
      this.consume()
      const right = this.parseNot()
      if (typeof right === 'string') return right
      left = { type: 'and', left, right }
    }
    return left
  }

  private parseNot(): FilterNode | string {
    if (this.peek().type === 'NOT') {
      this.consume()
      const operand = this.parsePrimary()
      if (typeof operand === 'string') return operand
      return { type: 'not', operand }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): FilterNode | string {
    const token = this.peek()
    if (token.type === 'STRING') {
      this.consume()
      return { type: 'tag', value: token.value }
    }
    if (token.type === 'LPAREN') {
      this.consume()
      const inner = this.parseOr()
      if (typeof inner === 'string') return inner
      if (this.peek().type !== 'RPAREN') return 'Expected closing parenthesis'
      this.consume()
      return inner
    }
    if (token.type === 'EOF') return 'Unexpected end of expression'
    return `Unexpected token`
  }
}

export function parseFilter(expression: string): FilterNode | string {
  const trimmed = expression.trim()
  if (!trimmed) return 'Expression is empty'
  const tokens = tokenize(trimmed)
  if (typeof tokens === 'string') return tokens
  return new Parser(tokens).parse()
}

export function evaluateFilter(node: FilterNode, tags: string[]): boolean {
  switch (node.type) {
    case 'tag': return tags.includes(node.value)
    case 'and': return evaluateFilter(node.left, tags) && evaluateFilter(node.right, tags)
    case 'or': return evaluateFilter(node.left, tags) || evaluateFilter(node.right, tags)
    case 'not': return !evaluateFilter(node.operand, tags)
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/tests/filterParser.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/filterParser.ts src/tests/filterParser.test.ts
git commit -m "feat: add boolean tag expression parser and evaluator"
```

---

## Task 4: Sanitize quotes from tag names

**Files:**
- Modify: `src/screens/AddEditItemScreen.tsx`

- [ ] **Step 1: Strip `"` in the `addTag` function**

Find the `addTag` function in `src/screens/AddEditItemScreen.tsx` (around line 93) and replace it:

```typescript
function addTag() {
  const trimmed = tagInput.trim().replace(/"/g, '')
  if (trimmed && !tags.includes(trimmed)) {
    setTags([...tags, trimmed].sort())
  }
  setTagInput('')
  setTagInputKey(k => k + 1)
}
```

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

```bash
npm test
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/screens/AddEditItemScreen.tsx
git commit -m "fix: strip double-quotes from tag names to keep them filter-safe"
```

---

## Task 5: Build AdvancedFilterModal component

**Files:**
- Create: `src/components/AdvancedFilterModal.tsx`

- [ ] **Step 1: Create `src/components/AdvancedFilterModal.tsx`**

```typescript
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

  function insertTag(tag: string) {
    const el = textareaRef.current
    const start = el?.selectionStart ?? expression.length
    const end = el?.selectionEnd ?? expression.length
    const snippet = `"${tag}"`
    const next = expression.slice(0, start) + snippet + expression.slice(end)
    setExpression(next)
    setTimeout(() => {
      el?.focus()
      el?.setSelectionRange(start + snippet.length, start + snippet.length)
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

        {allTags.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Tap to insert tag</p>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => insertTag(tag)}
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
```

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

```bash
npm test
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/AdvancedFilterModal.tsx
git commit -m "feat: add AdvancedFilterModal component"
```

---

## Task 6: Wire advanced filter into PracticeSessionScreen

**Files:**
- Modify: `src/screens/PracticeSessionScreen.tsx`

- [ ] **Step 1: Update imports**

Replace the existing import block at the top of `src/screens/PracticeSessionScreen.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getActivities, getItems, saveItem, appendLog, getTodayPracticedItemIds, getLastPracticedByItem, getNotesForItem } from '../storage'
import { selectItem } from '../selection'
import { generateId } from '../utils'
import type { Activity, Item, Color } from '../types'
import ColorDot from '../components/ColorDot'
import ColorPicker from '../components/ColorPicker'
import AdvancedFilterModal from '../components/AdvancedFilterModal'
import { parseFilter, evaluateFilter } from '../filterParser'
```

- [ ] **Step 2: Add `advancedFilter` and `showFilterModal` state**

Inside `PracticeSessionScreen`, after the existing state declarations (after line 27 — after `const [noteText, ...]`), add:

```typescript
const [advancedFilter, setAdvancedFilter] = useState<string | null>(null)
const [showFilterModal, setShowFilterModal] = useState(false)
```

- [ ] **Step 3: Update `drawNextItem` to handle advanced filter**

Replace the entire `drawNextItem` callback (lines 54–85) with:

```typescript
const drawNextItem = useCallback((skipped: Set<string> = skippedItemIds) => {
  if (!activity || !activityId) return
  const freshItems = getItems(activityId)
  setItems(freshItems)
  const todayPracticed = getTodayPracticedItemIds(activityId)
  const excluded = new Set([...todayPracticed, ...skipped])
  const lastPracticedAt = getLastPracticedByItem(activityId)
  const recencyBias = activity.recencyBias ?? 0.9

  let filtered: Item[]
  if (advancedFilter) {
    const ast = parseFilter(advancedFilter)
    filtered = typeof ast === 'string' ? [] : freshItems.filter(i => evaluateFilter(ast, i.tags ?? []))
  } else {
    filtered = activeTags.size === 0
      ? freshItems
      : freshItems.filter(i => (i.tags ?? []).some(t => activeTags.has(t)))
  }

  const next = selectItem(filtered, excluded, activity.weights, recencyBias, lastPracticedAt)
  if (next === null) {
    if (activeTags.size > 0 || advancedFilter) {
      const nextUnfiltered = selectItem(freshItems, excluded, activity.weights, recencyBias, lastPracticedAt)
      if (nextUnfiltered !== null) {
        setFilterExhausted(true)
        setPhase('done')
        setCurrentItem(null)
        return
      }
    }
    setFilterExhausted(false)
    setPhase('done')
    setCurrentItem(null)
  } else {
    setCurrentItem(next)
    setPhase('draw')
    setRevealed(false)
    setSelectedColor(null)
  }
}, [activity, activityId, activeTags, skippedItemIds, advancedFilter])
```

- [ ] **Step 4: Update `sessionTotal` to account for advanced filter**

Replace the existing `sessionTotal` line (line 157) with:

```typescript
const sessionTotal = (() => {
  if (advancedFilter) {
    const ast = parseFilter(advancedFilter)
    return typeof ast === 'string' ? 0 : items.filter(i => evaluateFilter(ast, i.tags ?? [])).length
  }
  return activeTags.size === 0
    ? items.length
    : items.filter(i => (i.tags ?? []).some(t => activeTags.has(t))).length
})()
```

- [ ] **Step 5: Update the setup phase JSX**

Replace the entire `{/* Phase: setup */}` block (lines 177–207) with:

```tsx
{/* Phase: setup */}
{phase === 'setup' && (
  <div className="flex flex-col flex-1 gap-6">
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center gap-4">
      <h2 className="text-xl font-bold">What are you focusing on?</h2>
      {advancedFilter ? (
        <>
          <p className="text-slate-400 text-sm">Advanced filter active.</p>
          <button
            onClick={() => setShowFilterModal(true)}
            className="flex items-center justify-between bg-slate-800 border border-violet-600 rounded-xl px-4 py-3 w-full"
          >
            <span className="text-violet-400 text-sm font-mono text-left truncate">⚡ {advancedFilter}</span>
            <span className="text-slate-400 text-xs ml-2 shrink-0">edit</span>
          </button>
        </>
      ) : (
        <>
          <p className="text-slate-400 text-sm">Select tags to filter, or start with everything.</p>
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  activeTags.has(tag)
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
    <div className="flex flex-col gap-3">
      {!advancedFilter && (
        <button
          onClick={() => setShowFilterModal(true)}
          className="bg-transparent border border-slate-600 hover:border-violet-500 text-slate-400 hover:text-violet-400 rounded-xl py-3 text-sm w-full transition-colors"
        >
          ⚡ Advanced Filter
        </button>
      )}
      <button
        onClick={() => drawNextItem()}
        className="bg-violet-600 hover:bg-violet-500 rounded-xl py-4 font-bold text-lg w-full"
      >
        {advancedFilter ? 'Start with filter' : activeTags.size > 0 ? 'Start with selected' : 'Start — practice all'}
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 6: Update the filter-exhausted done screen**

Replace the filter-exhausted section's tag display (inside `{/* Phase: done — filter exhausted */}`, lines 217–226 — the `{activeTags.size > 0 && ...}` block) with:

```tsx
{advancedFilter ? (
  <p className="text-xs text-slate-400 font-mono bg-slate-800 px-3 py-2 rounded-lg">{advancedFilter}</p>
) : activeTags.size > 0 && (
  <div className="flex flex-wrap gap-2 justify-center">
    {[...activeTags].map(tag => (
      <span
        key={tag}
        className="bg-slate-700 rounded-full px-3 py-1 text-xs text-slate-300"
      >
        {tag}
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 7: Replace tag pill rows in draw and rate phases with expression badge when advanced filter is active**

In the `{/* Phase: draw */}` block, find the tag pill section (lines 289–305):

```tsx
{allTags.length > 0 && (
  <div className="flex gap-2 mb-2 overflow-x-auto w-full pb-1">
    {allTags.map(tag => (
      <button
        key={tag}
        onClick={() => toggleTag(tag)}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          activeTags.has(tag)
            ? 'bg-violet-600 text-white'
            : 'bg-slate-700 text-slate-300'
        }`}
      >
        {tag}
      </button>
    ))}
  </div>
)}
```

Replace it with:

```tsx
{advancedFilter ? (
  <button
    onClick={() => setShowFilterModal(true)}
    className="flex items-center justify-between bg-slate-800 border border-violet-600 rounded-xl px-3 py-2 w-full mb-2"
  >
    <span className="text-violet-400 text-xs font-mono text-left truncate">⚡ {advancedFilter}</span>
    <span className="text-slate-400 text-xs ml-2 shrink-0">edit</span>
  </button>
) : allTags.length > 0 && (
  <div className="flex gap-2 mb-2 overflow-x-auto w-full pb-1">
    {allTags.map(tag => (
      <button
        key={tag}
        onClick={() => toggleTag(tag)}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          activeTags.has(tag)
            ? 'bg-violet-600 text-white'
            : 'bg-slate-700 text-slate-300'
        }`}
      >
        {tag}
      </button>
    ))}
  </div>
)}
```

In the `{/* Phase: rate */}` block, find the identical tag pill section (lines 356–371) and apply the same replacement.

- [ ] **Step 8: Add the modal to the return JSX and the `handleApply` callback**

Just before the closing `</div>` of the top-level return (after all phase blocks), add:

```tsx
{showFilterModal && (
  <AdvancedFilterModal
    activityId={activityId!}
    allTags={allTags}
    items={items}
    initialExpression={advancedFilter ?? ''}
    onApply={expr => {
      setAdvancedFilter(expr)
      setShowFilterModal(false)
    }}
    onClose={() => setShowFilterModal(false)}
  />
)}
```

- [ ] **Step 9: Run the full test suite**

```bash
npm test
```

Expected: all PASS

- [ ] **Step 10: Commit**

```bash
git add src/screens/PracticeSessionScreen.tsx
git commit -m "feat: wire advanced filter into Auto Practice session screen"
```

---

## Task 7: Push

- [ ] **Step 1: Push to remote**

```bash
git push
```
