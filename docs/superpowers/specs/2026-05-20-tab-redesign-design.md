# Tab Redesign & Scrolling Fix — Design Spec

**Date:** 2026-05-20  
**Status:** Approved

## Goal

Fix a remaining scrolling bug and redesign the tab bar from 4 tabs to 5, with a raised Practice tab and no back buttons on screens that have the tab bar.

---

## Section 1: Scrolling Fix

### Problem

`body` has `height: 100%` (viewport height as content area) plus `padding-top` and `padding-bottom` from `env(safe-area-inset-*)`. Because `box-sizing` defaults to `content-box`, the padding adds on top of the declared height, making `body` taller than the viewport. This allows a small amount of scrolling.

### Fix

Add `box-sizing: border-box` to `html` and `body` in `src/index.css` so the safe-area padding is contained within the declared `height: 100%`.

```css
html, body {
  box-sizing: border-box;
  @apply bg-slate-950;
  height: 100%;
}
```

---

## Section 2: 5-Tab Bar Redesign

### New Tab type

```ts
export type Tab = 'activities' | 'dashboard' | 'practice' | 'items' | 'stats'
```

### New props

```ts
interface TabBarProps {
  activityId: string
  activityName: string
}
```

### Tabs (left to right)

| Label | Icon | Route | Active when |
|---|---|---|---|
| Activities | Grid/apps icon (4 squares) | `/` | `pathname === '/'` |
| `activityName` (truncated) | House icon | `/activity/:id` | fallback (none of the below match) |
| Practice | Play icon (raised) | `/activity/:id/practice-chooser` | starts with `/activity/:id/practice-chooser` |
| Items | List icon | `/activity/:id/manage` | starts with `/activity/:id/manage` |
| Stats | Bar chart icon | `/activity/:id/stats` | starts with `/activity/:id/stats` |

### Active tab detection (`getActiveTab`)

```ts
export function getActiveTab(pathname: string, activityId: string): Tab {
  const base = `/activity/${activityId}`
  const path = pathname.split('?')[0]
  if (path === '/') return 'activities'
  if (path.startsWith(`${base}/practice-chooser`)) return 'practice'
  if (path.startsWith(`${base}/manage`)) return 'items'
  if (path.startsWith(`${base}/stats`)) return 'stats'
  return 'dashboard'
}
```

### Visual design

**Container:** `shrink-0 bg-slate-900 border-t border-slate-800`  
**Safe area:** inline style `paddingBottom: 'env(safe-area-inset-bottom)'` on container  
**Inner flex row:** `flex items-end` (align-items end so Practice pill rises above others)

**Standard tabs (Activities, Dashboard, Items, Stats):**
- Button: `flex-1 flex flex-col items-center justify-center py-2 gap-1`
- Icon: 22×22 SVG
- Label: `text-[10px] font-medium`
- Active: `text-violet-400` | Inactive: `text-slate-500`

**Practice tab (raised):**
- Button: `flex-1 flex flex-col items-center justify-center pb-2 gap-1` (no `py-2` — pill provides top spacing)
- Icon: wrapped in `<div className="bg-violet-600 rounded-2xl p-2 -mt-4">` — this shifts it up out of the bar
- Icon size: 24×24 SVG
- Icon color: always `text-white`
- Label: `text-xs font-medium`
- Label color: `text-violet-400` (active) | `text-slate-500` (inactive)

**Dashboard tab label:** truncate `activityName` with `max-w-[4.5rem] truncate` to prevent overflow.

### Icons

All existing icons (HomeIcon, PlayIcon, ListIcon, BarChartIcon) are reused. Add one new icon:

**GridIcon** (for Activities tab) — 4 squares:
```svg
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <rect x="3" y="3" width="7" height="7" />
  <rect x="14" y="3" width="7" height="7" />
  <rect x="3" y="14" width="7" height="7" />
  <rect x="14" y="14" width="7" height="7" />
</svg>
```

### Navigation for Activities tab

The Activities tab navigates to `/` using `useNavigate`. Since this crosses out of the activity context, no `activityId` handling is needed — just `navigate('/')`.

---

## Section 3: Remove Back Buttons

All screens that show the tab bar lose their back/breadcrumb navigation links. The tab bar replaces that navigation need.

| Screen | Element to remove |
|---|---|
| `ActivityDashboardScreen` | `<button onClick={() => navigate('/')}>← Activities</button>` at line 148 |
| `ManageItemsScreen` | `<Link to={...}>← Back</Link>` at line 38 |
| `StatsScreen` | `<Link to={...}>← Back</Link>` at line 113 |
| `ItemProgressScreen` | `<Link to={backTo}>← Back</Link>` at line 73 |
| `AddEditItemScreen` | `<Link to={...}>← Back</Link>` at line 121 |

**Keep unchanged:**
- `ImportScreen` — back link stays (no tab bar, needs navigation)
- `PracticeSessionScreen` — "Exit" button stays (intentional session-ending action)
- `ManualPracticeScreen` — "Exit" button stays (intentional session-ending action)

---

## Section 4: Passing `activityName` to TabBar

Every screen that renders `<TabBar>` must pass `activityName`. Each screen already has the activity object loaded:

| Screen | `activity` source | Pass to TabBar |
|---|---|---|
| `ActivityDashboardScreen` | `activity` state | `activityName={activity.name}` |
| `ManageItemsScreen` | `activity` state | `activityName={activity.name}` |
| `StatsScreen` | `getActivities().find(...)` (direct call at ~line 34) | `activityName={activity.name}` |
| `ItemProgressScreen` | `getActivities().find(...)` (direct call at line 56) | `activityName={activity?.name ?? ''}` |
| `AddEditItemScreen` | `activity` state | `activityName={activity.name}` |
| `PracticeChooserScreen` | `activity` state | `activityName={activity.name}` |

`StatsScreen` stores the result in a local `const activity` (not useState) so it's synchronously available before render.

---

## Section 5: Test Updates

`src/tests/tabBar.test.ts` currently tests 4-tab `getActiveTab`. Update to cover:
- `'/'` → `'activities'`
- `/activity/:id` → `'dashboard'`
- `/activity/:id/practice-chooser` → `'practice'`
- `/activity/:id/manage` and sub-routes → `'items'`
- `/activity/:id/stats` and with query params → `'stats'`

The `getActiveTab` signature gains no new parameters — `'activities'` detection uses the pathname directly (not `activityId`), so the existing `(pathname, activityId)` signature still works.

---

## File Change Summary

| File | Change |
|---|---|
| `src/index.css` | Add `box-sizing: border-box` to `html, body` |
| `src/components/TabBar.tsx` | New 5-tab design, new props, raised Practice tab, GridIcon |
| `src/tests/tabBar.test.ts` | Update tests for new Tab type and `getActiveTab` |
| `src/screens/ActivityDashboardScreen.tsx` | Remove "← Activities" button; pass `activityName` to TabBar |
| `src/screens/ManageItemsScreen.tsx` | Remove "← Back" link; pass `activityName` to TabBar |
| `src/screens/StatsScreen.tsx` | Remove "← Back" link; pass `activityName` to TabBar |
| `src/screens/ItemProgressScreen.tsx` | Remove "← Back" link; pass `activityName` to TabBar |
| `src/screens/AddEditItemScreen.tsx` | Remove "← Back" link; pass `activityName` to TabBar |
| `src/screens/PracticeChooserScreen.tsx` | Pass `activityName` to TabBar |
