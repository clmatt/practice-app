# Mobile App UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app feel native on iPhone by fixing overscroll background bleed, locking all screens to viewport height, and adding a 4-tab bottom navigation bar for activity-level screens.

**Architecture:** A shared `TabBar` component renders at the bottom of every activity-level screen. All screens adopt `h-screen overflow-hidden flex flex-col` with `flex-1 min-h-0 overflow-y-auto` inner regions. A new `PracticeChooserScreen` consolidates the two practice entry points.

**Tech Stack:** React 19, React Router v7, TypeScript, Tailwind CSS v3, Vitest + Testing Library

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/index.css` | Edit | Fix html/body/root background + height |
| `src/components/TabBar.tsx` | Create | Shared 4-tab bottom bar |
| `src/tests/tabBar.test.ts` | Create | Unit tests for active-tab logic |
| `src/screens/PracticeChooserScreen.tsx` | Create | Auto vs Manual practice picker |
| `src/App.tsx` | Edit | Add practice-chooser route |
| `src/screens/ActivityDashboardScreen.tsx` | Edit | Strip nav buttons, add TabBar |
| `src/screens/HomeScreen.tsx` | Edit | Convert to h-screen layout |
| `src/screens/ManageItemsScreen.tsx` | Edit | Convert to h-screen layout, add TabBar |
| `src/screens/StatsScreen.tsx` | Edit | Add TabBar |
| `src/screens/ItemProgressScreen.tsx` | Edit | Convert to h-screen layout, add TabBar |
| `src/screens/AddEditItemScreen.tsx` | Edit | Add TabBar |

---

## Task 1: Fix Global CSS

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace index.css content**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Prevent iOS auto-zoom — outside @layer so it overrides Tailwind utility font sizes */
input, textarea, select {
  font-size: 16px !important;
}

@layer base {
  html, body {
    @apply bg-slate-950;
    height: 100%;
  }

  #root {
    height: 100%;
  }

  /* Remove grey tap highlight on interactive elements */
  * {
    -webkit-tap-highlight-color: transparent;
    /* Prevent long-press text selection on non-input elements */
    user-select: none;
    /* Suppress Safari's link long-press callout ("Open in New Tab" etc.) */
    -webkit-touch-callout: none;
  }

  /* Re-enable text selection inside inputs */
  input, textarea {
    user-select: text;
  }

  /* Respect safe areas (notch, home indicator) */
  body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
    /* Prevent rubber-band overscroll revealing white background */
    overscroll-behavior: none;
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix: set html/body/root background and height to prevent overscroll white bleed"
```

---

## Task 2: Create TabBar Component

**Files:**
- Create: `src/components/TabBar.tsx`
- Create: `src/tests/tabBar.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/tabBar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getActiveTab } from '../components/TabBar'

describe('getActiveTab', () => {
  const id = 'abc123'

  it('returns home for the activity root', () => {
    expect(getActiveTab(`/activity/${id}`, id)).toBe('home')
  })

  it('returns practice for practice-chooser', () => {
    expect(getActiveTab(`/activity/${id}/practice-chooser`, id)).toBe('practice')
  })

  it('returns items for manage root', () => {
    expect(getActiveTab(`/activity/${id}/manage`, id)).toBe('items')
  })

  it('returns items for manage sub-routes', () => {
    expect(getActiveTab(`/activity/${id}/manage/add`, id)).toBe('items')
    expect(getActiveTab(`/activity/${id}/manage/item1`, id)).toBe('items')
    expect(getActiveTab(`/activity/${id}/manage/item1/edit`, id)).toBe('items')
  })

  it('returns stats for stats route', () => {
    expect(getActiveTab(`/activity/${id}/stats`, id)).toBe('stats')
  })

  it('returns stats for stats with query params', () => {
    expect(getActiveTab(`/activity/${id}/stats?tab=items&color=red`, id)).toBe('stats')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tabBar
```

Expected: FAIL — `getActiveTab` not found.

- [ ] **Step 3: Create TabBar.tsx**

Create `src/components/TabBar.tsx`:

```tsx
import { useLocation, useNavigate } from 'react-router-dom'

interface TabBarProps {
  activityId: string
}

export type Tab = 'home' | 'practice' | 'items' | 'stats'

export function getActiveTab(pathname: string, activityId: string): Tab {
  const base = `/activity/${activityId}`
  const path = pathname.split('?')[0]
  if (path.startsWith(`${base}/manage`)) return 'items'
  if (path.startsWith(`${base}/stats`)) return 'stats'
  if (path === `${base}/practice-chooser`) return 'practice'
  return 'home'
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function BarChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

const TABS = [
  { id: 'home' as Tab, label: 'Home', icon: HomeIcon },
  { id: 'practice' as Tab, label: 'Practice', icon: PlayIcon },
  { id: 'items' as Tab, label: 'Items', icon: ListIcon },
  { id: 'stats' as Tab, label: 'Stats', icon: BarChartIcon },
]

export default function TabBar({ activityId }: TabBarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = getActiveTab(pathname, activityId)

  const routes: Record<Tab, string> = {
    home: `/activity/${activityId}`,
    practice: `/activity/${activityId}/practice-chooser`,
    items: `/activity/${activityId}/manage`,
    stats: `/activity/${activityId}/stats`,
  }

  return (
    <div
      className="shrink-0 bg-slate-900 border-t border-slate-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => navigate(routes[id])}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 ${
              active === id ? 'text-violet-400' : 'text-slate-500'
            }`}
          >
            <Icon />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tabBar
```

Expected: 6 tests pass.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/TabBar.tsx src/tests/tabBar.test.ts
git commit -m "feat: add TabBar component with active-tab detection"
```

---

## Task 3: Create PracticeChooserScreen and Add Route

**Files:**
- Create: `src/screens/PracticeChooserScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create PracticeChooserScreen.tsx**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getActivities, getItems } from '../storage'
import type { Activity, Item } from '../types'
import TabBar from '../components/TabBar'

export default function PracticeChooserScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    if (!activityId) { navigate('/'); return }
    const a = getActivities().find(a => a.id === activityId)
    if (!a) { navigate('/'); return }
    setActivity(a)
    setItems(getItems(activityId))
  }, [activityId, navigate])

  if (!activity) return null

  const hasItems = items.length > 0

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100">
      <div className="flex-1 min-h-0 flex flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold mb-2">Practice</h1>

        {!hasItems && (
          <p className="text-slate-400 text-sm mb-2">
            Add some {activity.itemLabel}s first to start practicing.
          </p>
        )}

        <button
          onClick={() => navigate(`/activity/${activityId}/practice`)}
          disabled={!hasItems}
          className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl p-5 text-left disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="font-bold text-lg">Auto Practice</div>
          <div className="text-sm text-violet-200 mt-1">Items drawn based on your weights</div>
        </button>

        <button
          onClick={() => navigate(`/activity/${activityId}/manual-practice`)}
          disabled={!hasItems}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl p-5 text-left disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="font-bold text-lg">Manual Practice</div>
          <div className="text-sm text-slate-400 mt-1">Choose items yourself</div>
        </button>
      </div>

      <TabBar activityId={activityId!} />
    </div>
  )
}
```

- [ ] **Step 2: Add route to App.tsx**

In `src/App.tsx`, add the import and route. The full file after changes:

```tsx
import { HashRouter, Routes, Route } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import ActivityDashboardScreen from './screens/ActivityDashboardScreen'
import PracticeSessionScreen from './screens/PracticeSessionScreen'
import ManualPracticeScreen from './screens/ManualPracticeScreen'
import ManageItemsScreen from './screens/ManageItemsScreen'
import AddEditItemScreen from './screens/AddEditItemScreen'
import ItemProgressScreen from './screens/ItemProgressScreen'
import StatsScreen from './screens/StatsScreen'
import ImportScreen from './screens/ImportScreen'
import PracticeChooserScreen from './screens/PracticeChooserScreen'

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 max-w-md mx-auto">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/activity/:activityId" element={<ActivityDashboardScreen />} />
          <Route path="/activity/:activityId/practice-chooser" element={<PracticeChooserScreen />} />
          <Route path="/activity/:activityId/practice" element={<PracticeSessionScreen />} />
          <Route path="/activity/:activityId/manual-practice" element={<ManualPracticeScreen />} />
          <Route path="/activity/:activityId/manage" element={<ManageItemsScreen />} />
          <Route path="/activity/:activityId/manage/add" element={<AddEditItemScreen />} />
          <Route path="/activity/:activityId/manage/:itemId" element={<ItemProgressScreen />} />
          <Route path="/activity/:activityId/manage/:itemId/edit" element={<AddEditItemScreen />} />
          <Route path="/activity/:activityId/stats" element={<StatsScreen />} />
          <Route path="/import" element={<ImportScreen />} />
        </Routes>
      </div>
    </HashRouter>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/PracticeChooserScreen.tsx src/App.tsx
git commit -m "feat: add PracticeChooserScreen and practice-chooser route"
```

---

## Task 4: Update ActivityDashboardScreen

Remove the four navigation buttons (Start Practice, Manual Practice, Stats, Manage Items), change "← Back" to "← Activities", and add TabBar.

**Files:**
- Modify: `src/screens/ActivityDashboardScreen.tsx`

- [ ] **Step 1: Replace the main return block**

The `editingSettings` early-return block is **unchanged**. Only the main return (the `if (editingSettings)` block is false path) changes.

Replace the entire main `return` (line 145 onward) with:

```tsx
  return (
    <div className="p-4 flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100">
      <button onClick={() => navigate('/')} className="text-slate-400 text-sm mb-4 block shrink-0">
        ← Activities
      </button>

      <div className="flex items-start justify-between mb-1 shrink-0">
        <h1 className="text-2xl font-bold">{activity.name}</h1>
        <button
          onClick={() => setEditingSettings(true)}
          className="text-xs text-slate-500 hover:text-slate-300 mt-1"
        >
          Settings
        </button>
      </div>
      <p className="text-slate-400 text-sm mb-6 capitalize shrink-0">{activity.itemLabel}s</p>

      <div className="flex gap-3 shrink-0">
        {(['red', 'yellow', 'green'] as const).map(color => (
          <Link
            key={color}
            to={`/activity/${activityId}/stats?tab=items&color=${color}`}
            className="flex-1 bg-slate-800 rounded-xl p-3 text-center"
          >
            <ColorDot color={color} />
            <div className="text-2xl font-bold mt-1">{counts[color]}</div>
            <div className="text-xs text-slate-400 capitalize mt-0.5">{color}</div>
          </Link>
        ))}
      </div>

      <div className="flex-1 min-h-0" />

      <TabBar activityId={activityId!} />
    </div>
  )
```

- [ ] **Step 2: Add TabBar import at the top of the file**

Add to the existing imports:

```tsx
import TabBar from '../components/TabBar'
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ActivityDashboardScreen.tsx
git commit -m "feat: strip nav buttons from dashboard, add TabBar and Activities back link"
```

---

## Task 5: Fix HomeScreen Layout

Convert from free-scrolling `min-h-screen` to `h-screen` layout.

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Replace the return block**

Replace the entire `return` in `HomeScreen` with:

```tsx
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100">
      <div className="shrink-0 px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold">Practice App</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {activities.length === 0 && !adding && (
          <p className="text-slate-400 text-sm mb-4">No activities yet. Add one to get started.</p>
        )}

        <div className="flex flex-col gap-3 mb-6">
          {activities.map(a => (
            <div key={a.id} className="flex items-center bg-slate-800 rounded-xl px-4 py-3">
              <button className="flex-1 text-left" onClick={() => navigate(`/activity/${a.id}`)}>
                <div className="font-semibold">{a.name}</div>
                <div className="text-xs text-slate-400 capitalize">{a.itemLabel}s</div>
                <div className="text-xs text-slate-500 mt-0.5">{lastPracticedLabel(a.id)}</div>
              </button>
              <button
                onClick={() => handleDelete(a.id, a.name)}
                className="text-slate-500 hover:text-red-400 text-sm ml-4"
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        {adding ? (
          <div className="bg-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <input
              autoFocus
              className="bg-slate-700 rounded-lg px-3 py-2 text-sm w-full outline-none"
              placeholder="Activity name (e.g. Juggling)"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <input
              className="bg-slate-700 rounded-lg px-3 py-2 text-sm w-full outline-none"
              placeholder="Item label, singular (e.g. trick, route)"
              value={itemLabel}
              onChange={e => setItemLabel(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 bg-violet-600 hover:bg-violet-500 rounded-lg py-2 text-sm font-semibold"
              >
                Add
              </button>
              <button
                onClick={() => { setAdding(false); setName(''); setItemLabel('') }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold"
          >
            + Add Activity
          </button>
        )}

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
      </div>
    </div>
  )
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "fix: convert HomeScreen to h-screen viewport-locked layout"
```

---

## Task 6: Update ManageItemsScreen

Convert layout to `h-screen` with scrollable list, and add TabBar.

**Files:**
- Modify: `src/screens/ManageItemsScreen.tsx`

- [ ] **Step 1: Add TabBar import**

Add to existing imports at top of file:

```tsx
import TabBar from '../components/TabBar'
```

- [ ] **Step 2: Replace the return block**

Replace the entire `return` with:

```tsx
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100">
      <div className="shrink-0 px-4 pt-4">
        <Link to={`/activity/${activityId}`} className="text-slate-400 text-sm mb-4 block">
          ← Back
        </Link>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Manage {label}s</h1>
          <button
            onClick={() => navigate(`/activity/${activityId}/manage/add`)}
            className="bg-violet-600 hover:bg-violet-500 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            + Add {label}
          </button>
        </div>

        <input
          type="text"
          placeholder={`Search ${label}s`}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="bg-slate-800 rounded-xl px-4 py-3 outline-none text-sm w-full mb-3"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {items.length === 0 ? (
          <p className="text-slate-400 text-sm">No {label}s yet</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-slate-400 text-sm">No {label}s match your search.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filteredItems.map(item => (
              <li key={item.id}>
                <Link
                  to={`/activity/${activityId}/manage/${item.id}/edit`}
                  className="bg-slate-800 rounded-xl px-4 py-3 flex flex-col gap-2 block"
                >
                  <div className="flex items-center gap-3">
                    <ColorDot color={item.color} size="md" />
                    <span className="flex-1 text-sm">{item.name}</span>
                    <span className="text-violet-400 text-sm">›</span>
                  </div>
                  {(item.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {[...(item.tags ?? [])].sort().map(tag => (
                        <span key={tag} className="bg-slate-700 rounded-full px-2 py-0.5 text-xs text-slate-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TabBar activityId={activityId!} />
    </div>
  )
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ManageItemsScreen.tsx
git commit -m "feat: convert ManageItemsScreen to h-screen layout and add TabBar"
```

---

## Task 7: Add TabBar to StatsScreen

`StatsScreen` already uses `h-screen overflow-hidden flex flex-col`. Only TabBar needs adding.

**Files:**
- Modify: `src/screens/StatsScreen.tsx`

- [ ] **Step 1: Add TabBar import**

Add to existing imports at top of file:

```tsx
import TabBar from '../components/TabBar'
```

- [ ] **Step 2: Add TabBar to the root div**

The file ends with this pattern (the last two closing tags of the component):

```tsx
      </div>
    </div>
  )
}
```

Change it to insert TabBar between them:

```tsx
      </div>

      <TabBar activityId={activityId} />
    </div>
  )
}
```

The inner `</div>` closes the `className="flex-1 min-h-0 overflow-y-auto pt-4"` scrollable region. The outer `</div>` closes the root `h-screen` container. TabBar goes between them.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/StatsScreen.tsx
git commit -m "feat: add TabBar to StatsScreen"
```

---

## Task 8: Update ItemProgressScreen

Convert from `min-h-screen` to `h-screen` layout and add TabBar.

**Files:**
- Modify: `src/screens/ItemProgressScreen.tsx`

- [ ] **Step 1: Add TabBar import**

Add to existing imports at top of file:

```tsx
import TabBar from '../components/TabBar'
```

- [ ] **Step 2: Replace the return block**

Replace the entire `return` with:

```tsx
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100">
      <div className="shrink-0 px-4 pt-4">
        <Link to={backTo} className="text-slate-400 text-sm mb-4 block">
          ← Back
        </Link>
        <h1 className="text-xl font-bold mb-1">{item.name}</h1>
        <p className="text-slate-400 text-sm mb-4">
          <span style={{ color: BAR_COLOR[item.color] }}>●</span>{' '}
          Currently {item.color}
          {totalSessions > 0 && ` · ${totalSessions} session${totalSessions === 1 ? '' : 's'} total`}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
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

      <TabBar activityId={activityId!} />
    </div>
  )
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ItemProgressScreen.tsx
git commit -m "feat: convert ItemProgressScreen to h-screen layout and add TabBar"
```

---

## Task 9: Add TabBar to AddEditItemScreen

`AddEditItemScreen` already uses `h-screen overflow-hidden flex flex-col`. Only TabBar needs adding.

**Files:**
- Modify: `src/screens/AddEditItemScreen.tsx`

- [ ] **Step 1: Add TabBar import**

Add to existing imports at top of file:

```tsx
import TabBar from '../components/TabBar'
```

- [ ] **Step 2: Add TabBar before the closing div**

The root div ends with:

```tsx
      </form>
    </div>
```

Change it to:

```tsx
      </form>

      <TabBar activityId={activityId!} />
    </div>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all existing tests pass (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/screens/AddEditItemScreen.tsx
git commit -m "feat: add TabBar to AddEditItemScreen"
```

---

## Final: Visual Verification

- [ ] Start the dev server: `npm run dev`
- [ ] Open in browser and simulate mobile (DevTools → iPhone 14 Pro viewport)
- [ ] Check: overscroll bounce shows navy, not white, on all screens
- [ ] Check: HomeScreen fills viewport, no white gap at bottom
- [ ] Check: Tab bar appears on Dashboard, Chooser, Items, Stats, ItemProgress, AddEdit
- [ ] Check: Tab bar is absent on root Home (activity list), PracticeSession, ManualPractice
- [ ] Check: active tab highlights correctly as you navigate
- [ ] Check: Practice tab → chooser → Auto / Manual routes work
- [ ] Check: Dashboard shows only count cards + Settings, no old nav buttons
- [ ] Check: All existing tests still pass: `npm test`
