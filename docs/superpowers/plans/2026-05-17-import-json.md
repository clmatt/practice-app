# Import JSON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user restore or merge data from a previously exported backup JSON file via a multi-step wizard at `/import`.

**Architecture:** A dedicated `/import` route renders `ImportScreen`, a wizard managing all state locally through four steps: file select → activity conflict resolution → item conflict resolution → summary. Pure functions (`validateImportPayload`, `findActivityConflicts`, `findItemConflicts`, `executeImport`) are exported from `ImportScreen.tsx` and tested separately. All imported entities receive fresh IDs from `generateId()`; log `itemId` references are remapped via a `Map<oldId, newId>` before saving.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest + jsdom.

**Run tests with:** `& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 10`

**Run build with:** `& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vite\bin\vite.js" build 2>&1 | Select-Object -Last 10`

---

## File Structure

| File | Change |
|------|--------|
| `src/storage.ts` | Add `deleteItemWithLogs(itemId: string)` |
| `src/screens/ImportScreen.tsx` | New file: pure functions + wizard component |
| `src/tests/importScreen.test.ts` | New file: tests for pure functions |
| `src/screens/HomeScreen.tsx` | Add "Import data" button below "Export data" |
| `src/App.tsx` | Add `/import` route |

---

## Task 1: Add `deleteItemWithLogs` to storage

**Files:**
- Modify: `src/storage.ts`
- Modify: `src/tests/storage.test.ts`

- [ ] **Step 1: Add function to `src/storage.ts`**

Open `src/storage.ts`. After the `deleteItem` function (currently around line 72), add:

```ts
export function deleteItemWithLogs(itemId: string): void {
  save(KEYS.items, load<Item>(KEYS.items).filter(i => i.id !== itemId))
  save(KEYS.logs, load<PracticeLog>(KEYS.logs).filter(l => l.itemId !== itemId))
}
```

- [ ] **Step 2: Add test to `src/tests/storage.test.ts`**

Open `src/tests/storage.test.ts`. Add this import at the top with the other imports:

```ts
import {
  getActivities, saveActivity, deleteActivity,
  getItems, saveItem, deleteItem, deleteItemWithLogs,
  getLogs, appendLog, getTodayPracticedItemIds,
  getSessionHistory,
} from '../storage'
```

Then add a new `describe` block at the bottom of the file:

```ts
describe('deleteItemWithLogs', () => {
  it('deletes the item and all its logs atomically', () => {
    saveItem(makeItem({ id: 'item-1', activityId: 'act-1' }))
    saveItem(makeItem({ id: 'item-2', activityId: 'act-1' }))
    appendLog(makeLog({ id: 'l1', itemId: 'item-1' }))
    appendLog(makeLog({ id: 'l2', itemId: 'item-2' }))
    appendLog(makeLog({ id: 'l3', itemId: 'item-1' }))
    deleteItemWithLogs('item-1')
    expect(getItems('act-1').map(i => i.id)).toEqual(['item-2'])
    expect(getLogs().map(l => l.id)).toEqual(['l2'])
  })
})
```

- [ ] **Step 3: Run tests**

```
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 10
```

Expected: 35 tests pass (34 existing + 1 new).

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Picco\Desktop\Practice App" add src/storage.ts src/tests/storage.test.ts
git -C "C:\Users\Picco\Desktop\Practice App" commit -m "feat: add deleteItemWithLogs to storage"
```

---

## Task 2: Pure import utilities + tests (TDD)

**Files:**
- Create: `src/screens/ImportScreen.tsx` (stub component + exported pure functions)
- Create: `src/tests/importScreen.test.ts`

- [ ] **Step 1: Create `src/screens/ImportScreen.tsx` with types and pure functions**

```tsx
import {
  getActivities, getItems, getLogs, getAllItems,
  saveActivity, saveItem, appendLog, deleteActivity, deleteItemWithLogs,
} from '../storage'
import { generateId } from '../utils'
import type { Activity, Item, PracticeLog, Color } from '../types'

export interface ImportPayload {
  exportedAt: string
  activities: Activity[]
  items: Item[]
  logs: PracticeLog[]
}

export type ActivityResolution = 'keep-existing' | 'replace' | 'keep-both' | 'combine'
export type ItemResolution = 'keep-existing' | 'keep-imported' | 'keep-both'

export interface ImportStats {
  activitiesAdded: number
  itemsAdded: number
  logsAdded: number
  skipped: number
}

export interface ItemConflict {
  importedItem: Item
  existingItem: Item
}

export function validateImportPayload(raw: unknown): ImportPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.activities) || !Array.isArray(r.items) || !Array.isArray(r.logs)) return null
  return raw as ImportPayload
}

export function findActivityConflicts(imported: Activity[], existing: Activity[]): Activity[] {
  const existingNames = new Set(existing.map(a => a.name))
  return imported.filter(a => existingNames.has(a.name))
}

export function findItemConflicts(
  importedActivity: Activity,
  _existingActivity: Activity,
  importedItems: Item[],
  existingItems: Item[],
): ItemConflict[] {
  const existingByName = new Map(existingItems.map(i => [i.name, i]))
  return importedItems
    .filter(i => i.activityId === importedActivity.id && existingByName.has(i.name))
    .map(i => ({ importedItem: i, existingItem: existingByName.get(i.name)! }))
}

export function executeImport(
  payload: ImportPayload,
  actResolutions: Map<string, ActivityResolution>,
  itemResolutions: Map<string, ItemResolution>,
): ImportStats {
  const stats: ImportStats = { activitiesAdded: 0, itemsAdded: 0, logsAdded: 0, skipped: 0 }
  const existingActByName = new Map(getActivities().map(a => [a.name, a]))

  for (const impAct of payload.activities) {
    const resolution = actResolutions.get(impAct.id)
    const existingAct = existingActByName.get(impAct.name)

    if (resolution === 'keep-existing') {
      stats.skipped++
      continue
    }

    if (resolution === 'combine' && existingAct) {
      const impItems = payload.items.filter(i => i.activityId === impAct.id)
      const existingItems = getItems(existingAct.id)
      const existingByName = new Map(existingItems.map(i => [i.name, i]))
      const idMap = new Map<string, string>()

      for (const impItem of impItems) {
        const existingItem = existingByName.get(impItem.name)
        const itemRes = itemResolutions.get(impItem.id)

        if (existingItem && itemRes === 'keep-existing') {
          stats.skipped++
          continue
        }
        if (existingItem && itemRes === 'keep-imported') {
          deleteItemWithLogs(existingItem.id)
        }

        const newId = generateId()
        idMap.set(impItem.id, newId)
        saveItem({ ...impItem, id: newId, activityId: existingAct.id })
        stats.itemsAdded++
      }

      for (const log of payload.logs.filter(l => idMap.has(l.itemId))) {
        appendLog({ ...log, id: generateId(), itemId: idMap.get(log.itemId)! })
        stats.logsAdded++
      }
      continue
    }

    if (resolution === 'replace' && existingAct) {
      deleteActivity(existingAct.id)
    }

    const newActId = generateId()
    const actName = resolution === 'keep-both' ? `${impAct.name} (imported)` : impAct.name
    saveActivity({ ...impAct, id: newActId, name: actName })
    stats.activitiesAdded++

    const impItems = payload.items.filter(i => i.activityId === impAct.id)
    const idMap = new Map<string, string>()
    for (const impItem of impItems) {
      const newId = generateId()
      idMap.set(impItem.id, newId)
      saveItem({ ...impItem, id: newId, activityId: newActId })
      stats.itemsAdded++
    }
    for (const log of payload.logs.filter(l => idMap.has(l.itemId))) {
      appendLog({ ...log, id: generateId(), itemId: idMap.get(log.itemId)! })
      stats.logsAdded++
    }
  }

  return stats
}

export default function ImportScreen() {
  return null
}
```

- [ ] **Step 2: Create `src/tests/importScreen.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  validateImportPayload,
  findActivityConflicts,
  findItemConflicts,
  executeImport,
  type ImportPayload,
} from '../screens/ImportScreen'
import { getActivities, getItems, getLogs, saveActivity, saveItem, appendLog } from '../storage'
import type { Activity, Item, PracticeLog } from '../types'

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'act-1',
  name: 'Juggling',
  itemLabel: 'trick',
  weights: { red: 0.6, yellow: 0.3, green: 0.1 },
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'item-1',
  activityId: 'act-1',
  name: 'Mills Mess',
  color: 'red',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makeLog = (overrides: Partial<PracticeLog> = {}): PracticeLog => ({
  id: 'log-1',
  itemId: 'item-1',
  practicedAt: '2026-01-01T10:00:00.000Z',
  colorBefore: 'red',
  colorAfter: 'yellow',
  ...overrides,
})

const makePayload = (overrides: Partial<ImportPayload> = {}): ImportPayload => ({
  exportedAt: '2026-01-01T00:00:00.000Z',
  activities: [],
  items: [],
  logs: [],
  ...overrides,
})

describe('validateImportPayload', () => {
  it('returns null for null input', () => {
    expect(validateImportPayload(null)).toBeNull()
  })

  it('returns null for a non-object', () => {
    expect(validateImportPayload('string')).toBeNull()
  })

  it('returns null if activities is missing', () => {
    expect(validateImportPayload({ items: [], logs: [] })).toBeNull()
  })

  it('returns null if activities is not an array', () => {
    expect(validateImportPayload({ activities: 'x', items: [], logs: [] })).toBeNull()
  })

  it('returns the payload when all arrays are present', () => {
    const payload = { exportedAt: '2026-01-01', activities: [], items: [], logs: [] }
    expect(validateImportPayload(payload)).toEqual(payload)
  })
})

describe('findActivityConflicts', () => {
  it('returns empty array when no name matches', () => {
    const imported = [makeActivity({ name: 'Juggling' })]
    const existing = [makeActivity({ id: 'e1', name: 'Piano' })]
    expect(findActivityConflicts(imported, existing)).toEqual([])
  })

  it('returns the imported activity when its name matches an existing one', () => {
    const imported = [makeActivity({ name: 'Juggling' })]
    const existing = [makeActivity({ id: 'e1', name: 'Juggling' })]
    expect(findActivityConflicts(imported, existing)).toEqual([imported[0]])
  })

  it('returns only the matching imported activities, not all', () => {
    const imported = [
      makeActivity({ id: 'i1', name: 'Juggling' }),
      makeActivity({ id: 'i2', name: 'Piano' }),
    ]
    const existing = [makeActivity({ id: 'e1', name: 'Juggling' })]
    const conflicts = findActivityConflicts(imported, existing)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].id).toBe('i1')
  })

  it('returns empty array when existing list is empty', () => {
    const imported = [makeActivity({ name: 'Juggling' })]
    expect(findActivityConflicts(imported, [])).toEqual([])
  })
})

describe('findItemConflicts', () => {
  it('returns empty array when no item names match', () => {
    const impAct = makeActivity({ id: 'imp-act' })
    const existAct = makeActivity({ id: 'exist-act' })
    const impItems = [makeItem({ id: 'i1', activityId: 'imp-act', name: 'Mills Mess' })]
    const existItems = [makeItem({ id: 'e1', activityId: 'exist-act', name: 'Shower' })]
    expect(findItemConflicts(impAct, existAct, impItems, existItems)).toEqual([])
  })

  it('returns conflict pairs when item names match', () => {
    const impAct = makeActivity({ id: 'imp-act' })
    const existAct = makeActivity({ id: 'exist-act' })
    const impItem = makeItem({ id: 'i1', activityId: 'imp-act', name: 'Mills Mess' })
    const existItem = makeItem({ id: 'e1', activityId: 'exist-act', name: 'Mills Mess' })
    const conflicts = findItemConflicts(impAct, existAct, [impItem], [existItem])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].importedItem).toEqual(impItem)
    expect(conflicts[0].existingItem).toEqual(existItem)
  })

  it('ignores imported items not belonging to the imported activity', () => {
    const impAct = makeActivity({ id: 'imp-act' })
    const existAct = makeActivity({ id: 'exist-act' })
    const wrongActItem = makeItem({ id: 'i1', activityId: 'other-act', name: 'Mills Mess' })
    const existItem = makeItem({ id: 'e1', activityId: 'exist-act', name: 'Mills Mess' })
    expect(findItemConflicts(impAct, existAct, [wrongActItem], [existItem])).toEqual([])
  })
})

describe('executeImport', () => {
  it('imports activity, items, and logs with fresh IDs', () => {
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act' })],
      logs: [makeLog({ id: 'imp-log', itemId: 'imp-item' })],
    })
    executeImport(payload, new Map(), new Map())
    const acts = getActivities()
    expect(acts).toHaveLength(1)
    expect(acts[0].name).toBe('Juggling')
    expect(acts[0].id).not.toBe('imp-act')
    const items = getItems(acts[0].id)
    expect(items).toHaveLength(1)
    expect(items[0].id).not.toBe('imp-item')
    const logs = getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].itemId).toBe(items[0].id)
  })

  it('keep-existing skips the activity and its items entirely', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act' })],
    })
    const stats = executeImport(payload, new Map([['imp-act', 'keep-existing']]), new Map())
    expect(getActivities()).toHaveLength(1)
    expect(getActivities()[0].id).toBe('exist-act')
    expect(stats.skipped).toBe(1)
  })

  it('replace deletes existing activity and imports fresh', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Shower' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess' })],
    })
    executeImport(payload, new Map([['imp-act', 'replace']]), new Map())
    const acts = getActivities()
    expect(acts).toHaveLength(1)
    expect(acts[0].id).not.toBe('exist-act')
    const items = getItems(acts[0].id)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Mills Mess')
  })

  it('keep-both imports with "(imported)" name suffix', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
    })
    executeImport(payload, new Map([['imp-act', 'keep-both']]), new Map())
    const acts = getActivities()
    expect(acts).toHaveLength(2)
    const imported = acts.find(a => a.id !== 'exist-act')!
    expect(imported.name).toBe('Juggling (imported)')
  })

  it('combine merges non-conflicting items into the existing activity without creating a new one', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Shower' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess' })],
    })
    executeImport(payload, new Map([['imp-act', 'combine']]), new Map())
    expect(getActivities()).toHaveLength(1)
    const items = getItems('exist-act')
    expect(items).toHaveLength(2)
    expect(items.map(i => i.name).sort()).toEqual(['Mills Mess', 'Shower'])
  })

  it('combine + item keep-existing discards the imported item and its logs', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Mills Mess' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess' })],
      logs: [makeLog({ id: 'imp-log', itemId: 'imp-item' })],
    })
    const stats = executeImport(
      payload,
      new Map([['imp-act', 'combine']]),
      new Map([['imp-item', 'keep-existing']]),
    )
    expect(getItems('exist-act')).toHaveLength(1)
    expect(getItems('exist-act')[0].id).toBe('exist-item')
    expect(getLogs()).toHaveLength(0)
    expect(stats.skipped).toBe(1)
  })

  it('combine + item keep-imported replaces existing item and its logs', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Mills Mess', color: 'red' }))
    appendLog(makeLog({ id: 'exist-log', itemId: 'exist-item' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess', color: 'green' })],
      logs: [makeLog({ id: 'imp-log', itemId: 'imp-item', colorAfter: 'green' })],
    })
    executeImport(
      payload,
      new Map([['imp-act', 'combine']]),
      new Map([['imp-item', 'keep-imported']]),
    )
    const items = getItems('exist-act')
    expect(items).toHaveLength(1)
    expect(items[0].color).toBe('green')
    expect(items[0].id).not.toBe('exist-item')
    const logs = getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].colorAfter).toBe('green')
  })

  it('combine + item keep-both adds imported alongside existing', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Mills Mess', color: 'red' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess', color: 'green' })],
    })
    executeImport(
      payload,
      new Map([['imp-act', 'combine']]),
      new Map([['imp-item', 'keep-both']]),
    )
    const items = getItems('exist-act')
    expect(items).toHaveLength(2)
    expect(items.every(i => i.name === 'Mills Mess')).toBe(true)
    expect(items.map(i => i.color).sort()).toEqual(['green', 'red'])
  })

  it('returns zero stats for an empty payload', () => {
    const stats = executeImport(makePayload(), new Map(), new Map())
    expect(stats).toEqual({ activitiesAdded: 0, itemsAdded: 0, logsAdded: 0, skipped: 0 })
  })
})
```

- [ ] **Step 3: Run tests**

```
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 10
```

Expected: 56 tests pass (35 existing + 21 new).

- [ ] **Step 4: Build to verify TypeScript**

```
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vite\bin\vite.js" build 2>&1 | Select-Object -Last 10
```

Expected: clean build.

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Picco\Desktop\Practice App" add src/screens/ImportScreen.tsx src/tests/importScreen.test.ts
git -C "C:\Users\Picco\Desktop\Practice App" commit -m "feat: add import utilities and tests (validateImportPayload, findActivityConflicts, findItemConflicts, executeImport)"
```

---

## Task 3: Full `ImportScreen` wizard UI

**Files:**
- Modify: `src/screens/ImportScreen.tsx` (replace stub with full wizard component)

- [ ] **Step 1: Replace the stub export default in `src/screens/ImportScreen.tsx`**

Keep all the exports from Task 2 unchanged. Add this import at the top (after the existing imports):

```tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getPracticeCountByItem } from '../storage'
```

So the full import block becomes:

```tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getActivities, getItems, getLogs, getPracticeCountByItem,
  saveActivity, saveItem, appendLog, deleteActivity, deleteItemWithLogs,
} from '../storage'
import { generateId } from '../utils'
import type { Activity, Item, PracticeLog, Color } from '../types'
```

Then replace the stub default export at the bottom with the full component:

```tsx
const DOT: Record<Color, string> = {
  red: '#dc2626',
  yellow: '#eab308',
  green: '#22c55e',
}

type WizardStep = 'select' | 'activity' | 'item' | 'summary'

export default function ImportScreen() {
  const navigate = useNavigate()
  const [step, setStep] = useState<WizardStep>('select')
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<ImportPayload | null>(null)
  const [actConflicts, setActConflicts] = useState<Activity[]>([])
  const [actIdx, setActIdx] = useState(0)
  const [actResolutions, setActResolutions] = useState<Map<string, ActivityResolution>>(new Map())
  const [selectedActRes, setSelectedActRes] = useState<ActivityResolution>('keep-existing')
  const [applyActAll, setApplyActAll] = useState(false)
  const [itemConflicts, setItemConflicts] = useState<ItemConflict[]>([])
  const [itemIdx, setItemIdx] = useState(0)
  const [itemResolutions, setItemResolutions] = useState<Map<string, ItemResolution>>(new Map())
  const [selectedItemRes, setSelectedItemRes] = useState<ItemResolution>('keep-existing')
  const [applyItemAll, setApplyItemAll] = useState(false)
  const [stats, setStats] = useState<ImportStats | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target!.result as string)
        const parsed = validateImportPayload(raw)
        if (!parsed) {
          setError("This doesn't look like a valid backup file.")
          return
        }
        setError(null)
        const conflicts = findActivityConflicts(parsed.activities, getActivities())
        if (conflicts.length === 0) {
          setStats(executeImport(parsed, new Map(), new Map()))
          setStep('summary')
          return
        }
        setPayload(parsed)
        setActConflicts(conflicts)
        setActIdx(0)
        setSelectedActRes('keep-existing')
        setApplyActAll(false)
        setStep('activity')
      } catch {
        setError("This doesn't look like a valid backup file.")
      }
    }
    reader.readAsText(file)
  }

  function finishActivityConflicts(resolutions: Map<string, ActivityResolution>) {
    const existByName = new Map(getActivities().map(a => [a.name, a]))
    const queue: ItemConflict[] = []
    for (const impAct of (payload?.activities ?? [])) {
      if (resolutions.get(impAct.id) !== 'combine') continue
      const existAct = existByName.get(impAct.name)!
      const impItems = (payload?.items ?? []).filter(i => i.activityId === impAct.id)
      queue.push(...findItemConflicts(impAct, existAct, impItems, getItems(existAct.id)))
    }
    if (queue.length === 0) {
      setStats(executeImport(payload!, resolutions, new Map()))
      setStep('summary')
    } else {
      setItemConflicts(queue)
      setItemIdx(0)
      setSelectedItemRes('keep-existing')
      setApplyItemAll(false)
      setItemResolutions(new Map())
      setStep('item')
    }
  }

  function handleActContinue() {
    const next = new Map(actResolutions)
    if (applyActAll) {
      for (let i = actIdx; i < actConflicts.length; i++) next.set(actConflicts[i].id, selectedActRes)
      setActResolutions(next)
      finishActivityConflicts(next)
    } else {
      next.set(actConflicts[actIdx].id, selectedActRes)
      setActResolutions(next)
      if (actIdx + 1 < actConflicts.length) {
        setActIdx(actIdx + 1)
        setSelectedActRes('keep-existing')
        setApplyActAll(false)
      } else {
        finishActivityConflicts(next)
      }
    }
  }

  function handleItemContinue() {
    const next = new Map(itemResolutions)
    if (applyItemAll) {
      for (let i = itemIdx; i < itemConflicts.length; i++) next.set(itemConflicts[i].importedItem.id, selectedItemRes)
      setItemResolutions(next)
      setStats(executeImport(payload!, actResolutions, next))
      setStep('summary')
    } else {
      next.set(itemConflicts[itemIdx].importedItem.id, selectedItemRes)
      setItemResolutions(next)
      if (itemIdx + 1 < itemConflicts.length) {
        setItemIdx(itemIdx + 1)
        setSelectedItemRes('keep-existing')
        setApplyItemAll(false)
      } else {
        setStats(executeImport(payload!, actResolutions, next))
        setStep('summary')
      }
    }
  }

  const currentActConflict = step === 'activity' && payload ? actConflicts[actIdx] : null
  const existActForConflict = currentActConflict
    ? getActivities().find(a => a.name === currentActConflict.name) ?? null
    : null
  const currentItemConflict = step === 'item' ? itemConflicts[itemIdx] : null

  return (
    <div className="p-4 bg-slate-950 text-slate-100 min-h-screen">

      {/* ── Step 1: File select ── */}
      {step === 'select' && (
        <>
          <Link to="/" className="text-slate-400 text-sm mb-6 block">← Back</Link>
          <h1 className="text-xl font-bold mb-2">Import data</h1>
          <p className="text-slate-400 text-sm mb-6">
            Select a backup file exported from Practice App.
          </p>
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <label className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold text-center block cursor-pointer">
            Choose file
            <input type="file" accept=".json" className="hidden" onChange={handleFile} />
          </label>
        </>
      )}

      {/* ── Step 2: Activity conflict ── */}
      {step === 'activity' && payload && currentActConflict && existActForConflict && (
        <>
          <h1 className="text-xl font-bold mb-1">Import data</h1>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-500">
              Activity conflict {actIdx + 1} of {actConflicts.length}
            </span>
            <div className="flex-1 h-0.5 bg-slate-800 rounded">
              <div
                className="h-full bg-violet-500 rounded transition-all"
                style={{ width: `${((actIdx + 1) / actConflicts.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 mb-4">
            <div className="font-semibold mb-3">{currentActConflict.name}</div>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Existing</div>
                <div className="text-sm text-slate-300">
                  {getItems(existActForConflict.id).length} items ·{' '}
                  {Object.values(getPracticeCountByItem(existActForConflict.id)).reduce((a, b) => a + b, 0)} sessions
                </div>
              </div>
              <div className="w-px bg-slate-700" />
              <div className="flex-1">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Importing</div>
                <div className="text-sm text-slate-300">
                  {payload.items.filter(i => i.activityId === currentActConflict.id).length} items ·{' '}
                  {payload.logs.filter(l =>
                    payload.items.some(i => i.activityId === currentActConflict.id && i.id === l.itemId)
                  ).length} sessions
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-4">
            {(['keep-existing', 'replace', 'keep-both', 'combine'] as ActivityResolution[]).map(res => (
              <button
                key={res}
                onClick={() => setSelectedActRes(res)}
                className={`text-left rounded-xl px-4 py-3 border ${
                  selectedActRes === res
                    ? 'bg-violet-950 border-violet-500'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className={`text-sm font-semibold ${selectedActRes === res ? 'text-violet-300' : ''}`}>
                  {res === 'keep-existing' ? 'Keep existing'
                    : res === 'replace' ? 'Replace with imported'
                    : res === 'keep-both' ? 'Keep both'
                    : 'Combine'}
                </div>
                <div className={`text-xs mt-0.5 ${selectedActRes === res ? 'text-violet-400' : 'text-slate-500'}`}>
                  {res === 'keep-existing' ? 'Ignore the imported version entirely'
                    : res === 'replace' ? 'Overwrite existing with the imported version'
                    : res === 'keep-both'
                      ? `Add imported as "${currentActConflict.name} (imported)" alongside existing`
                      : 'Merge items into existing activity — resolve item conflicts next'}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setApplyActAll(v => !v)}
            className="flex items-center gap-3 w-full bg-slate-800 rounded-xl px-4 py-3 mb-4"
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 ${
              applyActAll ? 'bg-violet-600 border-violet-600' : 'border-slate-500'
            }`}>
              {applyActAll && <span className="text-white text-xs leading-none">✓</span>}
            </div>
            <span className="text-sm text-slate-300">Apply to all remaining activity conflicts</span>
          </button>

          <button
            onClick={handleActContinue}
            className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold"
          >
            Continue →
          </button>
        </>
      )}

      {/* ── Step 3: Item conflict ── */}
      {step === 'item' && currentItemConflict && (
        <>
          <h1 className="text-xl font-bold mb-1">Import data — {
            payload?.activities.find(a =>
              payload.items.find(i => i.id === currentItemConflict.importedItem.id)?.activityId === a.id
            )?.name
          }</h1>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-500">
              Item conflict {itemIdx + 1} of {itemConflicts.length}
            </span>
            <div className="flex-1 h-0.5 bg-slate-800 rounded">
              <div
                className="h-full bg-violet-500 rounded transition-all"
                style={{ width: `${((itemIdx + 1) / itemConflicts.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 mb-4">
            <div className="font-semibold mb-3">{currentItemConflict.importedItem.name}</div>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Existing</div>
                <div className="flex items-center gap-1.5 text-sm text-slate-300">
                  <span style={{ color: DOT[currentItemConflict.existingItem.color] }}>●</span>
                  {currentItemConflict.existingItem.color} ·{' '}
                  {getLogs().filter(l => l.itemId === currentItemConflict.existingItem.id).length} sessions
                </div>
              </div>
              <div className="w-px bg-slate-700" />
              <div className="flex-1">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Importing</div>
                <div className="flex items-center gap-1.5 text-sm text-slate-300">
                  <span style={{ color: DOT[currentItemConflict.importedItem.color] }}>●</span>
                  {currentItemConflict.importedItem.color} ·{' '}
                  {payload!.logs.filter(l => l.itemId === currentItemConflict.importedItem.id).length} sessions
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-4">
            {(['keep-existing', 'keep-imported', 'keep-both'] as ItemResolution[]).map(res => (
              <button
                key={res}
                onClick={() => setSelectedItemRes(res)}
                className={`text-left rounded-xl px-4 py-3 border ${
                  selectedItemRes === res
                    ? 'bg-violet-950 border-violet-500'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className={`text-sm font-semibold ${selectedItemRes === res ? 'text-violet-300' : ''}`}>
                  {res === 'keep-existing' ? 'Keep existing'
                    : res === 'keep-imported' ? 'Keep imported'
                    : 'Keep both'}
                </div>
                <div className={`text-xs mt-0.5 ${selectedItemRes === res ? 'text-violet-400' : 'text-slate-500'}`}>
                  {res === 'keep-existing'
                    ? 'Keep existing item and its history. Discard imported version.'
                    : res === 'keep-imported'
                    ? 'Use imported item. Discard existing history.'
                    : `Add imported as a second "${currentItemConflict.importedItem.name}" with its own history.`}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setApplyItemAll(v => !v)}
            className="flex items-center gap-3 w-full bg-slate-800 rounded-xl px-4 py-3 mb-4"
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 ${
              applyItemAll ? 'bg-violet-600 border-violet-600' : 'border-slate-500'
            }`}>
              {applyItemAll && <span className="text-white text-xs leading-none">✓</span>}
            </div>
            <span className="text-sm text-slate-300">Apply to all remaining item conflicts</span>
          </button>

          <button
            onClick={handleItemContinue}
            className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold"
          >
            Continue →
          </button>
        </>
      )}

      {/* ── Step 4: Summary ── */}
      {step === 'summary' && stats && (
        <>
          <Link to="/" className="text-slate-400 text-sm mb-6 block">← Home</Link>
          <h1 className="text-xl font-bold mb-4">Import complete.</h1>
          {stats.activitiesAdded === 0 && stats.itemsAdded === 0 && stats.logsAdded === 0 ? (
            <p className="text-slate-400 text-sm">Nothing to import.</p>
          ) : (
            <div className="flex flex-col gap-1 text-sm text-slate-300">
              {stats.activitiesAdded > 0 && (
                <p>{stats.activitiesAdded} {stats.activitiesAdded === 1 ? 'activity' : 'activities'} added</p>
              )}
              {stats.itemsAdded > 0 && (
                <p>{stats.itemsAdded} {stats.itemsAdded === 1 ? 'item' : 'items'} added</p>
              )}
              {stats.logsAdded > 0 && (
                <p>{stats.logsAdded} {stats.logsAdded === 1 ? 'session' : 'sessions'} imported</p>
              )}
              {stats.skipped > 0 && (
                <p>{stats.skipped} skipped</p>
              )}
            </div>
          )}
          <button
            onClick={() => navigate('/')}
            className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold mt-6"
          >
            Done
          </button>
        </>
      )}

    </div>
  )
}
```

- [ ] **Step 2: Build to verify TypeScript**

```
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vite\bin\vite.js" build 2>&1 | Select-Object -Last 15
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 3: Run tests to confirm no regressions**

```
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 10
```

Expected: 56 tests pass.

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Picco\Desktop\Practice App" add src/screens/ImportScreen.tsx
git -C "C:\Users\Picco\Desktop\Practice App" commit -m "feat: build ImportScreen multi-step wizard"
```

---

## Task 4: Wire up route and HomeScreen button

**Files:**
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add "Import data" button to `src/screens/HomeScreen.tsx`**

Open `src/screens/HomeScreen.tsx`. Find the existing export button at the bottom:

```tsx
      <button
        onClick={exportData}
        className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 text-center mt-2"
      >
        Export data
      </button>
```

Replace with:

```tsx
      <button
        onClick={exportData}
        className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 text-center mt-2"
      >
        Export data
      </button>
      <button
        onClick={() => navigate('/import')}
        className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 text-center"
      >
        Import data
      </button>
```

- [ ] **Step 2: Add `/import` route to `src/App.tsx`**

Open `src/App.tsx`. Add the import at the top with the other screen imports:

```tsx
import ImportScreen from './screens/ImportScreen'
```

Then find the route block and add the import route. Insert it after the history route:

```tsx
          <Route path="/activity/:activityId/history" element={<HistoryScreen />} />
          <Route path="/import" element={<ImportScreen />} />
```

- [ ] **Step 3: Build to verify TypeScript**

```
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vite\bin\vite.js" build 2>&1 | Select-Object -Last 10
```

Expected: clean build.

- [ ] **Step 4: Run tests**

```
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 10
```

Expected: 56 tests pass.

- [ ] **Step 5: Commit and push**

```
git -C "C:\Users\Picco\Desktop\Practice App" add src/screens/HomeScreen.tsx src/App.tsx
git -C "C:\Users\Picco\Desktop\Practice App" commit -m "feat: wire up /import route and HomeScreen button"
git -C "C:\Users\Picco\Desktop\Practice App" push
```
