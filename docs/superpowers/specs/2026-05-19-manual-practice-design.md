# Manual Practice Feature — Design Spec
**Date:** 2026-05-19

## Overview

Add a Manual Practice mode that lets users log a practice session for a specific, user-chosen item rather than a randomly drawn one. Also sort item lists alphabetically in both the new screen and the existing Manage Items screen.

## Entry Point

`ActivityDashboardScreen` gets a new "Manual Practice" button placed directly below "Start Practice". It uses the same `bg-slate-800 hover:bg-slate-700` style as the Stats and Manage buttons. Navigates to `/activity/:activityId/manual-practice`. The button is disabled (with the same disabled state as Start Practice) when the activity has no items.

## New Route

```
/activity/:activityId/manual-practice  →  ManualPracticeScreen
```

Added to `App.tsx` alongside the existing routes.

## ManualPracticeScreen

The screen has two internal phases controlled by local state: `list` and `rate`.

### List Phase

- Back button navigating to `/activity/:activityId`
- Title: "Manual Practice"
- Search input (same style as ManageItemsScreen)
- Item list: alphabetically sorted (`a.name.localeCompare(b.name)`), filtered by search query
- Each row: ColorDot + item name, tappable
- Tapping an item sets the selected item and transitions to `rate` phase

### Rate Phase

- Back button returns to `list` phase (preserves search query)
- Item name displayed prominently
- Current ColorDot + color label shown
- ColorPicker component for selecting new color
- Save button (disabled until a color is selected)
- On Save:
  - Call `appendLog` with a new PracticeLog entry (current timestamp, colorBefore, colorAfter)
  - Call `saveItem` only if colorAfter !== colorBefore
  - Return to `list` phase, clear search query

## Alphabetical Sort in ManageItemsScreen

`filteredItems` is sorted before rendering:
```ts
const sortedItems = [...filteredItems].sort((a, b) => a.name.localeCompare(b.name))
```
Render `sortedItems` instead of `filteredItems`.

## Data Layer

No new storage functions required. Manual Practice reuses `appendLog`, `saveItem`, `getItems`, and `getActivities` exactly as PracticeSessionScreen does.

## What This Does Not Include

- No session summary screen after manual practice (single-item flow, not a session)
- No tag filtering (Manage Items doesn't have it either; this screen mirrors that simplicity)
- No changes to selection algorithm or weights
