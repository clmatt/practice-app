# Mobile App UX — Design Spec

**Date:** 2026-05-20  
**Status:** Approved

## Goal

Make the app feel like a native mobile app when installed to the iPhone home screen as a PWA. Three specific problems to solve:

1. Several screens require unnecessary scrolling for content that fits in one viewport
2. Overscroll bounce reveals a white background behind the navy app shell
3. Navigation feels web-like (text back buttons, separate menu-style dashboard) rather than app-like

## Approach

Approach A (approved): global layout fixes + bottom tab bar. No animation library, no activity switcher header — just the core structural changes that address every identified issue.

---

## Section 1: Global Layout Fixes

### White overscroll background

`html` and `body` have no background color set, so overscroll bounce reveals the browser's default white. Fix by adding `bg-slate-950` (the app's base color) to `html`, `body`, and `#root` in `index.css`. Also ensure `#root` is `h-full` so the app fills the viewport.

### Viewport-locked screens

Some screens use `min-h-screen` with a simple padding wrapper, which lets content overflow and scroll freely. These must be converted to the `h-screen overflow-hidden flex flex-col` pattern already used in `ActivityDashboardScreen`, `PracticeSessionScreen`, and `StatsScreen`.

The correct pattern:
```
<div className="h-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100">
  {/* fixed header — shrink-0 */}
  {/* scrollable content — flex-1 min-h-0 overflow-y-auto */}
  {/* tab bar — shrink-0 */}
</div>
```

Screens to convert: `HomeScreen`, `ManageItemsScreen`, `ItemProgressScreen`.

---

## Section 2: Tab Bar Component

### New file: `src/components/TabBar.tsx`

A `TabBar` component rendered at the bottom of all activity-level screens. Props: `activityId: string`.

**Tabs (left to right):**

| Label | Icon | Route |
|---|---|---|
| Home | House SVG | `/activity/:activityId` |
| Practice | Play SVG | `/activity/:activityId/practice-chooser` |
| Items | List SVG | `/activity/:activityId/manage` |
| Stats | Bar chart SVG | `/activity/:activityId/stats` |

**Active tab detection:** use `useLocation()` + `useParams()` to match the current path against each tab's route. Items tab is active for any path starting with `/activity/:activityId/manage`. Stats tab for `/activity/:activityId/stats`. Practice tab for `/activity/:activityId/practice-chooser`. Home tab otherwise (i.e. `/activity/:activityId` exactly, or any unmatched activity path).

**Visual:**
- Container: `bg-slate-900 border-t border-slate-800 shrink-0`
- Safe area: `pb-[env(safe-area-inset-bottom)]` on the container
- Tab buttons: `flex-1 flex flex-col items-center justify-center py-2 gap-1`
- Active: icon + label in `text-violet-400`
- Inactive: icon + label in `text-slate-500`
- Label: `text-[10px] font-medium`
- Icons: inline SVG, 24×24

**Icons** (simple inline SVG, no external library):
- Home: standard house outline
- Practice: right-pointing triangle (play)
- Items: three horizontal lines (hamburger/list)
- Stats: three vertical bars of increasing height

---

## Section 3: Navigation Restructuring

### New route

Add `/activity/:activityId/practice-chooser` → `PracticeChooserScreen` in `App.tsx`.

### ActivityDashboardScreen changes

Remove from the dashboard:
- "Start Practice" button
- "Manual Practice" button
- "Stats" button
- "Manage Items" button

Replace the `← Back` link with a `← Activities` link (same functionality — navigates to `/`).

What remains on the dashboard:
- `← Activities` small link (top left)
- Activity name + Settings button (top right)
- Red/yellow/green count cards (still tappable to jump to Stats filtered by color)
- `TabBar` at the bottom

The dashboard becomes a focused at-a-glance view. The "disabled when no items" logic (greying out Practice) moves to the Practice tab icon — if `items.length === 0`, tapping Practice navigates to the chooser which explains no items exist rather than being disabled.

### Back navigation within tabs

Sub-screens within the Items tab (`AddEditItemScreen`, `ItemProgressScreen`) show the tab bar with the Items tab highlighted. Their existing `← Back` links handle within-stack navigation. No changes needed to back link behavior — they just gain the tab bar at the bottom.

### Tab bar visibility rules

| Screen | Tab bar visible |
|---|---|
| `HomeScreen` | No |
| `ActivityDashboardScreen` | Yes (Home tab active) |
| `PracticeChooserScreen` | Yes (Practice tab active) |
| `PracticeSessionScreen` | No |
| `ManualPracticeScreen` | No |
| `ManageItemsScreen` | Yes (Items tab active) |
| `AddEditItemScreen` | Yes (Items tab active) |
| `ItemProgressScreen` | Yes (Items tab active) |
| `StatsScreen` | Yes (Stats tab active) |
| `ImportScreen` | No |

---

## Section 4: Practice Chooser Screen

### New file: `src/screens/PracticeChooserScreen.tsx`

Route: `/activity/:activityId/practice-chooser`

**Layout:** `h-screen overflow-hidden flex flex-col` with tab bar at bottom.

**Content:** Two large tappable cards stacked vertically, vertically centered in the available space:

**Card 1 — Auto Practice**
- Title: "Auto Practice"
- Subtitle: "Items drawn based on your weights"
- Navigates to `/activity/:activityId/practice`
- Style: `bg-violet-600` (primary action)

**Card 2 — Manual Practice**
- Title: "Manual Practice"
- Subtitle: "Choose items yourself"
- Navigates to `/activity/:activityId/manual-practice`
- Style: `bg-slate-800`

If `items.length === 0`, both cards are visually disabled with a message: "Add some [label]s first to start practicing."

---

## File Change Summary

| File | Type | Change |
|---|---|---|
| `src/index.css` | Edit | Add `html, body, #root` background + height |
| `src/App.tsx` | Edit | Add practice-chooser route |
| `src/components/TabBar.tsx` | Create | New tab bar component |
| `src/screens/PracticeChooserScreen.tsx` | Create | New practice chooser screen |
| `src/screens/HomeScreen.tsx` | Edit | Convert to `h-screen` layout |
| `src/screens/ActivityDashboardScreen.tsx` | Edit | Remove nav buttons, add TabBar, rename back link |
| `src/screens/ManageItemsScreen.tsx` | Edit | Convert to `h-screen` layout, add TabBar |
| `src/screens/AddEditItemScreen.tsx` | Edit | Add TabBar |
| `src/screens/ItemProgressScreen.tsx` | Edit | Convert to `h-screen` layout, add TabBar |
| `src/screens/StatsScreen.tsx` | Edit | Add TabBar |

`PracticeSessionScreen`, `ManualPracticeScreen`, and `ImportScreen` are unchanged structurally (no tab bar added).
