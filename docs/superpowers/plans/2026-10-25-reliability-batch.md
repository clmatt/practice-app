# Reliability & Structure Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the colour-history and two-write bugs, add archive/session-resume/import-validation/export-first safety nets, a version label and a WebKit e2e test, and centralise ratings, labels and the activity lookup.

**Architecture:** All data changes stay in `src/storage.ts` (new `recordPractice`, edit logs inside `saveItem`, `getActiveItems`, practice-only queries filtered by `isRep`). New small modules: `logs.ts` (`isRep`), `labels.ts` (plurals), `sessionResume.ts` (Auto Practice resume in localStorage), `useActivity.ts` (route activity + redirect). UI pieces `RatePanel`, `NoteList`, `ConfirmDestructive` are shared components. Import splits into `planImport` (pure) and `applyImport`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4 + Testing Library + fake-indexeddb, Tailwind 3, Playwright (new, WebKit only).

**Spec:** `docs/superpowers/specs/2026-10-25-reliability-batch-design.md`

## Global Constraints

- No `CURRENT_SCHEMA_VERSION` bump; every new stored field is optional (`PracticeLog.source?: 'edit'`, `Item.archivedAt?: string`, `Activity.itemLabelPlural?: string`).
- Never write or delete legacy localStorage keys `practice:activities`, `practice:items`, `practice:logs`, `practice:saved-filters`. Session resume uses `practice-app:auto-session:<activityId>`.
- Code style: 2-space indent, no semicolons, single quotes, Tailwind classes, slate background, violet accents. No enums/namespaces/parameter properties. `.tsx` files export only components.
- Rating colours only via `RATING_COLORS`/`RATINGS` in `src/palette.ts`; tags/names sorted with `sortTags`/`compareNatural`.
- Group by day with `localDateKey()`.
- Effects only for redirects; screens read storage in `useState` initialisers.
- Wording: one rating = "rep"; a practice day = "session".
- `npm run lint` must report 0 problems; `npm test`, `npm run build`, `npm run test:e2e` must pass before merging to `main`.

## Review Focus

1. Seeding helpers in existing tests call `saveItem` twice with different colours — with edit logs that now creates a log; tests that count logs or "Never practiced" must still be right (edit logs are not reps). Covered: Task 4 test "an edit does not count as practice".
2. Resuming a session whose current item was archived, deleted or already practised today must draw a fresh item, not show a stale one. Covered: Task 8 test "draws a fresh item when the saved current item was practised".
3. Cancelling the iOS share sheet in "Export backup, then delete" must not delete. Covered: Task 10 test "does nothing when the export is cancelled".
4. An archived item must never come up in Auto Practice even if it's the only red item. Covered: Task 7 test "never draws archived items".
5. An old backup (no `schemaVersion`, no `savedFilters`, no new fields) must still import unchanged. Covered by existing test "accepts backups from before schemaVersion…" plus Task 9 test "keeps valid records from an old backup".

---

### Task 1: Ratings list, `toggled`, UUID ids

**Files:**
- Modify: `src/palette.ts`, `src/utils.ts`, `src/autoPractice.ts`, `src/selection.ts`, `src/colorChart.ts:45`, `src/itemList.ts:35,57`, `src/components/ColorPicker.tsx`, `src/components/ColorDistributionChart.tsx:8-10`, `src/screens/ActivityDashboardScreen.tsx:94,188`, `src/screens/ManageItemsScreen.tsx:13,21-26`, `src/screens/PracticeSessionScreen.tsx`, `src/screens/ItemProgressScreen.tsx:86`
- Test: `src/tests/palette.test.ts` (new), `src/tests/utils.test.ts` (new)

**Interfaces:**
- Produces: `RATINGS: Rating[]`, `RATING_ORDER: Color[]`, `isColor(v: unknown): v is Color`, `ratingName(c: Color): string` in `palette.ts`; `toggled<T>(set: Set<T>, value: T): Set<T>` and `generateId(): string` (UUID) in `utils.ts`. `PRACTICE_COLORS` is removed.

- [ ] **Step 1: Write failing tests**

`src/tests/palette.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { RATINGS, RATING_ORDER, isColor, ratingName } from '../palette'

describe('ratings', () => {
  it('lists the ratings worst first with their names and labels', () => {
    expect(RATING_ORDER).toEqual(['red', 'yellow', 'green'])
    expect(RATINGS.map(r => r.label)).toEqual(['Struggled', 'Okay', 'Solid'])
    expect(ratingName('yellow')).toBe('Yellow')
  })

  it('recognises rating colours', () => {
    expect(isColor('green')).toBe(true)
    expect(isColor('blue')).toBe(false)
    expect(isColor(undefined)).toBe(false)
  })
})
```
`src/tests/utils.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generateId, toggled } from '../utils'

describe('generateId', () => {
  it('returns unique UUIDs', () => {
    const a = generateId()
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
    expect(generateId()).not.toBe(a)
  })
})

describe('toggled', () => {
  it('adds a missing value and removes a present one without mutating', () => {
    const s = new Set(['a'])
    expect([...toggled(s, 'b')]).toEqual(['a', 'b'])
    expect([...toggled(s, 'a')]).toEqual([])
    expect([...s]).toEqual(['a'])
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/tests/palette.test.ts src/tests/utils.test.ts` — expect FAIL (missing exports).

- [ ] **Step 3: Implement**

`src/palette.ts` — append after `RATING_COLORS`:
```ts
export interface Rating {
  color: Color
  /** "Red", for legends and filters. */
  name: string
  /** What the rating means when you give it. */
  label: string
}

/** The ratings in order, worst first. Use this instead of listing the colors by hand. */
export const RATINGS: Rating[] = [
  { color: 'red', name: 'Red', label: 'Struggled' },
  { color: 'yellow', name: 'Yellow', label: 'Okay' },
  { color: 'green', name: 'Green', label: 'Solid' },
]

export const RATING_ORDER: Color[] = RATINGS.map(r => r.color)

export function isColor(value: unknown): value is Color {
  return RATING_ORDER.includes(value as Color)
}

export function ratingName(color: Color): string {
  return RATINGS.find(r => r.color === color)!.name
}
```
`src/utils.ts`:
```ts
export function generateId(): string {
  return crypto.randomUUID()
}

/** A copy of `set` with `value` added if it was missing, removed if it was there. */
export function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}
```
Replace the hand-written lists:
- `autoPractice.ts`: delete `PRACTICE_COLORS`; `describeFilter` uses `RATING_ORDER.filter(c => filter.colors.has(c)).map(ratingName).join(', ')`.
- `selection.ts:50`: `const drawable = RATING_ORDER.filter(...)`.
- `colorChart.ts:45`: `const STACK = RATING_ORDER`.
- `itemList.ts`: drop `COLORS`; `readListView` uses `.filter(isColor)`; `writeListView` uses `RATING_ORDER.filter(...)`; `COLOR_ORDER` becomes `RATING_ORDER.indexOf(a.color) - RATING_ORDER.indexOf(b.color)` in the `'color'` case.
- `ColorPicker.tsx`: drop `OPTIONS`, map over `RATINGS` (`{ color, label }`).
- `ColorDistributionChart.tsx`: drop `NAMES`/`LEGEND_ORDER`; `LEGEND_ORDER` → `RATING_ORDER`, `NAMES[c]` → `ratingName(c)`, `TOOLTIP_ORDER = [...RATING_ORDER].reverse()`.
- `ActivityDashboardScreen.tsx` both `(['red','yellow','green'] as const).map` → `RATING_ORDER.map`.
- `ManageItemsScreen.tsx`: drop `COLORS` and the local `toggled`; import `RATING_ORDER` and `toggled`.
- `PracticeSessionScreen.tsx`: `PRACTICE_COLORS` → `RATING_ORDER`; drop the local `toggled` and import it from `../utils`.
- `ItemProgressScreen.tsx:86`: `run.color.charAt(0).toUpperCase() + run.color.slice(1)` → `ratingName(run.color)`.

- [ ] **Step 4: Run** `npm test` and `npm run lint` — expect all PASS / 0 problems.

- [ ] **Step 5: Commit** `refactor: one RATINGS list for the rating colours; UUID ids`

---

### Task 2: Plurals

**Files:**
- Create: `src/labels.ts`
- Modify: `src/types.ts` (Activity), `src/components/TabBar.tsx:61-65,111`, `src/screens/HomeScreen.tsx:78`, `src/screens/ActivityDashboardScreen.tsx` (settings field, line 185, delete text), `src/screens/ManageItemsScreen.tsx` (`{label}s`), `src/screens/ManualPracticeScreen.tsx:163-173`, `src/screens/PracticeChooserScreen.tsx:28`, `src/screens/StatsScreen.tsx:89,95`
- Test: `src/tests/labels.test.ts` (new), `src/tests/activityScreens.test.tsx`

**Interfaces:**
- Produces: `pluralize(word: string): string`, `pluralLabel(activity: Pick<Activity, 'itemLabel' | 'itemLabelPlural'>): string`, `capitalize(s: string): string` in `labels.ts`; `Activity.itemLabelPlural?: string`.

- [ ] **Step 1: Write failing tests**

`src/tests/labels.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { pluralize, pluralLabel, capitalize } from '../labels'

describe('pluralize', () => {
  it.each([
    ['trick', 'tricks'], ['route', 'routes'], ['category', 'categories'], ['day', 'days'],
    ['box', 'boxes'], ['class', 'classes'], ['match', 'matches'], ['dish', 'dishes'], ['waltz', 'waltzes'],
    ['Problem', 'Problems'], ['KEY', 'KEYS'], ['PARTY', 'PARTIES'],
  ])('%s → %s', (word, plural) => {
    expect(pluralize(word)).toBe(plural)
  })
})

describe('pluralLabel', () => {
  it('uses the override when set, else the automatic plural', () => {
    expect(pluralLabel({ itemLabel: 'piece' })).toBe('pieces')
    expect(pluralLabel({ itemLabel: 'cactus', itemLabelPlural: 'cacti' })).toBe('cacti')
    expect(pluralLabel({ itemLabel: 'trick', itemLabelPlural: '  ' })).toBe('tricks')
  })
})

describe('capitalize', () => {
  it('upper-cases the first letter', () => {
    expect(capitalize('tricks')).toBe('Tricks')
    expect(capitalize('')).toBe('')
  })
})
```
In `src/tests/activityScreens.test.tsx` add:
```ts
describe('item label plural', () => {
  it('shows automatic plurals and saves an override from Settings', () => {
    saveActivity({ id: 'act-1', name: 'Cooking', itemLabel: 'dish', weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z' })
    renderAt('/activity/act-1')
    expect(screen.getByText('dishes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const plural = screen.getByLabelText('Plural (optional)')
    expect(plural).toHaveAttribute('placeholder', 'dishes')
    fireEvent.change(plural, { target: { value: 'meals' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(getActivities()[0].itemLabelPlural).toBe('meals')
    expect(screen.getByText('meals')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/tests/labels.test.ts src/tests/activityScreens.test.tsx` — expect FAIL.

- [ ] **Step 3: Implement**

`src/types.ts` Activity gains:
```ts
  /** Plural of itemLabel when the automatic one is wrong (e.g. "cacti"). */
  itemLabelPlural?: string
```
`src/labels.ts`:
```ts
import type { Activity } from './types'

/** English plural: category → categories, box → boxes, trick → tricks. Keeps an all-caps word all caps. */
export function pluralize(word: string): string {
  const w = word.trim()
  if (w === '') return w
  const upper = w.length > 1 && w === w.toUpperCase() && w !== w.toLowerCase()
  const suffix = (s: string) => (upper ? s.toUpperCase() : s)
  if (/[^aeiou]y$/i.test(w)) return w.slice(0, -1) + suffix('ies')
  if (/(s|x|z|ch|sh)$/i.test(w)) return w + suffix('es')
  return w + suffix('s')
}

/** The activity's items in the plural ("tricks"), using its override when set. */
export function pluralLabel(activity: Pick<Activity, 'itemLabel' | 'itemLabelPlural'>): string {
  return activity.itemLabelPlural?.trim() || pluralize(activity.itemLabel)
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
```
Replace every `${…itemLabel}s` / `{label}s` with `pluralLabel(activity)` (store it in a `const plural = pluralLabel(activity)` near the top of each render). In `TabBar.tsx`, `itemsTabLabel` becomes:
```ts
function itemsTabLabel(activityId: string): string {
  const activity = getActivities().find(a => a.id === activityId)
  return activity && activity.itemLabel.trim() ? capitalize(pluralLabel(activity)) : 'Items'
}
```
`ActivityDashboardScreen.tsx` Settings: add state `const [draftPlural, setDraftPlural] = useState(() => activity?.itemLabelPlural ?? '')`, and after the Item label field:
```tsx
<div>
  <label htmlFor="item-label-plural" className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Plural (optional)</label>
  <input
    id="item-label-plural"
    className="w-full bg-slate-800 rounded-xl px-4 py-3 outline-none text-sm"
    placeholder={pluralize(draftLabel.trim() || activity.itemLabel)}
    value={draftPlural}
    onChange={e => setDraftPlural(e.target.value)}
  />
</div>
```
and in `handleSaveSettings` add `itemLabelPlural: draftPlural.trim() || undefined`.

- [ ] **Step 4: Run** `npm test` — PASS; `npm run lint` — 0.

- [ ] **Step 5: Commit** `feat: correct plurals for item labels, with an optional override`

---

### Task 3: `useActivity()` hook

**Files:**
- Create: `src/useActivity.ts`
- Modify: every screen under `/activity/:activityId` — `ActivityDashboardScreen`, `PracticeChooserScreen`, `PracticeSessionScreen`, `ManualPracticeScreen`, `ManageItemsScreen`, `AddEditItemScreen`, `ItemProgressScreen`, `StatsScreen`
- Test: `src/tests/useActivity.test.tsx` (new)

**Interfaces:**
- Produces: `useActivity(): [Activity | null, Dispatch<SetStateAction<Activity | null>>]`.

- [ ] **Step 1: Write failing test**
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useActivity } from '../useActivity'
import { saveActivity } from '../storage'

function Probe() {
  const [activity] = useActivity()
  return <p>{activity ? activity.name : 'none'}</p>
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/activity/:activityId" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('useActivity', () => {
  it("returns the route's activity", () => {
    saveActivity({ id: 'act-1', name: 'Juggling', itemLabel: 'trick', weights: { red: 1, yellow: 0, green: 0 }, createdAt: '2026-01-01T00:00:00.000Z' })
    renderAt('/activity/act-1')
    expect(screen.getByText('Juggling')).toBeInTheDocument()
  })

  it('sends you Home when the activity does not exist', () => {
    renderAt('/activity/missing')
    expect(screen.getByText('home')).toBeInTheDocument()
  })
})
```
- [ ] **Step 2: Run** — FAIL (module missing).
- [ ] **Step 3: Implement** `src/useActivity.ts`:
```ts
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getActivities } from './storage'
import type { Activity } from './types'

/** The activity named in the route, read once when the screen opens. Redirects Home if it doesn't exist. */
export function useActivity(): [Activity | null, Dispatch<SetStateAction<Activity | null>>] {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const [activity, setActivity] = useState<Activity | null>(() => getActivities().find(a => a.id === activityId) ?? null)
  useEffect(() => {
    if (!activity) navigate('/')
  }, [activity, navigate])
  return [activity, setActivity]
}
```
In each screen replace the `useState(() => getActivities().find(...))` + `if (!activity) navigate('/')` effect with `const [activity] = useActivity()` (Dashboard: `const [activity, setActivity] = useActivity()`). Screens keep their own effects only for their extra redirects (PracticeSession: no items → dashboard; ItemProgress: missing item → list; AddEdit: missing item → list), with the `!activity` branch removed from those effects. `StatsScreen` drops its `useMemo` activity lookup.
- [ ] **Step 4: Run** `npm test`, `npm run lint` — PASS / 0.
- [ ] **Step 5: Commit** `refactor: useActivity hook for the route's activity and its redirect`

---

### Task 4: Storage — `recordPractice`, edit logs, practice-only queries, chart fallback

**Files:**
- Create: `src/logs.ts`
- Modify: `src/types.ts` (PracticeLog), `src/storage.ts`
- Test: `src/tests/storage.test.ts`, `src/tests/storageWrites.test.ts` (new)

**Interfaces:**
- Produces: `isRep(log: PracticeLog): boolean` (`logs.ts`); `recordPractice(args: { item: Item; color: Color; note?: string; at?: Date }): string` (returns log id); `saveItem(item: Item, now?: Date): void` (now also logs colour edits). `getTodayPracticedItemIds`, `getPracticeCountByItem`, `getLastPracticedByItem`, `getNotesForItem`, `getSessionHistory` count reps only.

- [ ] **Step 1: Write failing tests** — append to `src/tests/storage.test.ts`:
```ts
describe('colour edits', () => {
  it('saving an item with a new colour logs the edit', () => {
    saveItem(makeItem({ color: 'red' }))
    saveItem(makeItem({ color: 'green' }), new Date('2026-05-02T18:00:00.000Z'))
    expect(getLogs()).toEqual([expect.objectContaining({
      itemId: 'item-1', colorBefore: 'red', colorAfter: 'green', source: 'edit', practicedAt: '2026-05-02T18:00:00.000Z',
    })])
  })

  it('saving with the same colour, or a new item, logs nothing', () => {
    saveItem(makeItem())
    saveItem(makeItem({ name: 'Renamed' }))
    expect(getLogs()).toEqual([])
  })

  it('an edit does not count as practice', () => {
    saveActivity(makeActivity())
    saveItem(makeItem({ color: 'red' }))
    saveItem(makeItem({ color: 'green' }))
    expect(getTodayPracticedItemIds('act-1').size).toBe(0)
    expect(getPracticeCountByItem('act-1')).toEqual({})
    expect(getLastPracticedByItem('act-1')).toEqual({})
    expect(getSessionHistory('act-1')).toEqual([])
  })

  it('the chart shows the edit, and the colour before the first log on earlier days', () => {
    saveActivity(makeActivity())
    saveItem(makeItem({ color: 'red', createdAt: '2026-05-01T18:00:00.000Z' }))
    appendLog(makeLog({ id: 'l1', practicedAt: '2026-05-01T18:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    saveItem(makeItem({ color: 'green', createdAt: '2026-05-01T18:00:00.000Z' }), new Date('2026-05-03T18:00:00.000Z'))
    expect(getColorDistributionByDay('act-1')).toEqual([
      { date: '2026-05-01', red: 1, yellow: 0, green: 0 },
      { date: '2026-05-03', red: 0, yellow: 0, green: 1 },
    ])
  })

  it('a never-practised item keeps its first colour on days before it was edited', () => {
    saveActivity(makeActivity())
    saveItem(makeItem({ id: 'a', color: 'red', createdAt: '2026-05-01T18:00:00.000Z' }))
    saveItem(makeItem({ id: 'b', color: 'yellow', createdAt: '2026-05-01T18:00:00.000Z' }))
    appendLog(makeLog({ id: 'l1', itemId: 'a', practicedAt: '2026-05-01T18:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    saveItem(makeItem({ id: 'b', color: 'green', createdAt: '2026-05-01T18:00:00.000Z' }), new Date('2026-05-03T18:00:00.000Z'))
    expect(getColorDistributionByDay('act-1')[0]).toEqual({ date: '2026-05-01', red: 1, yellow: 1, green: 0 })
  })

  it('undo leaves an edited colour alone', () => {
    saveItem(makeItem({ color: 'red' }))
    const logId = recordPractice({ item: makeItem({ color: 'red' }), color: 'yellow' })
    saveItem({ ...getItems('act-1')[0], color: 'green' })
    undoPracticeLog(logId)
    expect(getItems('act-1')[0].color).toBe('green')
  })
})

describe('recordPractice', () => {
  it('logs the rep and updates the colour', () => {
    saveItem(makeItem({ color: 'red' }))
    const id = recordPractice({ item: makeItem({ color: 'red' }), color: 'green', note: '  felt good  ', at: new Date('2026-05-02T18:00:00.000Z') })
    expect(getLogs()).toEqual([{ id, itemId: 'item-1', practicedAt: '2026-05-02T18:00:00.000Z', colorBefore: 'red', colorAfter: 'green', note: 'felt good' }])
    expect(getItems('act-1')[0].color).toBe('green')
  })

  it('takes colorBefore from the stored item, not a stale copy', () => {
    saveItem(makeItem({ color: 'yellow' }))
    recordPractice({ item: makeItem({ color: 'red' }), color: 'green' })
    expect(getLogs()[0].colorBefore).toBe('yellow')
  })

  it('leaves out an empty note', () => {
    saveItem(makeItem())
    recordPractice({ item: makeItem(), color: 'red', note: '   ' })
    expect(getLogs()[0]).not.toHaveProperty('note')
  })
})
```
(add `recordPractice`, `getPracticeCountByItem`, `getLastPracticedByItem` to the import list.)

`src/tests/storageWrites.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('../db', async importOriginal => {
  const actual = await importOriginal<typeof import('../db')>()
  return { ...actual, applyOps: vi.fn(actual.applyOps) }
})

import { applyOps } from '../db'
import { saveItem, recordPractice, flushWrites } from '../storage'
import type { Item } from '../types'

const item: Item = { id: 'i1', activityId: 'a1', name: 'Box', color: 'red', createdAt: '2026-01-01T00:00:00.000Z' }

describe('atomic writes', () => {
  it('a rating that changes the colour is one transaction', async () => {
    saveItem(item)
    await flushWrites()
    vi.mocked(applyOps).mockClear()
    recordPractice({ item, color: 'green' })
    await flushWrites()
    expect(applyOps).toHaveBeenCalledTimes(1)
    const ops = vi.mocked(applyOps).mock.calls[0][1]
    expect(ops.map(op => op.store).sort()).toEqual(['items', 'logs'])
  })

  it('a colour edit and its log are one transaction', async () => {
    saveItem(item)
    await flushWrites()
    vi.mocked(applyOps).mockClear()
    saveItem({ ...item, color: 'yellow' })
    await flushWrites()
    expect(applyOps).toHaveBeenCalledTimes(1)
    expect(vi.mocked(applyOps).mock.calls[0][1].map(op => op.store).sort()).toEqual(['items', 'logs'])
  })
})
```
- [ ] **Step 2: Run** `npx vitest run src/tests/storage.test.ts src/tests/storageWrites.test.ts` — FAIL.
- [ ] **Step 3: Implement**

`src/types.ts` PracticeLog gains:
```ts
  /** 'edit': the colour was changed by hand, not practised. Absent on practice reps. */
  source?: 'edit'
```
`src/logs.ts`:
```ts
import type { PracticeLog } from './types'

/** Whether a log is a practice rep (rather than a record of a colour edited by hand). */
export function isRep(log: PracticeLog): boolean {
  return log.source !== 'edit'
}
```
`src/storage.ts`:
- import `isRep` from `./logs`, `generateId` from `./utils`.
- add `const reps = (): PracticeLog[] => state.logs.filter(isRep)` and use `reps()` instead of `state.logs` in `getTodayPracticedItemIds`, `getPracticeCountByItem`, `getLastPracticedByItem`, `getNotesForItem`, `getSessionHistory`.
- `saveItem`:
```ts
/** Saves an item. Changing an existing item's colour also logs the edit, in the same save. */
export function saveItem(item: Item, now: Date = new Date()): void {
  const existing = state.items.find(i => i.id === item.id)
  const edit: PracticeLog | null = existing && existing.color !== item.color
    ? { id: generateId(), itemId: item.id, practicedAt: now.toISOString(), colorBefore: existing.color, colorAfter: item.color, source: 'edit' }
    : null
  state = { ...state, items: upsert(state.items, item), logs: edit ? [...state.logs, edit] : state.logs }
  persist([...puts('items', [item]), ...(edit ? puts('logs', [edit]) : [])])
}
```
- `recordPractice`:
```ts
/**
 * Saves a practice rating: the log and, if the colour changed, the item —
 * in one transaction. Returns the new log's id (for Undo).
 */
export function recordPractice({ item, color, note, at = new Date() }: { item: Item; color: Color; note?: string; at?: Date }): string {
  const current = state.items.find(i => i.id === item.id) ?? item
  const trimmed = note?.trim()
  const log: PracticeLog = {
    id: generateId(),
    itemId: current.id,
    practicedAt: at.toISOString(),
    colorBefore: current.color,
    colorAfter: color,
    ...(trimmed ? { note: trimmed } : {}),
  }
  const updated = color !== current.color ? { ...current, color } : null
  state = {
    ...state,
    logs: [...state.logs, log],
    items: updated ? upsert(state.items, updated) : state.items,
  }
  persist([...puts('logs', [log]), ...(updated ? puts('items', [updated]) : [])])
  return log.id
}
```
- `getColorDistributionByDay`: after building `logs` (all logs, edits included), add
```ts
  // Before an item's first log, it had that log's starting colour (not necessarily today's).
  const firstColor = new Map<string, Color>()
  for (const { log } of logs) if (!firstColor.has(log.itemId)) firstColor.set(log.itemId, log.colorBefore)
```
and count `counts[colorSoFar.get(item.id) ?? firstColor.get(item.id) ?? item.color]++`.
- [ ] **Step 4: Run** `npm test` — all PASS (fix any seeding test that now trips over an edit log by checking whether the assertion is about reps; do not weaken assertions). `npm run lint` — 0.
- [ ] **Step 5: Commit** `fix: colour edits are logged and ratings save in one transaction`

---

### Task 5: Runs show edits; "reps" wording

**Files:**
- Modify: `src/itemRuns.ts`, `src/screens/ItemProgressScreen.tsx`, `src/screens/ManageItemsScreen.tsx:15-19`, `src/screens/ImportScreen.tsx` ("sessions" → "reps")
- Test: `src/tests/itemProgress.test.ts`, `src/tests/itemsScreens.test.tsx`

**Interfaces:**
- Consumes: `isRep` (Task 4).
- Produces: `Run` gains `edited: boolean`; `count` counts reps only.

- [ ] **Step 1: Tests.** In `itemProgress.test.ts` add `edited: false` to every expected run object, and add:
```ts
  it('starts a zero-rep run, flagged edited, when the colour was changed by hand', () => {
    const runs = buildRuns([
      makeLog('red', '2026-05-01T18:00:00.000Z'),
      { ...makeLog('green', '2026-05-03T18:00:00.000Z', 'red'), source: 'edit' },
    ])
    expect(runs).toEqual([
      { color: 'red', count: 1, startDate: '2026-05-01', endDate: '2026-05-01', edited: false },
      { color: 'green', count: 0, startDate: '2026-05-03', endDate: '2026-05-03', edited: true },
    ])
  })

  it('reps after an edit join its run', () => {
    const runs = buildRuns([
      { ...makeLog('green', '2026-05-03T18:00:00.000Z', 'red'), source: 'edit' },
      makeLog('green', '2026-05-04T18:00:00.000Z', 'green'),
    ])
    expect(runs).toEqual([{ color: 'green', count: 1, startDate: '2026-05-03', endDate: '2026-05-04', edited: true }])
  })
```
In `itemsScreens.test.tsx` change `'Last practiced September 21 · 2 sessions'` → `'Last practiced September 21 · 2 reps'`, and add:
```tsx
describe('Item page', () => {
  it('counts reps and marks a colour changed by hand', () => {
    seed()
    saveItem(item('a', 'Mills Mess', { color: 'green', tags: ['3-ball', 'hard'] }))
    renderAt('/activity/act-1/manage/a')
    expect(screen.getByText(/2 reps total/)).toBeInTheDocument()
    expect(screen.getByText(/Set manually/)).toBeInTheDocument()
  })
})
```
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `src/itemRuns.ts`:
```ts
import type { Color, PracticeLog } from './types'
import { localDateKey } from './dates'
import { isRep } from './logs'

export interface Run {
  color: Color
  /** Practice reps in this run (a run started by a hand edit can have 0). */
  count: number
  startDate: string
  endDate: string
  /** The run began with a colour changed by hand rather than a rep. */
  edited: boolean
}

export function buildRuns(logs: PracticeLog[]): Run[] {
  const sorted = [...logs].sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
  const runs: Run[] = []
  for (const log of sorted) {
    const date = localDateKey(log.practicedAt)
    const rep = isRep(log)
    const last = runs[runs.length - 1]
    if (last && last.color === log.colorAfter) {
      if (rep) {
        last.count++
        last.endDate = date
      }
    } else {
      runs.push({ color: log.colorAfter, count: rep ? 1 : 0, startDate: date, endDate: date, edited: !rep })
    }
  }
  return runs
}
```
`ItemProgressScreen.tsx`: `const totalReps = logs.filter(isRep).length`; header `` ` · ${totalReps} rep${totalReps === 1 ? '' : 's'} total` ``; run height `` `${Math.max(run.count, 0.5) * 48}px` `` (both columns); second line:
```tsx
<span className="text-xs text-slate-500">
  {run.edited && 'Set manually · '}
  {run.count > 0 && `${run.count} rep${run.count === 1 ? '' : 's'} · `}
  {formatDateRange(run.startDate, run.endDate)}
</span>
```
`ManageItemsScreen.practiceSummary`: `` `Last practiced ${date} · ${count} rep${count === 1 ? '' : 's'}` ``.
`ImportScreen.tsx`: the four "sessions" labels become "reps"; the existing-item count uses `getLogs().filter(l => l.itemId === … && isRep(l)).length`; summary line `{stats.logsAdded} {stats.logsAdded === 1 ? 'rep' : 'reps'} imported`.
- [ ] **Step 4: Run** `npm test`, `npm run lint`.
- [ ] **Step 5: Commit** `feat: item history shows hand edits; count reps consistently`

---

### Task 6: `RatePanel`, `NoteList`, practice screens use `recordPractice`; Manual Practice tests

**Files:**
- Create: `src/components/RatePanel.tsx`, `src/components/NoteList.tsx`
- Modify: `src/dates.ts` (add `formatLongDate`), `src/screens/PracticeSessionScreen.tsx`, `src/screens/ManualPracticeScreen.tsx`, `src/screens/ItemProgressScreen.tsx`
- Test: `src/tests/manualPractice.test.tsx` (new), `src/tests/dates.test.ts`

**Interfaces:**
- Consumes: `recordPractice` (Task 4), `RATINGS` via `ColorPicker`.
- Produces: `RatePanel({ value, onChange, note, onNoteChange, onSave, onBack })`; `NoteList({ notes, compact? })`; `formatLongDate(iso: string): string`.

- [ ] **Step 1: Write failing tests**

`src/tests/dates.test.ts` add:
```ts
it('formatLongDate shows the local calendar date', () => {
  expect(formatLongDate('2026-05-02T03:00:00.000Z')).toBe('May 1, 2026')
})
```
`src/tests/manualPractice.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ManualPracticeScreen from '../screens/ManualPracticeScreen'
import { saveActivity, saveItem, getLogs, getItems } from '../storage'

function seed() {
  saveActivity({ id: 'act-1', name: 'Juggling', itemLabel: 'trick', weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z' })
  saveItem({ id: 'a', activityId: 'act-1', name: 'Box', color: 'red', createdAt: '2026-01-01T00:00:00.000Z' })
  saveItem({ id: 'b', activityId: 'act-1', name: 'Mills Mess', color: 'yellow', createdAt: '2026-01-01T00:00:00.000Z' })
}

function renderScreen() {
  render(
    <MemoryRouter initialEntries={['/activity/act-1/manual-practice']}>
      <Routes>
        <Route path="/activity/:activityId/manual-practice" element={<ManualPracticeScreen />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('Manual Practice', () => {
  it('rating an item saves one rep with the note and updates its colour', () => {
    seed()
    renderScreen()
    click(/Box/)
    click('Solid')
    fireEvent.change(screen.getByPlaceholderText('Add a note (optional)'), { target: { value: 'clean' } })
    click('Save')
    expect(getLogs()).toEqual([expect.objectContaining({ itemId: 'a', colorBefore: 'red', colorAfter: 'green', note: 'clean' })])
    expect(getItems('act-1').find(i => i.id === 'a')!.color).toBe('green')
    expect(screen.getByText('Saved "Box"')).toBeInTheDocument()
  })

  it('Undo removes the rep and restores the colour', () => {
    seed()
    renderScreen()
    click(/Box/)
    click('Solid')
    click('Save')
    click('Undo')
    expect(getLogs()).toEqual([])
    expect(getItems('act-1').find(i => i.id === 'a')!.color).toBe('red')
  })

  it('search narrows the list', () => {
    seed()
    renderScreen()
    fireEvent.change(screen.getByPlaceholderText('Search tricks'), { target: { value: 'mill' } })
    expect(screen.queryByRole('button', { name: /Box/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Mills Mess/ })).toBeInTheDocument()
  })

  it("shows the item's past notes when rating it", () => {
    seed()
    renderScreen()
    click(/Box/)
    click('Okay')
    fireEvent.change(screen.getByPlaceholderText('Add a note (optional)'), { target: { value: 'drop on 3' } })
    click('Save')
    click(/Box/)
    expect(screen.getByText('drop on 3')).toBeInTheDocument()
  })
})
```
- [ ] **Step 2: Run** — FAIL (`formatLongDate` missing; other tests may pass already — that's fine, they pin behaviour through the refactor).
- [ ] **Step 3: Implement**

`src/dates.ts`:
```ts
/** A timestamp's local date in words, e.g. "May 1, 2026". */
export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
```
`src/components/NoteList.tsx`:
```tsx
import { formatLongDate } from '../dates'

interface Props {
  notes: { practicedAt: string; note: string }[]
  /** Small, scrolling list for the practice screens; roomy cards on the item page. */
  compact?: boolean
}

/** An item's past notes, newest first. Renders nothing when there are none. */
export default function NoteList({ notes, compact = false }: Props) {
  if (notes.length === 0) return null
  return (
    <div className={compact ? 'w-full max-h-36 overflow-y-auto flex flex-col gap-1.5' : 'flex flex-col gap-3'}>
      {notes.map(n => (
        <div key={n.practicedAt} className={compact ? 'bg-slate-800 rounded-lg px-3 py-2' : 'bg-slate-800 rounded-xl px-4 py-3'}>
          <p className={`text-xs text-slate-500 ${compact ? 'mb-0.5' : 'mb-1'}`}>{formatLongDate(n.practicedAt)}</p>
          <p className={`text-sm ${compact ? 'text-slate-300' : 'text-slate-200'}`}>{n.note}</p>
        </div>
      ))}
    </div>
  )
}
```
`src/components/RatePanel.tsx`:
```tsx
import type { Color } from '../types'
import ColorPicker from './ColorPicker'

interface Props {
  value: Color | null
  onChange: (color: Color) => void
  note: string
  onNoteChange: (note: string) => void
  onSave: () => void
  onBack: () => void
}

/** Rating buttons, an optional note, Save and Back — the bottom of both practice screens. */
export default function RatePanel({ value, onChange, note, onNoteChange, onSave, onBack }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <ColorPicker value={value} onChange={onChange} />
      <textarea
        value={note}
        onChange={e => onNoteChange(e.target.value)}
        placeholder="Add a note (optional)"
        rows={2}
        className="bg-slate-800 rounded-xl px-4 py-3 text-sm w-full outline-none resize-none text-slate-100 placeholder:text-slate-500"
      />
      <button
        onClick={onSave}
        disabled={value === null}
        className="bg-violet-600 hover:bg-violet-500 rounded-xl py-4 font-bold text-lg w-full disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Save
      </button>
      <button onClick={onBack} className="bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold w-full">
        Back
      </button>
    </div>
  )
}
```
`PracticeSessionScreen.tsx`: `handleSave` becomes
```ts
  const handleSave = () => {
    if (!currentItem || !selectedColor) return
    const colorBefore = getItems(currentItem.activityId).find(i => i.id === currentItem.id)?.color ?? currentItem.color
    const logId = recordPractice({ item: currentItem, color: selectedColor, note: noteText })
    setSessionLog(prev => [...prev, { name: currentItem.name, colorBefore, colorAfter: selectedColor }])
    setLastSaved({ logId, name: currentItem.name })
    setNoteText('')
    if (activity?.chooseFilterEachItem) openFilterStep()
    else drawNextItem()
  }
```
(Task 8 rewrites this again to pass explicit values; keep it simple here.) Replace the past-notes block with `<NoteList notes={pastNotes} compact />`, the rate-phase bottom block with `<RatePanel value={selectedColor} onChange={setSelectedColor} note={noteText} onNoteChange={setNoteText} onSave={handleSave} onBack={handleBackToDraw} />`; delete `formatNoteDate`; drop imports `saveItem`, `appendLog`, `generateId`, `ColorPicker`.
`ManualPracticeScreen.tsx`: `handleSave` uses `const logId = recordPractice({ item: selectedItem, color: selectedColor, note: noteText })`; same `NoteList compact` and `RatePanel` (onBack = `handleBack`); remove the top "← Back" in the rate phase? — keep it (unchanged UX). Drop now-unused imports.
`ItemProgressScreen.tsx`: notes section becomes
```tsx
{notes.length > 0 && (
  <div className="mt-8">
    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Notes</h2>
    <NoteList notes={notes} />
  </div>
)}
```
- [ ] **Step 4: Run** `npm test`, `npm run lint`.
- [ ] **Step 5: Commit** `refactor: shared RatePanel and NoteList; practice screens save through recordPractice`

---

### Task 7: Archive instead of delete

**Files:**
- Modify: `src/types.ts` (Item), `src/storage.ts`, `src/itemList.ts`, `src/screens/PracticeSessionScreen.tsx`, `src/screens/ManualPracticeScreen.tsx`, `src/screens/ActivityDashboardScreen.tsx`, `src/screens/PracticeChooserScreen.tsx`, `src/screens/AddEditItemScreen.tsx`, `src/screens/ItemProgressScreen.tsx`, `src/screens/ManageItemsScreen.tsx`, `src/screens/StatsScreen.tsx`
- Test: `src/tests/storage.test.ts`, `src/tests/itemList.test.ts`, `src/tests/itemsScreens.test.tsx`, `src/tests/manualPractice.test.tsx`, `src/tests/practiceSession.test.tsx`

**Interfaces:**
- Produces: `Item.archivedAt?: string`; `getActiveItems(activityId: string): Item[]`; `ItemListFilter.archived: boolean` (URL `archived=1`).

- [ ] **Step 1: Write failing tests**

`storage.test.ts`:
```ts
describe('archived items', () => {
  it('getActiveItems leaves archived items out; getItems keeps them', () => {
    saveItem(makeItem({ id: 'a' }))
    saveItem(makeItem({ id: 'b', archivedAt: '2026-05-01T18:00:00.000Z' }))
    expect(getActiveItems('act-1').map(i => i.id)).toEqual(['a'])
    expect(getItems('act-1')).toHaveLength(2)
  })

  it('the chart stops counting an archived item after its archive day', () => {
    saveActivity(makeActivity())
    saveItem(makeItem({ id: 'a', color: 'red', createdAt: '2026-05-01T18:00:00.000Z', archivedAt: '2026-05-02T18:00:00.000Z' }))
    saveItem(makeItem({ id: 'b', color: 'green', createdAt: '2026-05-01T18:00:00.000Z' }))
    appendLog(makeLog({ id: 'l1', itemId: 'b', practicedAt: '2026-05-02T18:00:00.000Z', colorBefore: 'green', colorAfter: 'green' }))
    appendLog(makeLog({ id: 'l2', itemId: 'b', practicedAt: '2026-05-03T18:00:00.000Z', colorBefore: 'green', colorAfter: 'green' }))
    expect(getColorDistributionByDay('act-1')).toEqual([
      { date: '2026-05-02', red: 1, yellow: 0, green: 1 },
      { date: '2026-05-03', red: 0, yellow: 0, green: 1 },
    ])
  })
})
```
`itemList.test.ts`:
```ts
it('hides archived items unless showing archived, which shows only them', () => {
  const items = [makeItem({ id: 'a', name: 'A' }), makeItem({ id: 'b', name: 'B', archivedAt: '2026-05-01T00:00:00.000Z' })]
  const base = { query: '', colors: new Set<Color>(), tags: new Set<string>() }
  expect(filterAndSortItems(items, { ...base, archived: false }, 'name-asc', {}).map(i => i.id)).toEqual(['a'])
  expect(filterAndSortItems(items, { ...base, archived: true }, 'name-asc', {}).map(i => i.id)).toEqual(['b'])
})

it('keeps the archived view in the URL', () => {
  const view = readListView(new URLSearchParams('archived=1'))
  expect(view.archived).toBe(true)
  expect(writeListView(view).toString()).toBe('archived=1')
})
```
(use the file's existing item factory; add `archived: false` wherever existing tests build an `ItemListFilter`.)

`manualPractice.test.tsx`:
```tsx
it('leaves archived items out', () => {
  seed()
  saveItem({ id: 'c', activityId: 'act-1', name: 'Shower', color: 'red', createdAt: '2026-01-01T00:00:00.000Z', archivedAt: '2026-02-01T00:00:00.000Z' })
  renderScreen()
  expect(screen.queryByRole('button', { name: /Shower/ })).toBeNull()
})
```
`practiceSession.test.tsx`:
```tsx
describe('archived items', () => {
  it('never draws archived items', () => {
    saveActivity(activity())
    saveItem({ ...item('a', 'Slab problem', []), archivedAt: '2026-02-01T00:00:00.000Z' })
    saveItem({ ...item('b', 'Roof problem', []), color: 'green' })
    renderSession()
    click('Start — practice all')
    expect(screen.getByText('Roof problem')).toBeInTheDocument()
    expect(screen.getByText('0 / 1 done')).toBeInTheDocument()
  })
})
```
`itemsScreens.test.tsx`:
```tsx
describe('archiving', () => {
  it('Archive on the edit screen hides the item from the list', () => {
    seed()
    renderAt('/activity/act-1/manage/a/edit')
    fireEvent.click(screen.getByRole('button', { name: 'Archive trick' }))
    expect(getItems('act-1').find(i => i.id === 'a')!.archivedAt).toBeDefined()
    expect(screen.queryByText('Mills Mess')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Archived' }))
    expect(screen.getByText('Mills Mess')).toBeInTheDocument()
  })

  it('an archived item can be unarchived from its page', () => {
    seed()
    saveItem(item('a', 'Mills Mess', { archivedAt: '2026-09-22T18:00:00.000Z', tags: ['3-ball', 'hard'] }))
    renderAt('/activity/act-1/manage/a')
    expect(screen.getByText('Archived on September 22, 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Unarchive' }))
    expect(getItems('act-1').find(i => i.id === 'a')!.archivedAt).toBeUndefined()
    expect(screen.queryByText(/Archived on/)).toBeNull()
  })

  it('an archived item can be deleted permanently after confirming', () => {
    seed()
    saveItem(item('a', 'Mills Mess', { archivedAt: '2026-09-22T18:00:00.000Z' }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt('/activity/act-1/manage/a')
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(getItems('act-1').map(i => i.id)).toEqual(['b'])
    expect(getLogs()).toEqual([])
  })

  it('adding a name used by an archived item says to unarchive it', () => {
    seed()
    saveItem(item('a', 'Mills Mess', { archivedAt: '2026-09-22T18:00:00.000Z' }))
    renderAt('/activity/act-1/manage/add')
    fireEvent.change(screen.getByPlaceholderText('trick name'), { target: { value: 'mills mess' } })
    fireEvent.click(screen.getByRole('button', { name: 'Struggled' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add trick' }))
    expect(screen.getByText('An archived trick has that name — unarchive it instead.')).toBeInTheDocument()
  })
})
```
(import `vi` from vitest and `getItems`, `getLogs` from storage.)

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**

`types.ts` Item gains:
```ts
  /** Set when the item is archived: kept with its history, but out of practice and the lists. */
  archivedAt?: string
```
`storage.ts`:
```ts
/** The activity's items that aren't archived — what practice and the dashboard use. */
export function getActiveItems(activityId: string): Item[] {
  return getItems(activityId).filter(i => !i.archivedAt)
}
```
In `getColorDistributionByDay` add `const archivedOn = new Map(items.filter(i => i.archivedAt).map(i => [i.id, localDateKey(i.archivedAt!)]))` and in the per-item loop `if ((archivedOn.get(item.id) ?? '9999-12-31') < date) continue`.

`itemList.ts`: `ItemListFilter` gains `/** Show only archived items (otherwise archived items are hidden). */ archived: boolean`; `readListView` sets `archived: params.get('archived') === '1'`; `writeListView` adds `if (view.archived) params.set('archived', '1')` after the tags; `filterAndSortItems` adds `Boolean(item.archivedAt) === filter.archived &&` to the keep condition.

Screens:
- `PracticeSessionScreen`: both `getItems(activity.id)` → `getActiveItems(activity.id)` (initial state, `drawNextItem`, `handleUndo`).
- `ManualPracticeScreen`, `PracticeChooserScreen`, `ActivityDashboardScreen` (counts), `StatsScreen` (`allItems` for the "Total" tile): `getItems` → `getActiveItems`.
- `AddEditItemScreen`: `allActivityTags` from `getActiveItems`; duplicate check:
```ts
    const duplicate = getItems(activityId!).find(
      i => i.name.toLowerCase() === name.trim().toLowerCase() && i.id !== existingItem?.id
    )
    if (duplicate) {
      setError(duplicate.archivedAt
        ? `An archived ${label} has that name — unarchive it instead.`
        : `A ${label} with that name already exists.`)
      return
    }
```
  Replace `handleDelete` and its button with:
```tsx
  function handleArchive() {
    if (!existingItem) return
    saveItem({ ...existingItem, archivedAt: new Date().toISOString() })
    navigate(`/activity/${activityId}/manage`, { replace: true })
  }
  …
  {isEditing && existingItem && !existingItem.archivedAt && (
    <button type="button" onClick={handleArchive} className="text-slate-400 text-sm font-medium py-2 w-full text-center">
      Archive {label}
    </button>
  )}
```
- `ItemProgressScreen`: hold the item in state so Unarchive re-renders: `const [item, setItem] = useState(() => activity ? getItems(activity.id).find(i => i.id === itemId) ?? null : null)`. Under the tags:
```tsx
{item.archivedAt && (
  <div className="bg-slate-800 rounded-xl px-4 py-3 mb-2 flex flex-col gap-2">
    <p className="text-sm text-slate-300">Archived on {formatLongDate(item.archivedAt)}</p>
    <div className="flex gap-2">
      <button onClick={handleUnarchive} className="flex-1 bg-violet-600 hover:bg-violet-500 rounded-lg py-2 text-sm font-semibold">Unarchive</button>
      <button onClick={handleDelete} className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg py-2 text-sm text-red-300">Delete permanently</button>
    </div>
  </div>
)}
```
  with
```ts
  function handleUnarchive() {
    const restored = { ...item!, archivedAt: undefined }
    saveItem(restored)
    setItem(restored)
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${item!.name}" and its practice history? This cannot be undone.`)) return
    deleteItemWithLogs(item!.id)
    navigate(`/activity/${activityId}/manage`, { replace: true })
  }
```
- `ManageItemsScreen`: `allTags` from non-archived items; `activeFilterCount = colors.size + tags.size + (view.archived ? 1 : 0)`; in the filter panel after the colour chips add `<ToggleChip selected={view.archived} onClick={() => update({ archived: !view.archived })}>Archived</ToggleChip>` in the same row; "Clear filters" also resets `archived: false`; archived rows get `opacity-60` on the Link and an `<span className="text-xs text-slate-500">Archived</span>` next to the name; the "Showing N of M" total uses non-archived items unless `view.archived`.
- [ ] **Step 4: Run** `npm test`, `npm run lint`.
- [ ] **Step 5: Commit** `feat: archive items instead of deleting them`

---

### Task 8: Auto Practice session resume

**Files:**
- Create: `src/sessionResume.ts`
- Modify: `src/screens/PracticeSessionScreen.tsx`
- Test: `src/tests/sessionResume.test.ts` (new), `src/tests/practiceSession.test.tsx`

**Interfaces:**
- Consumes: `getActiveItems` (Task 7), `getTodayPracticedItemIds`, `drawFrom`.
- Produces: `SessionEntry`, `SavedSession`, `saveSession(activityId, session)`, `loadSession(activityId, today?)`, `clearSession(activityId)`.

- [ ] **Step 1: Write failing tests**

`src/tests/sessionResume.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { saveSession, loadSession, clearSession, type SavedSession } from '../sessionResume'

const session = (o: Partial<SavedSession> = {}): SavedSession => ({
  day: '2026-10-25', tags: ['V3'], colors: ['red'], advanced: null, skipped: ['x'],
  sessionLog: [{ name: 'Box', colorBefore: 'red', colorAfter: 'green' }], currentItemId: 'a', ...o,
})

describe('session resume storage', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('round-trips a session for the same day', () => {
    saveSession('act-1', session())
    expect(loadSession('act-1', '2026-10-25')).toEqual(session())
    expect(loadSession('act-2', '2026-10-25')).toBeNull()
  })

  it("discards another day's session", () => {
    saveSession('act-1', session({ day: '2026-10-24' }))
    expect(loadSession('act-1', '2026-10-25')).toBeNull()
    expect(localStorage.getItem('practice-app:auto-session:act-1')).toBeNull()
  })

  it('treats damaged data as nothing to resume', () => {
    localStorage.setItem('practice-app:auto-session:act-1', '{oops')
    expect(loadSession('act-1', '2026-10-25')).toBeNull()
    localStorage.setItem('practice-app:auto-session:act-1', JSON.stringify({ day: '2026-10-25', tags: 'V3' }))
    expect(loadSession('act-1', '2026-10-25')).toBeNull()
  })

  it('clearSession removes it', () => {
    saveSession('act-1', session())
    clearSession('act-1')
    expect(loadSession('act-1', '2026-10-25')).toBeNull()
  })

  it('never throws when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(() => saveSession('act-1', session())).not.toThrow()
    expect(loadSession('act-1', '2026-10-25')).toBeNull()
  })
})
```
`practiceSession.test.tsx` — change `renderSession` to return `render(...)` so tests can `unmount()`, then add:
```tsx
describe('resuming a session', () => {
  it('reopening Auto Practice continues where it was, with the summary', () => {
    seed()
    const first = renderSession()
    startWith('V3')
    first.unmount()

    renderSession()
    expect(screen.getByText('Slab problem')).toBeInTheDocument()
    expect(screen.getByText(/Filter: V3/)).toBeInTheDocument()
    rateCurrent()
    click('End session')
    expect(screen.getByText('You practiced 1 item')).toBeInTheDocument()
  })

  it('keeps the summary of items rated before the app restarted', () => {
    seed()
    const first = renderSession()
    startWith('V3')
    rateCurrent()
    first.unmount()

    renderSession()
    click('End session')
    expect(screen.getByText('You practiced 1 item')).toBeInTheDocument()
  })

  it('draws a fresh item when the saved current item was practised', () => {
    seed()
    const first = renderSession()
    startWith('V3')
    first.unmount()
    recordPractice({ item: getItems('act-1').find(i => i.id === 'a')!, color: 'green' })

    renderSession()
    expect(screen.getByText('All done with your current filter.')).toBeInTheDocument()
  })

  it('Exit ends the session', () => {
    seed()
    const first = renderSession()
    startWith('V3')
    click('Exit')
    first.unmount()

    renderSession()
    expect(screen.getByText('What are you focusing on?')).toBeInTheDocument()
  })
})
```
(import `recordPractice`, `getItems` from `../storage`.)

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**

`src/sessionResume.ts`:
```ts
import type { Color } from './types'
import { localDateKey } from './dates'
import { isColor } from './palette'

/**
 * Keeps an Auto Practice session going across app restarts (iOS often
 * reloads a home-screen app that was in the background). This is temporary
 * screen state, not user data, so it lives in localStorage rather than the
 * database, and only for the day it started. Never touches the legacy
 * `practice:*` keys.
 */

export interface SessionEntry {
  name: string
  colorBefore: Color
  colorAfter: Color
}

export interface SavedSession {
  /** Local 'YYYY-MM-DD' the session belongs to. */
  day: string
  tags: string[]
  colors: Color[]
  advanced: string | null
  skipped: string[]
  sessionLog: SessionEntry[]
  /** The item on screen, or null between items. */
  currentItemId: string | null
}

const key = (activityId: string) => `practice-app:auto-session:${activityId}`

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === 'string')

function isSavedSession(v: unknown): v is SavedSession {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return typeof s.day === 'string' && isStrings(s.tags) && Array.isArray(s.colors) && s.colors.every(isColor) &&
    (s.advanced === null || typeof s.advanced === 'string') && isStrings(s.skipped) &&
    Array.isArray(s.sessionLog) && (s.currentItemId === null || typeof s.currentItemId === 'string')
}

export function saveSession(activityId: string, session: SavedSession): void {
  try {
    localStorage.setItem(key(activityId), JSON.stringify(session))
  } catch {
    // Storage unavailable: the session just won't survive a restart.
  }
}

/** Today's saved session for the activity, or null. Another day's session is discarded. */
export function loadSession(activityId: string, today: string = localDateKey(new Date())): SavedSession | null {
  try {
    const raw = localStorage.getItem(key(activityId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isSavedSession(parsed)) return null
    if (parsed.day !== today) {
      clearSession(activityId)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearSession(activityId: string): void {
  try {
    localStorage.removeItem(key(activityId))
  } catch {
    // Nothing to do.
  }
}
```
`PracticeSessionScreen.tsx` changes:
1. Initial state from a resumed session (all in `useState` initialisers):
```ts
  const [resumed] = useState(() => (activity ? loadSession(activity.id) : null))
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set(resumed?.tags ?? []))
  const [activeColors, setActiveColors] = useState<Set<Color>>(() => new Set(resumed?.colors ?? []))
  const [advancedFilter, setAdvancedFilter] = useState<string | null>(() => resumed?.advanced ?? null)
  const [sessionLog, setSessionLog] = useState<SessionEntry[]>(() => resumed?.sessionLog ?? [])
  const [skippedItemIds, setSkippedItemIds] = useState<Set<string>>(() => new Set(resumed?.skipped ?? []))
  // Where a resumed session picks up: its item if still due, otherwise the next draw.
  const [start] = useState<{ phase: Phase; item: Item | null; exhausted: boolean }>(() => {
    if (!activity || !resumed) return { phase: 'setup', item: null, exhausted: false }
    const active = getActiveItems(activity.id)
    const saved = active.find(i => i.id === resumed.currentItemId)
    if (saved && !getTodayPracticedItemIds(activity.id).has(saved.id) && !resumed.skipped.includes(saved.id)) {
      return { phase: 'draw', item: saved, exhausted: false }
    }
    const filter = { tags: new Set(resumed.tags), colors: new Set(resumed.colors), advanced: resumed.advanced }
    const result = drawFrom(activity, active, filter, new Set(resumed.skipped))
    return result.kind === 'item'
      ? { phase: 'draw', item: result.item, exhausted: false }
      : { phase: 'done', item: null, exhausted: result.kind === 'filter-exhausted' }
  })
  const [phase, setPhase] = useState<Phase>(start.phase)
  const [currentItem, setCurrentItem] = useState<Item | null>(start.item)
  const [filterExhausted, setFilterExhausted] = useState(start.exhausted)
```
(declare `activeTags`/`activeColors`/`advancedFilter` before `start` is computed; `start` reads `resumed` directly so order relative to the other states only needs `activity` and `resumed`.)
2. A helper that writes the session from explicit values (state setters are async):
```ts
  function remember(next: { log?: SessionEntry[]; skipped?: Set<string>; currentItemId: string | null }) {
    if (!activity) return
    saveSession(activity.id, {
      day: localDateKey(new Date()),
      tags: [...activeTags],
      colors: [...activeColors],
      advanced: advancedFilter,
      skipped: [...(next.skipped ?? skippedItemIds)],
      sessionLog: next.log ?? sessionLog,
      currentItemId: next.currentItemId,
    })
  }
```
3. `drawNextItem({ skipped = skippedItemIds, log = sessionLog } = {})` — after computing `result`, call `remember({ log, skipped, currentItemId: result.kind === 'item' ? result.item.id : null })`.
4. `handleSkip`: `drawNextItem({ skipped: updated })`.
5. `handleSave`:
```ts
    const entry = { name: currentItem.name, colorBefore, colorAfter: selectedColor }
    const log = [...sessionLog, entry]
    setSessionLog(log)
    …
    if (activity?.chooseFilterEachItem) openFilterStep(log)
    else drawNextItem({ log })
```
6. `openFilterStep(log = sessionLog)`: also `remember({ log, currentItemId: null })`.
7. `handleUndo`: `const log = sessionLog.slice(0, -1); setSessionLog(log)`; if `phase === 'done'` → `drawNextItem({ log })`, else `setItems(getActiveItems(activity.id)); remember({ log, currentItemId: currentItem?.id ?? null })`.
8. `handleExit` and the "Back to <activity>" button of `SessionCompleteDone` call `clearSession(activity.id)` before navigating.
9. The "Change filter" → `setPhase('setup')` path keeps the stored session; the next draw saves the new filter.
- [ ] **Step 4: Run** `npm test`, `npm run lint` (no new effects; `react-hooks` rules must stay green).
- [ ] **Step 5: Commit** `feat: Auto Practice picks up where it left off after the app restarts`

---

### Task 9: Import validation

**Files:**
- Modify: `src/backup.ts` (`validateImportPayload`, `ImportPayload`, `ImportStats`, stats init), `src/screens/ImportScreen.tsx` (summary)
- Test: `src/tests/backup.test.ts`

**Interfaces:**
- Consumes: `isColor` (Task 1).
- Produces: `ImportPayload.invalidRecords: number`; `ImportStats.invalid: number`.

- [ ] **Step 1: Write failing tests** (append to `backup.test.ts`; reuse its `makeActivity`/`makeItem`/`makeLog`-style factories, named as in that file):
```ts
describe('validateImportPayload: damaged records', () => {
  const file = (o: Record<string, unknown> = {}) => ({
    app: 'practice-app', schemaVersion: 1, exportedAt: '2026-10-01T00:00:00.000Z',
    activities: [makeActivity()], items: [makeItem()], logs: [makeLog()], savedFilters: [], ...o,
  })

  it('keeps valid records from an old backup', () => {
    const p = validateImportPayload({ activities: [makeActivity()], items: [makeItem()], logs: [makeLog()] })!
    expect(p.items).toHaveLength(1)
    expect(p.invalidRecords).toBe(0)
  })

  it('drops records with missing ids, unknown colours or bad dates, and counts them', () => {
    const p = validateImportPayload(file({
      items: [makeItem(), makeItem({ id: 'i2', color: 'blue' as never }), { name: 'no id' }],
      logs: [makeLog(), makeLog({ id: 'l2', practicedAt: 'yesterday' }), makeLog({ id: 'l3', colorAfter: 'purple' as never })],
      savedFilters: [{ id: 'f1', activityId: 'a', name: 'x' }],
    }))!
    expect(p.items).toHaveLength(1)
    expect(p.logs).toHaveLength(1)
    expect(p.savedFilters).toEqual([])
    expect(p.invalidRecords).toBe(5)
  })

  it('drops activities with bad weights or optional fields of the wrong type', () => {
    const p = validateImportPayload(file({
      activities: [makeActivity(), makeActivity({ id: 'a2', weights: { red: -1, yellow: 0, green: 0 } }), makeActivity({ id: 'a3', recencyBias: 'high' as never })],
    }))!
    expect(p.activities).toHaveLength(1)
    expect(p.invalidRecords).toBe(2)
  })

  it('rejects a file whose activities are all damaged', () => {
    expect(validateImportPayload(file({ activities: [{ id: 1 }] }))).toBeNull()
  })

  it('accepts a backup of an empty app', () => {
    expect(validateImportPayload(file({ activities: [], items: [], logs: [] }))).not.toBeNull()
  })

  it('reports skipped damaged records in the import stats', () => {
    const p = validateImportPayload(file({ logs: [makeLog(), { id: 'l2' }] }))!
    expect(executeImport(p, new Map(), new Map()).invalid).toBe(1)
  })
})
```
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** in `backup.ts`:
```ts
const isStr = (v: unknown): v is string => typeof v === 'string'
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isWeight = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const optional = (v: unknown, check: (v: unknown) => boolean) => v === undefined || check(v)

function isValidActivity(v: unknown): v is Activity {
  if (!isRecord(v) || !isRecord(v.weights)) return false
  const w = v.weights
  return isStr(v.id) && isStr(v.name) && isStr(v.itemLabel) && isStr(v.createdAt) &&
    isWeight(w.red) && isWeight(w.yellow) && isWeight(w.green) &&
    optional(v.recencyBias, b => typeof b === 'number' && b >= 0 && b <= 1) &&
    optional(v.chooseFilterEachItem, b => typeof b === 'boolean') &&
    optional(v.itemLabelPlural, isStr)
}

function isValidItem(v: unknown): v is Item {
  return isRecord(v) && isStr(v.id) && isStr(v.activityId) && isStr(v.name) && isStr(v.createdAt) && isColor(v.color) &&
    optional(v.tags, t => Array.isArray(t) && t.every(isStr)) && optional(v.archivedAt, isStr)
}

function isValidLog(v: unknown): v is PracticeLog {
  return isRecord(v) && isStr(v.id) && isStr(v.itemId) && isStr(v.practicedAt) && !Number.isNaN(Date.parse(v.practicedAt)) &&
    isColor(v.colorBefore) && isColor(v.colorAfter) && optional(v.note, isStr) && optional(v.source, s => s === 'edit')
}

function isValidFilter(v: unknown): v is SavedFilter {
  return isRecord(v) && isStr(v.id) && isStr(v.activityId) && isStr(v.name) && isStr(v.expression)
}
```
`ImportPayload` gains `/** Records in the file that were damaged and left out. */ invalidRecords: number`; `ImportStats` gains `invalid: number`. In `validateImportPayload`, after `migrated`:
```ts
  const activities = migrated.activities.filter(isValidActivity)
  if (migrated.activities.length > 0 && activities.length === 0) return null
  const items = migrated.items.filter(isValidItem)
  const logs = migrated.logs.filter(isValidLog)
  const savedFilters = migrated.savedFilters.filter(isValidFilter)
  const invalidRecords = migrated.activities.length - activities.length + migrated.items.length - items.length +
    migrated.logs.length - logs.length + migrated.savedFilters.length - savedFilters.length
  return { exportedAt: …, activities, items, logs, savedFilters, invalidRecords }
```
`executeImport` stats start `{ …, invalid: payload.invalidRecords ?? 0 }`. Test helpers that build `ImportPayload` literals add `invalidRecords: 0` where TypeScript requires it (make the field optional in `ImportPayload` instead if many call sites break: `invalidRecords?: number`).
`ImportScreen` summary: after the stats lines, `{stats.invalid > 0 && <p className="text-amber-400">{stats.invalid} damaged {stats.invalid === 1 ? 'record was' : 'records were'} skipped.</p>}`; the "Nothing to import." condition also requires `stats.invalid === 0`.
- [ ] **Step 4: Run** `npm test`, `npm run lint`.
- [ ] **Step 5: Commit** `feat: import skips and reports damaged records`

---

### Task 10: Export first — `ConfirmDestructive`, delete activity, import confirm step

**Files:**
- Create: `src/components/ConfirmDestructive.tsx`
- Modify: `src/backup.ts` (`planImport`, `applyImport`, `removalSummary`), `src/screens/ActivityDashboardScreen.tsx`, `src/screens/ImportScreen.tsx`
- Test: `src/tests/backup.test.ts`, `src/tests/activityScreens.test.tsx`, `src/tests/importScreen.test.tsx` (new)

**Interfaces:**
- Produces: `ImportPlan { records: DataSnapshot; remove: { activityIds: string[]; itemIds: string[] }; stats: ImportStats }`; `planImport(payload, actRes, itemRes): ImportPlan`; `applyImport(plan): ImportStats`; `removalSummary(plan): { activities: string[]; items: number; reps: number }`; `executeImport` unchanged signature. `ConfirmDestructive({ message, action, onConfirm, onCancel })`.

- [ ] **Step 1: Write failing tests**

`backup.test.ts`:
```ts
describe('planImport', () => {
  it('works out the import without saving anything', () => {
    saveActivity(makeActivity({ id: 'old', name: 'Juggling' }))
    const payload = validateImportPayload({ activities: [makeActivity({ id: 'new', name: 'Juggling' })], items: [], logs: [] })!
    const plan = planImport(payload, new Map([['new', 'replace']]), new Map())
    expect(plan.remove.activityIds).toEqual(['old'])
    expect(getActivities().map(a => a.id)).toEqual(['old'])
    applyImport(plan)
    expect(getActivities().map(a => a.name)).toEqual(['Juggling'])
    expect(getActivities()[0].id).not.toBe('old')
  })

  it('summarises what would be removed, counting reps only', () => {
    saveActivity(makeActivity({ id: 'old', name: 'Juggling' }))
    saveItem(makeItem({ id: 'i1', activityId: 'old', color: 'red' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1' }))
    saveItem(makeItem({ id: 'i1', activityId: 'old', color: 'green' })) // an edit, not a rep
    const payload = validateImportPayload({ activities: [makeActivity({ id: 'new', name: 'Juggling' })], items: [], logs: [] })!
    expect(removalSummary(planImport(payload, new Map([['new', 'replace']]), new Map())))
      .toEqual({ activities: ['Juggling'], items: 1, reps: 1 })
  })
})
```
(import `planImport`, `applyImport`, `removalSummary`, and storage helpers as needed.)

`activityScreens.test.tsx` — replace the two `window.confirm` delete tests with (mock export at top of file):
```tsx
vi.mock('../backup', async importOriginal => {
  const actual = await importOriginal<typeof import('../backup')>()
  return { ...actual, exportData: vi.fn() }
})
import { exportData } from '../backup'

describe('deleting an activity', () => {
  function openDelete() {
    seed()
    renderAt('/activity/act-1')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete activity' }))
  }

  it('is not offered on the Home screen cards', () => { /* unchanged */ })

  it('says what will be removed and can delete without a backup', () => {
    openDelete()
    expect(screen.getByText(/Deletes "Juggling", its 1 trick and 0 reps/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete without backup' }))
    expect(getActivities()).toEqual([])
    expect(getSnapshot().items).toEqual([])
    expect(screen.getByText('No activities yet. Add one to get started.')).toBeInTheDocument()
  })

  it('exports first, then deletes', async () => {
    vi.mocked(exportData).mockResolvedValue(true)
    openDelete()
    fireEvent.click(screen.getByRole('button', { name: 'Export backup, then delete' }))
    expect(await screen.findByText('No activities yet. Add one to get started.')).toBeInTheDocument()
    expect(exportData).toHaveBeenCalled()
  })

  it('does nothing when the export is cancelled', async () => {
    vi.mocked(exportData).mockResolvedValue(false)
    openDelete()
    fireEvent.click(screen.getByRole('button', { name: 'Export backup, then delete' }))
    await waitFor(() => expect(exportData).toHaveBeenCalled())
    expect(getActivities()).toHaveLength(1)
  })

  it('Cancel keeps everything', () => {
    openDelete()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(getActivities()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Delete activity' })).toBeInTheDocument()
  })
})
```
`src/tests/importScreen.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../backup', async importOriginal => {
  const actual = await importOriginal<typeof import('../backup')>()
  return { ...actual, exportData: vi.fn() }
})

import ImportScreen from '../screens/ImportScreen'
import { saveActivity, saveItem, getActivities, getItems } from '../storage'

const activity = { id: 'old', name: 'Juggling', itemLabel: 'trick', weights: { red: 1, yellow: 0, green: 0 }, createdAt: '2026-01-01T00:00:00.000Z' }

function chooseFile(content: object) {
  const input = document.querySelector('input[type=file]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File([JSON.stringify(content)], 'backup.json', { type: 'application/json' })] } })
}

function renderImport() {
  render(
    <MemoryRouter initialEntries={['/import']}>
      <Routes>
        <Route path="/import" element={<ImportScreen />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Import: replacing data', () => {
  it('asks before an import that removes data, then applies it', async () => {
    saveActivity(activity)
    saveItem({ id: 'i1', activityId: 'old', name: 'Box', color: 'red', createdAt: '2026-01-01T00:00:00.000Z' })
    renderImport()
    chooseFile({ activities: [{ ...activity, id: 'new' }], items: [], logs: [] })
    fireEvent.click(await screen.findByRole('button', { name: /Replace with imported/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
    expect(screen.getByText(/Replaces Juggling/)).toBeInTheDocument()
    expect(getItems('old')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Import without backup' }))
    expect(screen.getByText('Import complete.')).toBeInTheDocument()
    expect(getActivities().map(a => a.id)).not.toContain('old')
  })

  it('Cancel leaves the data alone', async () => {
    saveActivity(activity)
    renderImport()
    chooseFile({ activities: [{ ...activity, id: 'new' }], items: [], logs: [] })
    fireEvent.click(await screen.findByRole('button', { name: /Replace with imported/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(getActivities().map(a => a.id)).toEqual(['old'])
  })
})
```
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**

`backup.ts`: rename the body of `executeImport` into `planImport` that returns `{ records: { activities: newActivities, items: newItems, logs: newLogs, savedFilters: newFilters }, remove: { activityIds: removeActivityIds, itemIds: removeItemIds }, stats }` instead of calling `importRecords`. Then:
```ts
/** Saves a planned import (one atomic write). */
export function applyImport(plan: ImportPlan): ImportStats {
  importRecords(plan.records, plan.remove)
  return plan.stats
}

export function executeImport(
  payload: ImportPayload,
  actResolutions: Map<string, ActivityResolution>,
  itemResolutions: Map<string, ItemResolution>,
): ImportStats {
  return applyImport(planImport(payload, actResolutions, itemResolutions))
}

/** What a plan would permanently remove from this phone: activity names, and items and reps in total. */
export function removalSummary(plan: ImportPlan): { activities: string[]; items: number; reps: number } {
  const { activities, items, logs } = getSnapshot()
  const actIds = new Set(plan.remove.activityIds)
  const itemIds = new Set(plan.remove.itemIds)
  for (const item of items) if (actIds.has(item.activityId)) itemIds.add(item.id)
  return {
    activities: activities.filter(a => actIds.has(a.id)).map(a => a.name),
    items: itemIds.size,
    reps: logs.filter(l => itemIds.has(l.itemId) && isRep(l)).length,
  }
}
```
`src/components/ConfirmDestructive.tsx`:
```tsx
import { useState } from 'react'
import { exportData } from '../backup'
import { capitalize } from '../labels'

interface Props {
  message: string
  /** The verb for the buttons, e.g. "delete" or "import". */
  action: string
  onConfirm: () => void
  onCancel: () => void
}

/** Asks before something that can't be undone, offering to export a backup first. */
export default function ConfirmDestructive({ message, action, onConfirm, onCancel }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  async function exportThenConfirm() {
    setError(null)
    setExporting(true)
    try {
      if (await exportData()) onConfirm()
    } catch (e) {
      setError(`Couldn't export: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div role="group" aria-label="Confirm" className="bg-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <p className="text-sm text-slate-200">{message} This can't be undone.</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={() => void exportThenConfirm()}
        disabled={exporting}
        className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold disabled:opacity-40"
      >
        Export backup, then {action}
      </button>
      <button onClick={onConfirm} className="w-full bg-slate-700 hover:bg-slate-600 rounded-xl py-3 text-sm text-red-300">
        {capitalize(action)} without backup
      </button>
      <button onClick={onCancel} className="w-full text-slate-400 text-sm py-2">Cancel</button>
    </div>
  )
}
```
`ActivityDashboardScreen.tsx`: state `const [confirmingDelete, setConfirmingDelete] = useState(false)`; `handleDeleteActivity` loses the `window.confirm` (just deletes and navigates). In Settings, render in place of the Delete button:
```tsx
{confirmingDelete ? (
  <div className="mt-6 mb-2">
    <ConfirmDestructive
      message={deleteMessage}
      action="delete"
      onConfirm={handleDeleteActivity}
      onCancel={() => setConfirmingDelete(false)}
    />
  </div>
) : (
  <button onClick={() => setConfirmingDelete(true)} className="mt-6 mb-2 text-red-400 text-sm font-medium py-2 w-full text-center">
    Delete activity
  </button>
)}
```
with (computed when rendering Settings)
```ts
  const allItems = getItems(activity.id)
  const reps = Object.values(getPracticeCountByItem(activity.id)).reduce((a, b) => a + b, 0)
  const deleteMessage = `Deletes "${activity.name}", its ${allItems.length} ${allItems.length === 1 ? activity.itemLabel : pluralLabel(activity)} and ${reps} ${reps === 1 ? 'rep' : 'reps'}.`
```
`ImportScreen.tsx`: `type WizardStep = 'select' | 'activity' | 'item' | 'confirm' | 'summary'`; state `const [plan, setPlan] = useState<ImportPlan | null>(null)`; helper
```ts
  /** Applies the import, first asking if it would remove anything already on this phone. */
  function finish(next: ImportPlan) {
    if (next.remove.activityIds.length > 0 || next.remove.itemIds.length > 0) {
      setPlan(next)
      setStep('confirm')
    } else {
      setStats(applyImport(next))
      setStep('summary')
    }
  }
```
Every `setStats(executeImport(a, b, c)); setStep('summary')` pair becomes `finish(planImport(a, b, c))`. New step:
```tsx
{step === 'confirm' && plan && (() => {
  const removal = removalSummary(plan)
  const replaces = removal.activities.length > 0 ? `Replaces ${removal.activities.join(', ')}. ` : ''
  return (
    <>
      <h1 className="text-xl font-bold mb-4">Before importing</h1>
      <ConfirmDestructive
        message={`${replaces}Permanently removes ${removal.items} ${removal.items === 1 ? 'item' : 'items'} and ${removal.reps} ${removal.reps === 1 ? 'rep' : 'reps'} now on this phone.`}
        action="import"
        onConfirm={() => { setStats(applyImport(plan)); setStep('summary') }}
        onCancel={() => { setPlan(null); setPayload(null); setStep('select') }}
      />
    </>
  )
})()}
```
- [ ] **Step 4: Run** `npm test`, `npm run lint`.
- [ ] **Step 5: Commit** `feat: offer a backup before deleting an activity or replacing data on import`

---

### Task 11: Version on Home

**Files:**
- Create: `src/env.d.ts`
- Modify: `vite.config.ts`, `src/screens/HomeScreen.tsx`
- Test: `src/tests/activityScreens.test.tsx`

**Interfaces:**
- Produces: global `__APP_VERSION__: string`.

- [ ] **Step 1: Failing test** (activityScreens.test.tsx):
```tsx
describe('Home', () => {
  it('shows the app version', () => {
    renderAt('/')
    expect(screen.getByText(/^Version \S+ · \w{3} \d{1,2}, \d{4}$/)).toBeInTheDocument()
  })
})
```
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `vite.config.ts`:
```ts
import { execSync } from 'node:child_process'
…
/** "3c760fd · Oct 25, 2026": the commit and build date, shown on Home. */
function appVersion(): string {
  let sha = process.env.GITHUB_SHA?.slice(0, 7)
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch {
      sha = 'dev'
    }
  }
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${sha} · ${date}`
}

export default defineConfig({
  base: '/practice-app/',
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  …
```
`src/env.d.ts`:
```ts
/** The commit and build date, injected by vite.config.ts. */
declare const __APP_VERSION__: string
```
`HomeScreen.tsx`, after the Import button: `<p className="text-xs text-center text-slate-600 mt-6">Version {__APP_VERSION__}</p>`.
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run build`.
- [ ] **Step 5: Commit** `feat: show the app version on Home`

---

### Task 12: WebKit end-to-end test in CI

**Files:**
- Create: `playwright.config.ts`, `e2e/persistence.spec.ts`, `tsconfig.e2e.json`
- Modify: `package.json` (devDependency, script), `tsconfig.json` (reference), `vite.config.ts` (vitest exclude), `.gitignore`, `.github/workflows/deploy.yml`

- [ ] **Step 1: Install** `npm install -D @playwright/test` then `npx playwright install webkit`.
- [ ] **Step 2: Write the test** `e2e/persistence.spec.ts`:
```ts
import { test, expect, type Page } from '@playwright/test'

/** Number of practice logs saved in IndexedDB (not just in memory). */
function savedLogCount(page: Page): Promise<number> {
  return page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('practice-app')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const req = open.result.transaction('logs').objectStore('logs').count()
      req.onsuccess = () => { open.result.close(); resolve(req.result) }
      req.onerror = () => reject(req.error)
    }
  }))
}

test('a rating is saved to the database and survives a reload', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '+ Add Activity' }).click()
  await page.getByPlaceholder('Activity name (e.g. Juggling)').fill('Juggling')
  await page.getByPlaceholder('Item label, singular (e.g. trick, route)').fill('trick')
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  await page.getByRole('button', { name: /Juggling/ }).click()
  await page.getByRole('button', { name: 'Tricks' }).click()
  await page.getByRole('button', { name: '+ Add trick' }).click()
  await page.getByPlaceholder('trick name').fill('Mills Mess')
  await page.getByRole('button', { name: 'Struggled' }).click()
  await page.getByRole('button', { name: 'Add trick' }).click()

  await page.getByRole('button', { name: 'Practice' }).click()
  await page.getByRole('button', { name: /Manual Practice/ }).click()
  await page.getByRole('button', { name: /Mills Mess/ }).click()
  await page.getByRole('button', { name: 'Solid' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved "Mills Mess"')).toBeVisible()

  await expect.poll(() => savedLogCount(page)).toBe(1)
  await page.goto('./#/')
  await page.reload()
  await expect(page.getByText('Practiced today')).toBeVisible()
  await page.getByRole('button', { name: /Juggling/ }).click()
  await expect(page.getByRole('link', { name: /green/i })).toContainText('1')
})
```
- [ ] **Step 3: Config**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test'

// Runs the production build in WebKit (Safari's engine) on an iPhone-sized screen.
// Build first: `npm run build && npm run test:e2e`.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173/practice-app/', trace: 'retain-on-failure' },
  projects: [{ name: 'iPhone WebKit', use: { ...devices['iPhone 13'] } }],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/practice-app/',
    reuseExistingServer: !process.env.CI,
  },
})
```
`tsconfig.e2e.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.e2e.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["node"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true
  },
  "include": ["e2e", "playwright.config.ts"]
}
```
`tsconfig.json` references gain `{ "path": "./tsconfig.e2e.json" }`. `vite.config.ts` test block: `exclude: [...configDefaults.exclude, 'e2e/**']` with `import { defineConfig, configDefaults } from 'vitest/config'`. `package.json` scripts: `"test:e2e": "playwright test"`. `.gitignore`: `test-results/`, `playwright-report/`. `deploy.yml` after `npm run build`:
```yaml
      - run: npx playwright install --with-deps webkit
      - run: npm run test:e2e
```
- [ ] **Step 4: Run** `npm run build && npm run test:e2e` — PASS; `npm test`, `npm run lint` — PASS / 0.
- [ ] **Step 5: Commit** `test: WebKit end-to-end check that ratings survive a reload`

---

### Task 13: Docs, final verification, ship

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1:** `CLAUDE.md` — under "Rules that protect the user's data" add:
  - Save practice ratings with `recordPractice()` (log + colour in one transaction). `saveItem()` logs a colour change as an edit (`source: 'edit'`); practice-only queries must skip those with `isRep()` from `src/logs.ts`.
  - Items are archived (`archivedAt`), not deleted, from the UI. Practice, the dashboard and tag pickers use `getActiveItems()`; history and stats keep archived items.
  - Auto Practice resume state lives in localStorage under `practice-app:auto-session:*` (`src/sessionResume.ts`); it's disposable UI state.
  Under "Conventions": list ratings with `RATINGS`/`RATING_ORDER` from `src/palette.ts`; pluralise item labels with `pluralLabel()`; activity screens get their activity from `useActivity()`. Under "Commands": `npm run test:e2e` (build first; WebKit via Playwright).
- [ ] **Step 2:** `README.md` — add `npm run test:e2e` to the command list; add `labels.ts`, `logs.ts`, `sessionResume.ts`, `useActivity.ts` and `e2e/` to the layout; in "Using it" mention archiving (Edit → Archive; Items → Filter → Archived to find them) and the version line on Home.
- [ ] **Step 3: Verify** `npm run lint` (0 problems), `npm test`, `npm run build`, `npm run test:e2e` — all pass; read the output.
- [ ] **Step 4: Commit** `docs: rules and layout for the reliability batch`
- [ ] **Step 5: Ship** — push the branch, wait for its CI run to pass, merge to `main` (fast-forward), push `main`, watch the deploy run.
