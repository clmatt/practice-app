# Item Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional session notes to practice logs — writable in the rate phase of both practice screens, readable in the draw phase and on the item detail screen.

**Architecture:** `note?: string` is added to `PracticeLog` (no new storage key). A new `getNotesForItem` helper filters and sorts logs by note presence. UI changes are additive: textarea in rate phase, read-only list in draw phase and `ItemProgressScreen`.

**Tech Stack:** React, TypeScript, Vitest, Tailwind CSS, localStorage

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/types.ts` | Add `note?: string` to `PracticeLog` |
| Modify | `src/storage.ts` | Add `getNotesForItem` helper |
| Create | `src/tests/notes.test.ts` | Tests for `getNotesForItem` |
| Modify | `src/screens/PracticeSessionScreen.tsx` | Draw phase notes display + rate phase textarea |
| Modify | `src/screens/ManualPracticeScreen.tsx` | Rate phase textarea + save wiring |
| Modify | `src/screens/ItemProgressScreen.tsx` | Notes section below color run chart |

---

## Task 1: Data layer — PracticeLog type + getNotesForItem

**Files:**
- Modify: `src/types.ts`
- Modify: `src/storage.ts`
- Create: `src/tests/notes.test.ts`

- [ ] **Step 1: Write failing tests for getNotesForItem**

Create `src/tests/notes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getNotesForItem, appendLog } from '../storage'
import type { PracticeLog } from '../types'

const makeLog = (overrides: Partial<PracticeLog> = {}): PracticeLog => ({
  id: 'log-1',
  itemId: 'item-1',
  practicedAt: '2026-01-01T10:00:00.000Z',
  colorBefore: 'red',
  colorAfter: 'yellow',
  ...overrides,
})

describe('getNotesForItem', () => {
  it('returns empty array when no logs exist', () => {
    expect(getNotesForItem('item-1')).toEqual([])
  })

  it('returns empty array when logs have no notes', () => {
    appendLog(makeLog({ id: 'log-1' }))
    expect(getNotesForItem('item-1')).toEqual([])
  })

  it('returns only logs with notes for the given item', () => {
    appendLog(makeLog({ id: 'log-1', note: 'Good session' }))
    appendLog(makeLog({ id: 'log-2', itemId: 'item-2', note: 'Other item' }))
    const notes = getNotesForItem('item-1')
    expect(notes).toHaveLength(1)
    expect(notes[0].note).toBe('Good session')
  })

  it('sorts notes newest-first by practicedAt', () => {
    appendLog(makeLog({ id: 'log-1', practicedAt: '2026-01-01T10:00:00.000Z', note: 'First' }))
    appendLog(makeLog({ id: 'log-2', practicedAt: '2026-01-02T10:00:00.000Z', note: 'Second' }))
    const notes = getNotesForItem('item-1')
    expect(notes[0].note).toBe('Second')
    expect(notes[1].note).toBe('First')
  })

  it('excludes logs with empty string notes', () => {
    appendLog(makeLog({ id: 'log-1', note: '' }))
    expect(getNotesForItem('item-1')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npm test src/tests/notes.test.ts
```

Expected: FAIL — `getNotesForItem` is not exported from `../storage`

- [ ] **Step 3: Add `note?: string` to PracticeLog in types.ts**

In `src/types.ts`, find:

```ts
export interface PracticeLog {
  id: string
  itemId: string
  practicedAt: string
  colorBefore: Color
  colorAfter: Color
}
```

Replace with:

```ts
export interface PracticeLog {
  id: string
  itemId: string
  practicedAt: string
  colorBefore: Color
  colorAfter: Color
  note?: string
}
```

- [ ] **Step 4: Add getNotesForItem to storage.ts**

In `src/storage.ts`, after the `getLastPracticedByItem` function, add:

```ts
export function getNotesForItem(itemId: string): { practicedAt: string; note: string }[] {
  return getLogs()
    .filter(l => l.itemId === itemId && !!l.note)
    .map(l => ({ practicedAt: l.practicedAt, note: l.note! }))
    .sort((a, b) => b.practicedAt.localeCompare(a.practicedAt))
}
```

- [ ] **Step 5: Run tests — expect them to pass**

```bash
npm test src/tests/notes.test.ts
```

Expected: 5/5 PASS

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/storage.ts src/tests/notes.test.ts
git commit -m "feat: add note field to PracticeLog and getNotesForItem helper"
```

---

## Task 2: PracticeSessionScreen — draw phase display + rate phase input

**Files:**
- Modify: `src/screens/PracticeSessionScreen.tsx`

### What changes

1. Import `getNotesForItem` from storage
2. Add `noteText` state (`string`, default `''`)
3. Add `formatNoteDate` helper function
4. Derive `pastNotes` from `currentItem` before the return
5. Update `handleSave` to include note and reset `noteText`
6. Update `handleBackToDraw` to reset `noteText`
7. Add past notes display in draw phase JSX (below color reveal)
8. Add textarea in rate phase JSX (between ColorPicker and Save)

- [ ] **Step 1: Update the import line**

In `src/screens/PracticeSessionScreen.tsx`, find:

```tsx
import { getActivities, getItems, saveItem, appendLog, getTodayPracticedItemIds, getLastPracticedByItem } from '../storage'
```

Replace with:

```tsx
import { getActivities, getItems, saveItem, appendLog, getTodayPracticedItemIds, getLastPracticedByItem, getNotesForItem } from '../storage'
```

- [ ] **Step 2: Add noteText state**

Find the last `useState` line in the state declarations (around line 26):

```tsx
const [skippedItemIds, setSkippedItemIds] = useState<Set<string>>(new Set())
```

Add immediately after:

```tsx
const [noteText, setNoteText] = useState('')
```

- [ ] **Step 3: Add formatNoteDate helper**

Find the `toggleTag` function (around line 93):

```tsx
function toggleTag(tag: string) {
```

Add immediately before it:

```tsx
function formatNoteDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

```

- [ ] **Step 4: Derive pastNotes before the return**

Find:

```tsx
  if (!activity) return null

  const sessionTotal = (activeTags.size === 0 ? items : items.filter(i => (i.tags ?? []).some(t => activeTags.has(t)))).length
```

Replace with:

```tsx
  if (!activity) return null

  const pastNotes = currentItem ? getNotesForItem(currentItem.id) : []
  const sessionTotal = (activeTags.size === 0 ? items : items.filter(i => (i.tags ?? []).some(t => activeTags.has(t)))).length
```

- [ ] **Step 5: Update handleSave to include note and reset noteText**

Find:

```tsx
  const handleSave = () => {
    if (!currentItem || !selectedColor || !activityId) return

    const colorBefore = currentItem.color
    const colorAfter = selectedColor

    appendLog({
      id: generateId(),
      itemId: currentItem.id,
      practicedAt: new Date().toISOString(),
      colorBefore,
      colorAfter,
    })

    if (colorAfter !== colorBefore) {
      saveItem({ ...currentItem, color: colorAfter })
    }

    setSessionLog(prev => [...prev, { name: currentItem.name, colorBefore, colorAfter }])

    drawNextItem()
  }
```

Replace with:

```tsx
  const handleSave = () => {
    if (!currentItem || !selectedColor || !activityId) return

    const colorBefore = currentItem.color
    const colorAfter = selectedColor
    const trimmedNote = noteText.trim()

    appendLog({
      id: generateId(),
      itemId: currentItem.id,
      practicedAt: new Date().toISOString(),
      colorBefore,
      colorAfter,
      ...(trimmedNote ? { note: trimmedNote } : {}),
    })

    if (colorAfter !== colorBefore) {
      saveItem({ ...currentItem, color: colorAfter })
    }

    setSessionLog(prev => [...prev, { name: currentItem.name, colorBefore, colorAfter }])
    setNoteText('')
    drawNextItem()
  }
```

- [ ] **Step 6: Reset noteText in handleBackToDraw**

Find:

```tsx
  const handleBackToDraw = () => {
    setPhase('draw')
  }
```

Replace with:

```tsx
  const handleBackToDraw = () => {
    setPhase('draw')
    setNoteText('')
  }
```

- [ ] **Step 7: Add past notes display in draw phase**

In the draw phase JSX, find:

```tsx
            {revealed ? (
              <div className="flex items-center gap-2">
                <ColorDot color={currentItem.color} size="md" />
                <span className="text-slate-400 text-sm capitalize">{currentItem.color}</span>
              </div>
            ) : (
              <button
                onClick={() => setRevealed(true)}
                className="text-slate-400 text-sm underline"
              >
                Tap to reveal previous rating
              </button>
            )}
          </div>
```

Replace with:

```tsx
            {revealed ? (
              <div className="flex items-center gap-2">
                <ColorDot color={currentItem.color} size="md" />
                <span className="text-slate-400 text-sm capitalize">{currentItem.color}</span>
              </div>
            ) : (
              <button
                onClick={() => setRevealed(true)}
                className="text-slate-400 text-sm underline"
              >
                Tap to reveal previous rating
              </button>
            )}

            {pastNotes.length > 0 && (
              <div className="w-full max-h-36 overflow-y-auto flex flex-col gap-1.5">
                {pastNotes.map(n => (
                  <div key={n.practicedAt} className="bg-slate-800 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500 mb-0.5">{formatNoteDate(n.practicedAt)}</p>
                    <p className="text-sm text-slate-300">{n.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
```

- [ ] **Step 8: Add note textarea in rate phase**

In the rate phase JSX, find:

```tsx
          <div className="flex flex-col gap-4">
            <ColorPicker value={selectedColor} onChange={setSelectedColor} />

            <button
              onClick={handleSave}
```

Replace with:

```tsx
          <div className="flex flex-col gap-4">
            <ColorPicker value={selectedColor} onChange={setSelectedColor} />

            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a note (optional)"
              rows={2}
              className="bg-slate-800 rounded-xl px-4 py-3 text-sm w-full outline-none resize-none text-slate-100 placeholder:text-slate-500"
            />

            <button
              onClick={handleSave}
```

- [ ] **Step 9: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 10: Commit**

```bash
git add src/screens/PracticeSessionScreen.tsx
git commit -m "feat: add notes to practice session draw and rate phases"
```

---

## Task 3: ManualPracticeScreen — rate phase note input

**Files:**
- Modify: `src/screens/ManualPracticeScreen.tsx`

### What changes

1. Import `getNotesForItem` from storage
2. Add `noteText` state
3. Update `handleSave` to include note and reset `noteText`
4. Update `handleBack` and `handleSelectItem` to reset `noteText`
5. Add textarea in rate phase JSX

- [ ] **Step 1: Update the import line**

In `src/screens/ManualPracticeScreen.tsx`, find:

```tsx
import { getActivities, getItems, saveItem, appendLog } from '../storage'
```

Replace with:

```tsx
import { getActivities, getItems, saveItem, appendLog, getNotesForItem } from '../storage'
```

- [ ] **Step 2: Add noteText state**

Find:

```tsx
  const [selectedColor, setSelectedColor] = useState<Color | null>(null)
```

Add immediately after:

```tsx
  const [noteText, setNoteText] = useState('')
```

- [ ] **Step 3: Update handleSave**

Find:

```tsx
  function handleSave() {
    if (!selectedItem || !selectedColor || !activityId) return

    const colorBefore = selectedItem.color
    const colorAfter = selectedColor

    appendLog({
      id: generateId(),
      itemId: selectedItem.id,
      practicedAt: new Date().toISOString(),
      colorBefore,
      colorAfter,
    })

    if (colorAfter !== colorBefore) {
      saveItem({ ...selectedItem, color: colorAfter })
    }

    setItems(getItems(activityId))
    setPhase('list')
    setSearchQuery('')
    setSelectedItem(null)
    setSelectedColor(null)
  }
```

Replace with:

```tsx
  function handleSave() {
    if (!selectedItem || !selectedColor || !activityId) return

    const colorBefore = selectedItem.color
    const colorAfter = selectedColor
    const trimmedNote = noteText.trim()

    appendLog({
      id: generateId(),
      itemId: selectedItem.id,
      practicedAt: new Date().toISOString(),
      colorBefore,
      colorAfter,
      ...(trimmedNote ? { note: trimmedNote } : {}),
    })

    if (colorAfter !== colorBefore) {
      saveItem({ ...selectedItem, color: colorAfter })
    }

    setItems(getItems(activityId))
    setPhase('list')
    setSearchQuery('')
    setSelectedItem(null)
    setSelectedColor(null)
    setNoteText('')
  }
```

- [ ] **Step 4: Reset noteText in handleBack and handleSelectItem**

Find:

```tsx
  function handleSelectItem(item: Item) {
    setSelectedItem(item)
    setSelectedColor(null)
    setPhase('rate')
  }

  function handleSave() {
```

Replace with:

```tsx
  function handleSelectItem(item: Item) {
    setSelectedItem(item)
    setSelectedColor(null)
    setNoteText('')
    setPhase('rate')
  }

  function handleSave() {
```

Find:

```tsx
  function handleBack() {
    setPhase('list')
    setSelectedItem(null)
    setSelectedColor(null)
  }
```

Replace with:

```tsx
  function handleBack() {
    setPhase('list')
    setSelectedItem(null)
    setSelectedColor(null)
    setNoteText('')
  }
```

- [ ] **Step 5: Derive selectedItemNotes before the phase check**

In `src/screens/ManualPracticeScreen.tsx`, find:

```tsx
  if (phase === 'rate' && selectedItem) {
```

Add immediately before it:

```tsx
  const selectedItemNotes = selectedItem ? getNotesForItem(selectedItem.id) : []

```

- [ ] **Step 6: Add past notes and textarea to rate phase JSX**

In the rate phase return, find:

```tsx
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-3xl font-bold text-center">{selectedItem.name}</p>
          <div className="flex items-center gap-2">
            <ColorDot color={selectedItem.color} size="md" />
            <span className="text-slate-400 text-sm capitalize">{selectedItem.color}</span>
          </div>
          <p className="text-slate-400 text-sm">How did it go?</p>
        </div>

        <div className="flex flex-col gap-4">
          <ColorPicker value={selectedColor} onChange={setSelectedColor} />
          <button
            onClick={handleSave}
```

Replace with:

```tsx
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-3xl font-bold text-center">{selectedItem.name}</p>
          <div className="flex items-center gap-2">
            <ColorDot color={selectedItem.color} size="md" />
            <span className="text-slate-400 text-sm capitalize">{selectedItem.color}</span>
          </div>
          <p className="text-slate-400 text-sm">How did it go?</p>
          {selectedItemNotes.length > 0 && (
            <div className="w-full max-h-36 overflow-y-auto flex flex-col gap-1.5">
              {selectedItemNotes.map(n => (
                <div key={n.practicedAt} className="bg-slate-800 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500 mb-0.5">
                    {new Date(n.practicedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-sm text-slate-300">{n.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <ColorPicker value={selectedColor} onChange={setSelectedColor} />
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Add a note (optional)"
            rows={2}
            className="bg-slate-800 rounded-xl px-4 py-3 text-sm w-full outline-none resize-none text-slate-100 placeholder:text-slate-500"
          />
          <button
            onClick={handleSave}
```

- [ ] **Step 7: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/screens/ManualPracticeScreen.tsx
git commit -m "feat: add note textarea to ManualPracticeScreen rate phase"
```

---

## Task 4: ItemProgressScreen — notes section

**Files:**
- Modify: `src/screens/ItemProgressScreen.tsx`

- [ ] **Step 1: Add getNotesForItem to import**

In `src/screens/ItemProgressScreen.tsx`, find:

```tsx
import { getActivities, getItems, getLogs } from '../storage'
```

Replace with:

```tsx
import { getActivities, getItems, getLogs, getNotesForItem } from '../storage'
```

- [ ] **Step 2: Derive notes in the component body**

Find:

```tsx
  const logs = getLogs().filter(l => l.itemId === itemId)
  const runs = buildRuns(logs)
  const totalSessions = logs.length
```

Replace with:

```tsx
  const logs = getLogs().filter(l => l.itemId === itemId)
  const runs = buildRuns(logs)
  const totalSessions = logs.length
  const notes = getNotesForItem(itemId!)
```

- [ ] **Step 3: Add notes section to the JSX**

Find the closing `</div>` that ends the entire component's content (after the runs section, before `</div>` that wraps `min-h-screen`). The current JSX ends with:

```tsx
      {runs.length === 0 ? (
        <p className="text-slate-400 text-sm">No practice sessions recorded yet.</p>
      ) : (
        <div className="flex gap-4">
          {/* Vertical color bar */}
          <div className="flex flex-col w-3 rounded-full overflow-hidden flex-shrink-0">
            {runs.map((run, i) => (
              <div
                key={i}
                style={{
                  height: `${run.count * 48}px`,
                  backgroundColor: BAR_COLOR[run.color],
                  boxShadow: i === runs.length - 1 ? `0 0 8px ${BAR_COLOR[run.color]}88` : undefined,
                }}
              />
            ))}
          </div>

          {/* Run labels */}
          <div className="flex flex-col flex-1">
            {runs.map((run, i) => {
              const isCurrent = i === runs.length - 1
              return (
                <div
                  key={i}
                  className="flex flex-col justify-center"
                  style={{ height: `${run.count * 48}px` }}
                >
                  <span className={`text-sm font-semibold ${TEXT_CLASS[run.color]}`}>
                    {run.color.charAt(0).toUpperCase() + run.color.slice(1)}
                    {isCurrent && <span className="text-slate-500 font-normal"> · current</span>}
                  </span>
                  <span className="text-xs text-slate-500">
                    {run.count} session{run.count === 1 ? '' : 's'} · {formatDateRange(run.startDate, run.endDate)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
```

Replace with:

```tsx
      {runs.length === 0 ? (
        <p className="text-slate-400 text-sm">No practice sessions recorded yet.</p>
      ) : (
        <div className="flex gap-4">
          {/* Vertical color bar */}
          <div className="flex flex-col w-3 rounded-full overflow-hidden flex-shrink-0">
            {runs.map((run, i) => (
              <div
                key={i}
                style={{
                  height: `${run.count * 48}px`,
                  backgroundColor: BAR_COLOR[run.color],
                  boxShadow: i === runs.length - 1 ? `0 0 8px ${BAR_COLOR[run.color]}88` : undefined,
                }}
              />
            ))}
          </div>

          {/* Run labels */}
          <div className="flex flex-col flex-1">
            {runs.map((run, i) => {
              const isCurrent = i === runs.length - 1
              return (
                <div
                  key={i}
                  className="flex flex-col justify-center"
                  style={{ height: `${run.count * 48}px` }}
                >
                  <span className={`text-sm font-semibold ${TEXT_CLASS[run.color]}`}>
                    {run.color.charAt(0).toUpperCase() + run.color.slice(1)}
                    {isCurrent && <span className="text-slate-500 font-normal"> · current</span>}
                  </span>
                  <span className="text-xs text-slate-500">
                    {run.count} session{run.count === 1 ? '' : 's'} · {formatDateRange(run.startDate, run.endDate)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Notes</h2>
          <div className="flex flex-col gap-3">
            {notes.map(n => (
              <div key={n.practicedAt} className="bg-slate-800 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">
                  {new Date(n.practicedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-sm text-slate-200">{n.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
```

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/screens/ItemProgressScreen.tsx
git commit -m "feat: add notes section to ItemProgressScreen"
```
