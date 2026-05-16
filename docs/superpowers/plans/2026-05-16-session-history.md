# Session History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a History screen per activity that shows past practice sessions — date, item count, and which items changed color rating.

**Architecture:** Sessions are derived at read time by grouping existing `PracticeLog` records by calendar day. A new `getSessionHistory` storage function handles all the data work. A new `HistoryScreen` component renders the list. A new route and a dashboard button complete the navigation.

**Tech Stack:** React 19, TypeScript, React Router v7, Tailwind CSS, Vitest + jsdom for tests, localStorage for persistence.

---

## File Structure

| File | Change |
|------|--------|
| `src/storage.ts` | Add `SessionSummary` interface + `getSessionHistory()` |
| `src/tests/storage.test.ts` | Add tests for `getSessionHistory` |
| `src/screens/HistoryScreen.tsx` | **New** — renders the session history list |
| `src/App.tsx` | Add `/activity/:activityId/history` route |
| `src/screens/ActivityDashboardScreen.tsx` | Add History button between Stats and Manage |

---

### Task 1: Add `getSessionHistory` to storage (with tests)

**Files:**
- Modify: `src/storage.ts`
- Modify: `src/tests/storage.test.ts`

The function groups logs by calendar day, counts distinct items per day, and collects color changes (using the last log per item per day when an item appears multiple times).

- [ ] **Step 1: Write the failing tests**

Open `src/tests/storage.test.ts`. Add these imports at the top (alongside the existing ones):

```ts
import { getSessionHistory } from '../storage'
import type { SessionSummary } from '../storage'
```

Then add this describe block at the bottom of the file:

```ts
describe('getSessionHistory', () => {
  it('returns empty array when there are no logs', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1' }))
    expect(getSessionHistory('act-1')).toEqual([])
  })

  it('returns one session for logs on the same day', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1', name: 'Mills Mess' }))
    saveItem(makeItem({ id: 'i2', activityId: 'act-1', name: 'Shower' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'yellow' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i2', practicedAt: '2026-05-16T10:05:00.000Z', colorBefore: 'yellow', colorAfter: 'yellow' }))
    const sessions = getSessionHistory('act-1')
    expect(sessions).toHaveLength(1)
    expect(sessions[0].date).toBe('2026-05-16')
    expect(sessions[0].itemCount).toBe(2)
  })

  it('returns two sessions for logs on different days, newest first', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-14T10:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    const sessions = getSessionHistory('act-1')
    expect(sessions).toHaveLength(2)
    expect(sessions[0].date).toBe('2026-05-16')
    expect(sessions[1].date).toBe('2026-05-14')
  })

  it('itemCount counts distinct items, not total log entries', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-16T09:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'yellow' }))
    const sessions = getSessionHistory('act-1')
    expect(sessions[0].itemCount).toBe(1)
  })

  it('changes only includes items where color actually changed', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1', name: 'Mills Mess' }))
    saveItem(makeItem({ id: 'i2', activityId: 'act-1', name: 'Shower' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'yellow' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i2', practicedAt: '2026-05-16T10:05:00.000Z', colorBefore: 'yellow', colorAfter: 'yellow' }))
    const sessions = getSessionHistory('act-1')
    expect(sessions[0].changes).toHaveLength(1)
    expect(sessions[0].changes[0].itemName).toBe('Mills Mess')
    expect(sessions[0].changes[0].colorBefore).toBe('red')
    expect(sessions[0].changes[0].colorAfter).toBe('yellow')
  })

  it('excludes logs for items not in the given activity', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1' }))
    saveItem(makeItem({ id: 'i2', activityId: 'act-2' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i2', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    const sessions = getSessionHistory('act-1')
    expect(sessions[0].itemCount).toBe(1)
  })

  it('for multiple logs of the same item in one day, uses the last log for change detection', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1', name: 'Mills Mess' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-16T09:00:00.000Z', colorBefore: 'red', colorAfter: 'yellow' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'yellow', colorAfter: 'yellow' }))
    const sessions = getSessionHistory('act-1')
    // Last log for i1: yellow → yellow (no change)
    expect(sessions[0].changes).toHaveLength(0)
  })

  it('skips logs for deleted items gracefully', () => {
    // i1 is NOT saved — simulates a deleted item
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'yellow' }))
    const sessions = getSessionHistory('act-1')
    expect(sessions).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test
```

Expected: all `getSessionHistory` tests fail with "is not a function" or similar.

- [ ] **Step 3: Add `SessionSummary` and `getSessionHistory` to `src/storage.ts`**

Add the interface and function at the bottom of `src/storage.ts`:

```ts
export interface SessionSummary {
  date: string
  itemCount: number
  changes: { itemName: string; colorBefore: Color; colorAfter: Color }[]
}

export function getSessionHistory(activityId: string): SessionSummary[] {
  const items = getItems(activityId)
  const itemMap = new Map(items.map(i => [i.id, i.name]))
  const itemIds = new Set(items.map(i => i.id))

  const logs = getLogs().filter(l => itemIds.has(l.itemId))

  const byDate = new Map<string, PracticeLog[]>()
  for (const log of logs) {
    const date = log.practicedAt.slice(0, 10)
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(log)
  }

  const sessions: SessionSummary[] = []
  for (const [date, dateLogs] of byDate) {
    const practicedItemIds = new Set(dateLogs.map(l => l.itemId))

    const lastLogByItem = new Map<string, PracticeLog>()
    for (const log of [...dateLogs].sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))) {
      lastLogByItem.set(log.itemId, log)
    }

    const changes = [...lastLogByItem.values()]
      .filter(l => l.colorBefore !== l.colorAfter)
      .map(l => ({
        itemName: itemMap.get(l.itemId)!,
        colorBefore: l.colorBefore,
        colorAfter: l.colorAfter,
      }))

    sessions.push({ date, itemCount: practicedItemIds.size, changes })
  }

  return sessions.sort((a, b) => b.date.localeCompare(a.date))
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npm test
```

Expected: all tests pass, including the new `getSessionHistory` suite.

- [ ] **Step 5: Commit**

```
git add src/storage.ts src/tests/storage.test.ts
git commit -m "feat: add getSessionHistory storage function"
```

---

### Task 2: Create HistoryScreen

**Files:**
- Create: `src/screens/HistoryScreen.tsx`

- [ ] **Step 1: Create `src/screens/HistoryScreen.tsx`**

```tsx
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getActivities, getSessionHistory } from '../storage'
import ColorDot from '../components/ColorDot'

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function HistoryScreen() {
  const { activityId = '' } = useParams<{ activityId: string }>()
  const navigate = useNavigate()

  const activity = getActivities().find(a => a.id === activityId)
  if (!activity) {
    navigate('/')
    return null
  }

  const sessions = getSessionHistory(activityId)

  return (
    <div className="p-4">
      <Link to={`/activity/${activityId}`} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>

      <h1 className="text-lg font-bold mb-4">{activity.name} History</h1>

      {sessions.length === 0 ? (
        <p className="text-slate-400 text-sm">No sessions recorded yet — start practicing!</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map(session => (
            <div key={session.date} className="bg-slate-800 rounded-xl p-4">
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-semibold text-slate-100">{formatDate(session.date)}</span>
                <span className="text-slate-400 text-xs">
                  {session.itemCount} {session.itemCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              {session.changes.length > 0 ? (
                <div className="flex flex-col gap-1.5 mt-2">
                  {session.changes.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-200">
                      <span>{c.itemName}</span>
                      <ColorDot color={c.colorBefore} size="sm" />
                      <span className="text-slate-400">→</span>
                      <ColorDot color={c.colorAfter} size="sm" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm mt-1">No ratings changed</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```
git add src/screens/HistoryScreen.tsx
git commit -m "feat: add HistoryScreen"
```

---

### Task 3: Wire up route and dashboard button

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/screens/ActivityDashboardScreen.tsx`

- [ ] **Step 1: Add the route to `src/App.tsx`**

Current `src/App.tsx` (relevant section):

```tsx
import HomeScreen from './screens/HomeScreen'
import ActivityDashboardScreen from './screens/ActivityDashboardScreen'
import PracticeSessionScreen from './screens/PracticeSessionScreen'
import ManageItemsScreen from './screens/ManageItemsScreen'
import AddEditItemScreen from './screens/AddEditItemScreen'
import StatsScreen from './screens/StatsScreen'
```

Replace with:

```tsx
import HomeScreen from './screens/HomeScreen'
import ActivityDashboardScreen from './screens/ActivityDashboardScreen'
import PracticeSessionScreen from './screens/PracticeSessionScreen'
import ManageItemsScreen from './screens/ManageItemsScreen'
import AddEditItemScreen from './screens/AddEditItemScreen'
import StatsScreen from './screens/StatsScreen'
import HistoryScreen from './screens/HistoryScreen'
```

Current routes in `src/App.tsx`:

```tsx
<Route path="/activity/:activityId/stats" element={<StatsScreen />} />
```

Add after it:

```tsx
<Route path="/activity/:activityId/history" element={<HistoryScreen />} />
```

- [ ] **Step 2: Add the History button to `src/screens/ActivityDashboardScreen.tsx`**

Find the existing Stats and Manage buttons (around line 158–169):

```tsx
        <button
          onClick={() => navigate(`/activity/${activityId}/stats`)}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold"
        >
          Stats
        </button>
        <button
          onClick={() => navigate(`/activity/${activityId}/manage`)}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold capitalize"
        >
          Manage {activity.itemLabel}s
        </button>
```

Replace with:

```tsx
        <button
          onClick={() => navigate(`/activity/${activityId}/stats`)}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold"
        >
          Stats
        </button>
        <button
          onClick={() => navigate(`/activity/${activityId}/history`)}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold"
        >
          History
        </button>
        <button
          onClick={() => navigate(`/activity/${activityId}/manage`)}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold capitalize"
        >
          Manage {activity.itemLabel}s
        </button>
```

- [ ] **Step 3: Run tests and build**

```
npm test
npm run build
```

Expected: all tests pass, build succeeds with no errors.

- [ ] **Step 4: Manual smoke test**

Start dev server: `npm run dev`

Open the app and:
1. Navigate to an activity that has practice history → tap **History** → confirm sessions appear with dates, item counts, and color changes
2. Navigate to an activity with no history → confirm "No sessions recorded yet" message
3. Check an activity where items changed color → confirm the before/after dots appear correctly
4. Tap **← Back** → confirm it returns to the activity dashboard

- [ ] **Step 5: Commit and push**

```
git add src/App.tsx src/screens/ActivityDashboardScreen.tsx
git commit -m "feat: wire up History route and dashboard button"
git push
```
