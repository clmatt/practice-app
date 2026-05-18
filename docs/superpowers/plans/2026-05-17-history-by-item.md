# History By Item Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "By item" tab to the History screen showing each item's color history, and remove the item progress link from Manage Items.

**Architecture:** Three focused changes: (1) remove the item-name link from `ManageItemsScreen` — name becomes plain text; (2) make `ItemProgressScreen`'s back button context-aware via React Router navigation state; (3) add a tab bar to `HistoryScreen` with a new "By item" list view that navigates to `ItemProgressScreen` with `state: { from: 'history' }`.

**Tech Stack:** React 19, TypeScript, React Router v7 (`useSearchParams`, `useLocation`), Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `src/screens/ManageItemsScreen.tsx` | Item name `<Link>` → plain `<span>` |
| `src/screens/ItemProgressScreen.tsx` | Back link reads `location.state?.from` |
| `src/screens/HistoryScreen.tsx` | Add tab bar + By item list view |

---

### Task 1: Remove item-name link from ManageItemsScreen

**Files:**
- Modify: `src/screens/ManageItemsScreen.tsx`

Context: in `ManageItemsScreen`, each list item renders the item name as a `<Link>` to `ItemProgressScreen`. That link is replaced with a plain `<span>`.

- [ ] **Step 1: Replace the item name Link with a span**

In `src/screens/ManageItemsScreen.tsx`, find this block inside the `filteredItems.map(...)`:

```tsx
              <Link
                to={`/activity/${activityId}/manage/${item.id}`}
                className="flex-1 text-sm text-violet-400 hover:text-violet-300"
              >
                {item.name}
              </Link>
```

Replace it with:

```tsx
              <span className="flex-1 text-sm">{item.name}</span>
```

- [ ] **Step 2: Remove the unused Link import if it's no longer needed**

After the edit, check the imports at the top of `ManageItemsScreen.tsx`:

```ts
import { Link, useNavigate, useParams } from 'react-router-dom'
```

`Link` is still used for the `← Back` and `Edit` elements — leave the import unchanged.

- [ ] **Step 3: Build to verify no TypeScript errors**

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vite\bin\vite.js" build 2>&1 | Select-Object -Last 10
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```powershell
git -C "C:\Users\Picco\Desktop\Practice App" add src/screens/ManageItemsScreen.tsx
git -C "C:\Users\Picco\Desktop\Practice App" commit -m "feat: remove item progress link from manage items list"
git -C "C:\Users\Picco\Desktop\Practice App" push
```

---

### Task 2: Make ItemProgressScreen back button context-aware

**Files:**
- Modify: `src/screens/ItemProgressScreen.tsx`

Context: `ItemProgressScreen` always links back to `/activity/${activityId}/manage`. After this task it checks React Router navigation state: if the screen was reached from the History "By item" tab (`state.from === 'history'`), it goes back to `/activity/${activityId}/history?tab=items`; otherwise it goes to `/activity/${activityId}/manage` as before.

- [ ] **Step 1: Add `useLocation` to the react-router-dom import**

In `src/screens/ItemProgressScreen.tsx`, change line 2 from:

```ts
import { Link, useNavigate, useParams } from 'react-router-dom'
```

to:

```ts
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
```

- [ ] **Step 2: Compute `backTo` from navigation state**

Inside the `ItemProgressScreen` component, after the existing `const` declarations (after `const { activityId, itemId } = useParams...`), add:

```tsx
  const location = useLocation()
  const backTo = location.state?.from === 'history'
    ? `/activity/${activityId}/history?tab=items`
    : `/activity/${activityId}/manage`
```

- [ ] **Step 3: Use `backTo` in the back link**

Find the existing back link:

```tsx
      <Link to={`/activity/${activityId}/manage`} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>
```

Replace it with:

```tsx
      <Link to={backTo} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>
```

- [ ] **Step 4: Build to verify no TypeScript errors**

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vite\bin\vite.js" build 2>&1 | Select-Object -Last 10
```

Expected: build succeeds.

- [ ] **Step 5: Run all tests to verify no regressions**

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 10
```

Expected: 68 tests pass.

- [ ] **Step 6: Commit**

```powershell
git -C "C:\Users\Picco\Desktop\Practice App" add src/screens/ItemProgressScreen.tsx
git -C "C:\Users\Picco\Desktop\Practice App" commit -m "feat: context-aware back navigation in ItemProgressScreen"
git -C "C:\Users\Picco\Desktop\Practice App" push
```

---

### Task 3: Add tab bar and By item view to HistoryScreen

**Files:**
- Modify: `src/screens/HistoryScreen.tsx`

Context: `HistoryScreen` currently shows only the session history. This task rewrites it to add a tab bar (`By session` / `By item`) driven by a `?tab=items` URL search param. The `By session` tab is the existing view unchanged. The `By item` tab lists all items alphabetically, each showing its current color, last-practiced date, and session count, tapping through to `ItemProgressScreen` with `state: { from: 'history' }`.

New storage functions used (all already exist in `src/storage.ts`):
- `getItems(activityId)` — list of items
- `getLastPracticedByItem(activityId)` — `Record<string, string>` mapping `itemId` → last ISO timestamp
- `getPracticeCountByItem(activityId)` — `Record<string, number>` mapping `itemId` → session count

- [ ] **Step 1: Replace `src/screens/HistoryScreen.tsx` with the full updated implementation**

```tsx
import { useEffect } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { getActivities, getItems, getSessionHistory, getLastPracticedByItem, getPracticeCountByItem } from '../storage'
import ColorDot from '../components/ColorDot'

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatShortDate(iso: string): string {
  const dateStr = iso.slice(0, 10)
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export default function HistoryScreen() {
  const { activityId = '' } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = searchParams.get('tab') === 'items' ? 'items' : 'sessions'

  const activity = getActivities().find(a => a.id === activityId)

  useEffect(() => {
    if (!activity) navigate('/')
  }, [activity, navigate])

  if (!activity) return null

  const sessions = getSessionHistory(activityId)
  const items = getItems(activityId).sort((a, b) => a.name.localeCompare(b.name))
  const lastPracticedAt = getLastPracticedByItem(activityId)
  const practiceCounts = getPracticeCountByItem(activityId)

  return (
    <div className="p-4">
      <Link to={`/activity/${activityId}`} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>

      <h1 className="text-lg font-bold mb-4">{activity.name} History</h1>

      {/* Tab bar */}
      <div className="flex border-b border-slate-800 mb-4 -mx-4 px-4">
        <button
          onClick={() => setSearchParams({})}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'sessions'
              ? 'text-violet-400 border-violet-400'
              : 'text-slate-400 border-transparent'
          }`}
        >
          By session
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'items' })}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'items'
              ? 'text-violet-400 border-violet-400'
              : 'text-slate-400 border-transparent'
          }`}
        >
          By item
        </button>
      </div>

      {/* By session */}
      {tab === 'sessions' && (
        sessions.length === 0 ? (
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
                    {session.changes.map((c) => (
                      <div key={c.itemName} className="flex items-center gap-2 text-sm text-slate-200">
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
        )
      )}

      {/* By item */}
      {tab === 'items' && (
        items.length === 0 ? (
          <p className="text-slate-400 text-sm">No {activity.itemLabel}s yet — start adding some!</p>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map(item => {
              const lastDate = lastPracticedAt[item.id]
              const count = practiceCounts[item.id] ?? 0
              const subtitle = lastDate
                ? `Last practiced ${formatShortDate(lastDate)} · ${count} session${count === 1 ? '' : 's'}`
                : `Never practiced · 0 sessions`
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(`/activity/${activityId}/manage/${item.id}`, { state: { from: 'history' } })}
                  className="bg-slate-800 rounded-xl px-4 py-3 flex items-center gap-3 text-left w-full"
                >
                  <ColorDot color={item.color} size="md" />
                  <div className="flex-1">
                    <div className="text-sm text-slate-100">{item.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
                  </div>
                  <span className="text-violet-400 text-sm">›</span>
                </button>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vite\bin\vite.js" build 2>&1 | Select-Object -Last 10
```

Expected: build succeeds.

- [ ] **Step 3: Run all tests to verify no regressions**

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 10
```

Expected: 68 tests pass.

- [ ] **Step 4: Commit**

```powershell
git -C "C:\Users\Picco\Desktop\Practice App" add src/screens/HistoryScreen.tsx
git -C "C:\Users\Picco\Desktop\Practice App" commit -m "feat: add By item tab to History screen"
git -C "C:\Users\Picco\Desktop\Practice App" push
```

---

## Self-Review

**Spec coverage:**
- History screen gets By session / By item tabs via `?tab=items` URL param ✓
- By item tab: alphabetical list, color dot, name, `Last practiced [Month Day] · [N] sessions` subtitle ✓
- Never-practiced items: `Never practiced · 0 sessions` ✓
- Tapping an item navigates to `ItemProgressScreen` with `state: { from: 'history' }` ✓
- `ItemProgressScreen` back button uses `location.state?.from` ✓
  - `'history'` → `/activity/${activityId}/history?tab=items` ✓
  - else → `/activity/${activityId}/manage` (unchanged default) ✓
- `ManageItemsScreen` item name link removed, replaced with `<span>` ✓

**Placeholder scan:** No TBDs. All steps contain complete code. ✓

**Type consistency:** `useSearchParams`, `useLocation`, `getItems`, `getLastPracticedByItem`, `getPracticeCountByItem` — all consistent across tasks. ✓
