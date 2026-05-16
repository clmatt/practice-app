# Export JSON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A button on the home screen lets the user download all their app data as a timestamped JSON file.

**Architecture:** Add `exportData()` to `src/utils.ts` — it reads all data via the public storage API, serialises it to JSON, and triggers a browser download via a temporary `<a>` element. `HomeScreen` calls it on button click. No new routes or screens needed.

**Tech Stack:** React 19, TypeScript, Vitest + jsdom (for the unit test), browser `Blob` + `URL.createObjectURL`.

---

## File Structure

| File | Change |
|------|--------|
| `src/utils.ts` | Add `exportData()` and a private `loadAllItems()` helper |
| `src/tests/utils.test.ts` | **New** — unit test for `exportData` |
| `src/screens/HomeScreen.tsx` | Add import + "Export data" button |

---

### Task 1: Add `exportData` to utils with a test

**Files:**
- Modify: `src/utils.ts`
- Create: `src/tests/utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/utils.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveActivity, saveItem, appendLog } from '../storage'
import { exportData } from '../utils'
import type { Activity, Item, PracticeLog } from '../types'

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'act-1',
  name: 'Juggling',
  itemLabel: 'trick',
  weights: { red: 0.6, yellow: 0.3, green: 0.1 },
  createdAt: '2026-05-16T00:00:00.000Z',
  ...overrides,
})

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'item-1',
  activityId: 'act-1',
  name: 'Mills Mess',
  color: 'red',
  createdAt: '2026-05-16T00:00:00.000Z',
  ...overrides,
})

const makeLog = (overrides: Partial<PracticeLog> = {}): PracticeLog => ({
  id: 'log-1',
  itemId: 'item-1',
  practicedAt: '2026-05-16T10:00:00.000Z',
  colorBefore: 'red',
  colorAfter: 'yellow',
  ...overrides,
})

describe('exportData', () => {
  let clickedHref: string | undefined
  let clickedDownload: string | undefined

  beforeEach(() => {
    clickedHref = undefined
    clickedDownload = undefined

    // Mock URL.createObjectURL and URL.revokeObjectURL
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => 'blob:mock-url',
      revokeObjectURL: vi.fn(),
    })

    // Capture the <a> element click
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag)
      if (tag === 'a') {
        vi.spyOn(el, 'click').mockImplementation(() => {
          clickedHref = (el as HTMLAnchorElement).href
          clickedDownload = (el as HTMLAnchorElement).download
        })
      }
      return el
    })
  })

  it('triggers a download with all activities, items, and logs', () => {
    saveActivity(makeActivity())
    saveItem(makeItem())
    appendLog(makeLog())

    exportData()

    expect(clickedDownload).toMatch(/^practice-backup-\d{4}-\d{2}-\d{2}\.json$/)
    expect(clickedHref).toBeDefined()
  })

  it('includes exportedAt timestamp in the payload', () => {
    let capturedBlob: Blob | undefined
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => { capturedBlob = blob; return 'blob:mock-url' },
      revokeObjectURL: vi.fn(),
    })

    exportData()

    expect(capturedBlob).toBeDefined()
    capturedBlob!.text().then(text => {
      const parsed = JSON.parse(text)
      expect(parsed.exportedAt).toBeDefined()
      expect(parsed.activities).toBeInstanceOf(Array)
      expect(parsed.items).toBeInstanceOf(Array)
      expect(parsed.logs).toBeInstanceOf(Array)
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd "C:\Users\Picco\Desktop\Practice App"
"C:\Program Files\nodejs\npm.cmd" test
```

Expected: `exportData` tests fail with "is not a function".

- [ ] **Step 3: Add `exportData` to `src/utils.ts`**

The current `src/utils.ts` contains only `generateId`. Add the new function:

```ts
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

import { getActivities, getLogs } from './storage'
import type { Item, PracticeLog } from './types'

function loadAllItems(): Item[] {
  try {
    return JSON.parse(localStorage.getItem('practice:items') ?? '[]')
  } catch {
    return []
  }
}

export function exportData(): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    activities: getActivities(),
    items: loadAllItems(),
    logs: getLogs(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `practice-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

Note: `import` statements must be at the top of the file in ES modules. Place them before `generateId`:

```ts
import { getActivities, getLogs } from './storage'
import type { Item, PracticeLog } from './types'

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function loadAllItems(): Item[] {
  try {
    return JSON.parse(localStorage.getItem('practice:items') ?? '[]')
  } catch {
    return []
  }
}

export function exportData(): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    activities: getActivities(),
    items: loadAllItems(),
    logs: getLogs(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `practice-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
"C:\Program Files\nodejs\npm.cmd" test
```

Expected: all tests pass (existing 26 + new utils tests).

- [ ] **Step 5: Commit**

```
git add src/utils.ts src/tests/utils.test.ts
git commit -m "feat: add exportData utility"
```

---

### Task 2: Add Export button to HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Add the import**

Open `src/screens/HomeScreen.tsx`. Find the existing imports at the top:

```tsx
import { generateId } from '../utils'
```

Replace with:

```tsx
import { generateId, exportData } from '../utils'
```

- [ ] **Step 2: Add the Export button**

Find the closing `</div>` at the end of the returned JSX (the outermost `<div className="p-4">`). Add the Export button just before that closing tag, after the Add Activity button / form section:

```tsx
      <button
        onClick={exportData}
        className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 text-center mt-2"
      >
        Export data
      </button>
    </div>
```

- [ ] **Step 3: Build and verify**

```
"C:\Program Files\nodejs\npm.cmd" run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit and push**

```
git add src/screens/HomeScreen.tsx
git commit -m "feat: add Export data button to home screen"
git push
```
