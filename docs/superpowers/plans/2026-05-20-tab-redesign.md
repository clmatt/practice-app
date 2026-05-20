# Tab Redesign & Scrolling Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the body scrolling bug, redesign the tab bar from 4 tabs to 5 (with a raised Practice tab), and remove all back buttons from screens that have the tab bar.

**Architecture:** Three sequential tasks — CSS fix first (standalone, no TypeScript impact), then TabBar component rewrite (tests first), then screen updates (remove back buttons and add activityName prop to all TabBar usages).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v3, React Router v7, Vitest

---

## File Structure

| File | Change |
|---|---|
| `src/index.css` | Add `box-sizing: border-box` to `html, body` |
| `src/components/TabBar.tsx` | Full rewrite: 5 tabs, new props, raised Practice tab, GridIcon |
| `src/tests/tabBar.test.ts` | Update all tests for new Tab type and getActiveTab logic |
| `src/screens/ActivityDashboardScreen.tsx` | Remove "← Activities" button; add `activityName` to TabBar |
| `src/screens/ManageItemsScreen.tsx` | Remove "← Back" link; add `activityName` to TabBar |
| `src/screens/StatsScreen.tsx` | Remove "← Back" link; add `activityName` to TabBar |
| `src/screens/ItemProgressScreen.tsx` | Remove "← Back" link; remove `backTo`/`useLocation`/`Link`; add `activityName` to TabBar |
| `src/screens/AddEditItemScreen.tsx` | Remove "← Back" link; remove `Link` import; add `activityName` to TabBar |
| `src/screens/PracticeChooserScreen.tsx` | Add `activityName` to TabBar |

---

## Task 1: Fix body scrolling bug

**Files:**
- Modify: `src/index.css`

**Context:** `body` has `height: 100%` plus `padding-top`/`padding-bottom` from safe-area insets. Because `box-sizing` defaults to `content-box`, the padding is added on top of the height, making body taller than the viewport. Adding `box-sizing: border-box` contains the padding within the declared height.

- [ ] **Step 1: Edit `src/index.css`**

  The current `@layer base` block begins:
  ```css
  @layer base {
    html, body {
      @apply bg-slate-950;
      height: 100%;
    }
  ```

  Change it to:
  ```css
  @layer base {
    html, body {
      box-sizing: border-box;
      @apply bg-slate-950;
      height: 100%;
    }
  ```

- [ ] **Step 2: Verify build passes**

  Run:
  ```
  npm run build
  ```
  Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/index.css
  git commit -m "fix: add box-sizing border-box to prevent safe-area padding overflow"
  ```

---

## Task 2: Rewrite TabBar component (tests first)

**Files:**
- Modify: `src/tests/tabBar.test.ts`
- Modify: `src/components/TabBar.tsx`

**Context:** The current TabBar has 4 tabs (`home | practice | items | stats`). We're redesigning to 5 tabs (`activities | dashboard | practice | items | stats`). The `activities` tab navigates to `/` (outside the current activity). The `dashboard` tab replaces `home`. `activityName` is added as an optional prop (screens will pass it in Task 3). The Practice tab gets a raised violet pill treatment.

The `getActiveTab` function is unit-tested in `src/tests/tabBar.test.ts` via `import { getActiveTab } from '../components/TabBar'`.

- [ ] **Step 1: Replace `src/tests/tabBar.test.ts` with updated tests**

  ```ts
  import { describe, it, expect } from 'vitest'
  import { getActiveTab } from '../components/TabBar'

  describe('getActiveTab', () => {
    const id = 'abc123'

    it('returns activities for the root path', () => {
      expect(getActiveTab('/', id)).toBe('activities')
    })

    it('returns dashboard for the activity root', () => {
      expect(getActiveTab(`/activity/${id}`, id)).toBe('dashboard')
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

- [ ] **Step 2: Run tests to confirm they fail**

  Run:
  ```
  npm test
  ```
  Expected: The tabBar tests fail because `getActiveTab` still returns `'home'`/`'dashboard'` (old values).

- [ ] **Step 3: Replace `src/components/TabBar.tsx` with the new implementation**

  ```tsx
  import { useLocation, useNavigate } from 'react-router-dom'

  interface TabBarProps {
    activityId: string
    activityName?: string
  }

  export type Tab = 'activities' | 'dashboard' | 'practice' | 'items' | 'stats'

  export function getActiveTab(pathname: string, activityId: string): Tab {
    const base = `/activity/${activityId}`
    const path = pathname.split('?')[0]
    if (path === '/') return 'activities'
    if (path.startsWith(`${base}/practice-chooser`)) return 'practice'
    if (path.startsWith(`${base}/manage`)) return 'items'
    if (path.startsWith(`${base}/stats`)) return 'stats'
    return 'dashboard'
  }

  function GridIcon() {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    )
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
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

  export default function TabBar({ activityId, activityName = '' }: TabBarProps) {
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const active = getActiveTab(pathname, activityId)

    const inactive = 'text-slate-500'
    const activeClass = 'text-violet-400'

    return (
      <div
        className="shrink-0 bg-slate-900 border-t border-slate-800"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-end">
          <button
            onClick={() => navigate('/')}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 ${active === 'activities' ? activeClass : inactive}`}
          >
            <GridIcon />
            <span className="text-[10px] font-medium">Activities</span>
          </button>

          <button
            onClick={() => navigate(`/activity/${activityId}`)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 ${active === 'dashboard' ? activeClass : inactive}`}
          >
            <HomeIcon />
            <span className="text-[10px] font-medium max-w-[4.5rem] truncate">{activityName || 'Home'}</span>
          </button>

          <button
            onClick={() => navigate(`/activity/${activityId}/practice-chooser`)}
            className={`flex-1 flex flex-col items-center justify-center pb-2 gap-1 ${active === 'practice' ? activeClass : inactive}`}
          >
            <div className="bg-violet-600 rounded-2xl p-2 -mt-4 text-white">
              <PlayIcon />
            </div>
            <span className="text-xs font-medium">Practice</span>
          </button>

          <button
            onClick={() => navigate(`/activity/${activityId}/manage`)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 ${active === 'items' ? activeClass : inactive}`}
          >
            <ListIcon />
            <span className="text-[10px] font-medium">Items</span>
          </button>

          <button
            onClick={() => navigate(`/activity/${activityId}/stats`)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 ${active === 'stats' ? activeClass : inactive}`}
          >
            <BarChartIcon />
            <span className="text-[10px] font-medium">Stats</span>
          </button>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  Run:
  ```
  npm test
  ```
  Expected: All tests pass. The tabBar tests now return the new tab names.

- [ ] **Step 5: Verify build passes**

  Run:
  ```
  npm run build
  ```
  Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/TabBar.tsx src/tests/tabBar.test.ts
  git commit -m "feat: redesign tab bar to 5 tabs with raised practice button"
  ```

---

## Task 3: Update screens — remove back buttons and pass activityName

**Files:**
- Modify: `src/screens/ActivityDashboardScreen.tsx`
- Modify: `src/screens/ManageItemsScreen.tsx`
- Modify: `src/screens/StatsScreen.tsx`
- Modify: `src/screens/ItemProgressScreen.tsx`
- Modify: `src/screens/AddEditItemScreen.tsx`
- Modify: `src/screens/PracticeChooserScreen.tsx`

**Context:** All screens that render `<TabBar>` must now also pass `activityName`. Each screen already has the `activity` object loaded (they each redirect to `/` if it's not found). We also remove the back-navigation links from these screens — the tab bar replaces that need. Note: `ImportScreen`, `PracticeSessionScreen`, and `ManualPracticeScreen` are NOT changed (no tab bar).

- [ ] **Step 1: Edit `src/screens/ActivityDashboardScreen.tsx`**

  Remove this block (currently at line 148):
  ```tsx
  <button onClick={() => navigate('/')} className="text-slate-400 text-sm mb-4 block shrink-0">
    ← Activities
  </button>
  ```

  Update the TabBar call (currently `<TabBar activityId={activityId!} />`) to:
  ```tsx
  <TabBar activityId={activityId!} activityName={activity.name} />
  ```

- [ ] **Step 2: Edit `src/screens/ManageItemsScreen.tsx`**

  Remove this block from inside the fixed header `<div className="shrink-0 px-4 pt-4">`:
  ```tsx
  <Link to={`/activity/${activityId}`} className="text-slate-400 text-sm mb-4 block">
    ← Back
  </Link>
  ```

  Update the TabBar call to:
  ```tsx
  <TabBar activityId={activityId!} activityName={activity.name} />
  ```

  Remove `Link` from the react-router-dom import since it's no longer used:
  ```tsx
  import { useNavigate, useParams } from 'react-router-dom'
  ```

- [ ] **Step 3: Edit `src/screens/StatsScreen.tsx`**

  Remove this block (currently at line 113):
  ```tsx
  <Link to={`/activity/${activityId}`} className="text-slate-400 text-sm mb-4 block shrink-0">
    ← Back
  </Link>
  ```

  Update the TabBar call (currently `<TabBar activityId={activityId} />`) to:
  ```tsx
  <TabBar activityId={activityId} activityName={activity.name} />
  ```

  `activity` is already defined as `const activity = getActivities().find(a => a.id === activityId)` and guarded by `if (!activity) return null` above the JSX, so `activity.name` is safe.

  Remove `Link` from the import — it's only used for the back link being removed. Update the import from:
  ```tsx
  import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
  ```
  To:
  ```tsx
  import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
  ```

- [ ] **Step 4: Edit `src/screens/ItemProgressScreen.tsx`**

  Remove the `backTo` variable and its dependencies. Replace the top of the component function (everything before `const activity = ...`) from:
  ```tsx
  const { activityId, itemId } = useParams<{ activityId: string; itemId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const backTo = location.state?.from === 'history'
    ? `/activity/${activityId}/stats?tab=items`
    : `/activity/${activityId}/manage`
  ```
  With:
  ```tsx
  const { activityId, itemId } = useParams<{ activityId: string; itemId: string }>()
  const navigate = useNavigate()
  ```

  Update the import at the top of the file from:
  ```tsx
  import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
  ```
  To:
  ```tsx
  import { useNavigate, useParams } from 'react-router-dom'
  ```

  Remove the `← Back` link from the JSX:
  ```tsx
  <Link to={backTo} className="text-slate-400 text-sm mb-4 block">
    ← Back
  </Link>
  ```

  Update the TabBar call to:
  ```tsx
  <TabBar activityId={activityId!} activityName={activity.name} />
  ```

  (`activity` is narrowed to `Activity` by the `if (!activity || !item) return null` guard at line 63, so `.name` is safe.)

- [ ] **Step 5: Edit `src/screens/AddEditItemScreen.tsx`**

  Remove the `← Back` link from the fixed header `<div className="shrink-0 px-4 pt-4">`:
  ```tsx
  <Link to={`/activity/${activityId}/manage`} className="text-slate-400 text-sm mb-4 block">
    ← Back
  </Link>
  ```

  Update the import from:
  ```tsx
  import { Link, useNavigate, useParams } from 'react-router-dom'
  ```
  To:
  ```tsx
  import { useNavigate, useParams } from 'react-router-dom'
  ```

  Update the TabBar call to:
  ```tsx
  <TabBar activityId={activityId!} activityName={activity.name} />
  ```

  (`activity` is in useState and guarded by `if (!activity) return null` before the JSX.)

- [ ] **Step 6: Edit `src/screens/PracticeChooserScreen.tsx`**

  No back button to remove. Only update the TabBar call from:
  ```tsx
  <TabBar activityId={activityId!} />
  ```
  To:
  ```tsx
  <TabBar activityId={activityId!} activityName={activity.name} />
  ```

  (`activity` is in useState and guarded by `if (!activity) return null` before the JSX.)

- [ ] **Step 7: Run all tests**

  Run:
  ```
  npm test
  ```
  Expected: All tests pass (79 tests across 7 files).

- [ ] **Step 8: Verify build passes**

  Run:
  ```
  npm run build
  ```
  Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 9: Commit**

  ```bash
  git add src/screens/ActivityDashboardScreen.tsx src/screens/ManageItemsScreen.tsx src/screens/StatsScreen.tsx src/screens/ItemProgressScreen.tsx src/screens/AddEditItemScreen.tsx src/screens/PracticeChooserScreen.tsx
  git commit -m "feat: remove back buttons and wire activityName into tab bar"
  ```
