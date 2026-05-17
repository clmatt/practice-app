# Item Progress Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-item progress screen showing every practice session grouped into color runs on a vertical timeline, accessible by tapping an item name in Manage Items.

**Architecture:** New `ItemProgressScreen` at `/activity/:activityId/manage/:itemId`. A pure `buildRuns` function groups sorted logs into consecutive same-color runs. The vertical bar and label list share the same per-run pixel heights (`count * 48px`) for alignment. Entry point is the item name in `ManageItemsScreen` becoming a `<Link>`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest + jsdom.

---

## File Structure

| File | Change |
|------|--------|
| `src/screens/ItemProgressScreen.tsx` | New screen + exported `buildRuns` function |
| `src/tests/itemProgress.test.ts` | Unit tests for `buildRuns` |
| `src/App.tsx` | New route `/activity/:activityId/manage/:itemId` |
| `src/screens/ManageItemsScreen.tsx` | Item name `<span>` → `<Link>` |

---

### Task 1: `buildRuns` pure function with tests (TDD)

**Files:**
- Create: `src/screens/ItemProgressScreen.tsx`
- Create: `src/tests/itemProgress.test.ts`

- [ ] **Step 1: Create `src/screens/ItemProgressScreen.tsx` with just the types and `buildRuns`**

```tsx
import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getActivities, getItems, getLogs } from '../storage'
import type { Color, PracticeLog } from '../types'

interface Run {
  color: Color
  count: number
  startDate: string
  endDate: string
}

export function buildRuns(logs: PracticeLog[]): Run[] {
  const sorted = [...logs].sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
  const runs: Run[] = []
  for (const log of sorted) {
    const date = log.practicedAt.slice(0, 10)
    const last = runs[runs.length - 1]
    if (last && last.color === log.colorAfter) {
      last.count++
      last.endDate = date
    } else {
      runs.push({ color: log.colorAfter, count: 1, startDate: date, endDate: date })
    }
  }
  return runs
}

export default function ItemProgressScreen() {
  return null
}
```

The default export is a stub — it gets filled in Task 2.

- [ ] **Step 2: Create `src/tests/itemProgress.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildRuns } from '../screens/ItemProgressScreen'
import type { Color, PracticeLog } from '../types'

const makeLog = (colorAfter: Color, practicedAt: string, colorBefore: Color = 'red'): PracticeLog => ({
  id: practicedAt,
  itemId: 'item-1',
  practicedAt,
  colorBefore,
  colorAfter,
})

describe('buildRuns', () => {
  it('returns empty array for no logs', () => {
    expect(buildRuns([])).toEqual([])
  })

  it('returns single run for one log', () => {
    const runs = buildRuns([makeLog('red', '2026-05-01T10:00:00.000Z')])
    expect(runs).toEqual([{ color: 'red', count: 1, startDate: '2026-05-01', endDate: '2026-05-01' }])
  })

  it('groups consecutive same-color logs into one run', () => {
    const logs = [
      makeLog('yellow', '2026-05-01T10:00:00.000Z'),
      makeLog('yellow', '2026-05-02T10:00:00.000Z'),
      makeLog('yellow', '2026-05-03T10:00:00.000Z'),
    ]
    const runs = buildRuns(logs)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toEqual({ color: 'yellow', count: 3, startDate: '2026-05-01', endDate: '2026-05-03' })
  })

  it('starts a new run when color changes', () => {
    const logs = [
      makeLog('red', '2026-05-01T10:00:00.000Z'),
      makeLog('yellow', '2026-05-02T10:00:00.000Z'),
    ]
    const runs = buildRuns(logs)
    expect(runs).toHaveLength(2)
    expect(runs[0]).toEqual({ color: 'red', count: 1, startDate: '2026-05-01', endDate: '2026-05-01' })
    expect(runs[1]).toEqual({ color: 'yellow', count: 1, startDate: '2026-05-02', endDate: '2026-05-02' })
  })

  it('handles regression — same color appears twice as separate runs', () => {
    const logs = [
      makeLog('yellow', '2026-05-01T10:00:00.000Z'),
      makeLog('green', '2026-05-02T10:00:00.000Z'),
      makeLog('yellow', '2026-05-03T10:00:00.000Z'),
    ]
    const runs = buildRuns(logs)
    expect(runs).toHaveLength(3)
    expect(runs.map(r => r.color)).toEqual(['yellow', 'green', 'yellow'])
  })

  it('sorts logs by practicedAt before grouping', () => {
    const logs = [
      makeLog('yellow', '2026-05-03T10:00:00.000Z'),
      makeLog('red', '2026-05-01T10:00:00.000Z'),
      makeLog('red', '2026-05-02T10:00:00.000Z'),
    ]
    const runs = buildRuns(logs)
    expect(runs).toHaveLength(2)
    expect(runs[0]).toEqual({ color: 'red', count: 2, startDate: '2026-05-01', endDate: '2026-05-02' })
    expect(runs[1]).toEqual({ color: 'yellow', count: 1, startDate: '2026-05-03', endDate: '2026-05-03' })
  })
})
```

- [ ] **Step 3: Run tests to confirm they pass**

```
"C:\Program Files\nodejs\npm.cmd" test 2>&1 | Select-Object -Last 15
```

Expected: all tests pass (28 existing + 5 new = 33 total).

- [ ] **Step 4: Commit**

```
git add src/screens/ItemProgressScreen.tsx src/tests/itemProgress.test.ts
git commit -m "feat: add buildRuns utility for item progress timeline"
```

---

### Task 2: Build `ItemProgressScreen` component and add route

**Files:**
- Modify: `src/screens/ItemProgressScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace the stub in `src/screens/ItemProgressScreen.tsx` with the full component**

Replace the entire file with:

```tsx
import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getActivities, getItems, getLogs } from '../storage'
import type { Color, PracticeLog } from '../types'

interface Run {
  color: Color
  count: number
  startDate: string
  endDate: string
}

export function buildRuns(logs: PracticeLog[]): Run[] {
  const sorted = [...logs].sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
  const runs: Run[] = []
  for (const log of sorted) {
    const date = log.practicedAt.slice(0, 10)
    const last = runs[runs.length - 1]
    if (last && last.color === log.colorAfter) {
      last.count++
      last.endDate = date
    } else {
      runs.push({ color: log.colorAfter, count: 1, startDate: date, endDate: date })
    }
  }
  return runs
}

const BAR_COLOR: Record<Color, string> = {
  red: '#dc2626',
  yellow: '#eab308',
  green: '#22c55e',
}

const TEXT_CLASS: Record<Color, string> = {
  red: 'text-red-400',
  yellow: 'text-yellow-400',
  green: 'text-green-400',
}

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}

export default function ItemProgressScreen() {
  const { activityId, itemId } = useParams<{ activityId: string; itemId: string }>()
  const navigate = useNavigate()

  const activity = getActivities().find(a => a.id === activityId)
  const item = activity ? getItems(activityId!).find(i => i.id === itemId) : undefined

  useEffect(() => {
    if (!activity || !item) navigate('/')
  }, [activity, item, navigate])

  if (!activity || !item) return null

  const logs = getLogs().filter(l => l.itemId === itemId)
  const runs = buildRuns(logs)
  const totalSessions = logs.length

  return (
    <div className="p-4 bg-slate-950 text-slate-100 min-h-screen">
      <Link to={`/activity/${activityId}/manage`} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>

      <h1 className="text-xl font-bold mb-1">{item.name}</h1>
      <p className="text-slate-400 text-sm mb-6">
        <span style={{ color: BAR_COLOR[item.color] }}>●</span>{' '}
        Currently {item.color}
        {totalSessions > 0 && ` · ${totalSessions} session${totalSessions === 1 ? '' : 's'} total`}
      </p>

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
}
```

- [ ] **Step 2: Add the route to `src/App.tsx`**

Open `src/App.tsx`. Add the import at the top with the other screen imports:

```tsx
import ItemProgressScreen from './screens/ItemProgressScreen'
```

Then find the existing manage routes:

```tsx
          <Route path="/activity/:activityId/manage" element={<ManageItemsScreen />} />
          <Route path="/activity/:activityId/manage/add" element={<AddEditItemScreen />} />
          <Route path="/activity/:activityId/manage/:itemId/edit" element={<AddEditItemScreen />} />
```

Replace with:

```tsx
          <Route path="/activity/:activityId/manage" element={<ManageItemsScreen />} />
          <Route path="/activity/:activityId/manage/add" element={<AddEditItemScreen />} />
          <Route path="/activity/:activityId/manage/:itemId" element={<ItemProgressScreen />} />
          <Route path="/activity/:activityId/manage/:itemId/edit" element={<AddEditItemScreen />} />
```

The `/manage/add` route must stay above `/manage/:itemId` so React Router's static-segment preference keeps "add" from being treated as a dynamic `:itemId`. React Router v6+ handles this correctly by preference, but conventional ordering avoids any ambiguity.

- [ ] **Step 3: Build to verify TypeScript**

```
"C:\Program Files\nodejs\npm.cmd" run build 2>&1 | Select-Object -Last 15
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Run tests to confirm no regressions**

```
"C:\Program Files\nodejs\npm.cmd" test 2>&1 | Select-Object -Last 10
```

Expected: 33 tests pass.

- [ ] **Step 5: Commit**

```
git add src/screens/ItemProgressScreen.tsx src/App.tsx
git commit -m "feat: add ItemProgressScreen with vertical color run timeline"
```

---

### Task 3: Link item names in ManageItemsScreen

**Files:**
- Modify: `src/screens/ManageItemsScreen.tsx`

- [ ] **Step 1: Replace the item name `<span>` with a `<Link>`**

Open `src/screens/ManageItemsScreen.tsx`. Find this line (currently line 126):

```tsx
                <span className="flex-1 text-sm">{item.name}</span>
```

Replace with:

```tsx
                <Link
                  to={`/activity/${activityId}/manage/${item.id}`}
                  className="flex-1 text-sm text-violet-400 hover:text-violet-300"
                >
                  {item.name}
                </Link>
```

No other changes needed — `Link` is already imported at the top of the file.

- [ ] **Step 2: Build to verify TypeScript**

```
"C:\Program Files\nodejs\npm.cmd" run build 2>&1 | Select-Object -Last 10
```

Expected: clean build.

- [ ] **Step 3: Run tests**

```
"C:\Program Files\nodejs\npm.cmd" test 2>&1 | Select-Object -Last 10
```

Expected: 33 tests pass.

- [ ] **Step 4: Commit and push**

```
git add src/screens/ManageItemsScreen.tsx
git commit -m "feat: link item names to progress screen in Manage Items"
git push
```
