# Session History Implementation Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a History screen per activity showing past practice sessions, each displaying the date, how many items were practiced, and which items changed color rating.

**Architecture:** Derive sessions from existing `PracticeLog` records — no new data model. Group logs by calendar day per activity. Add a storage query function, a new screen, a new route, and a button on the activity dashboard.

**Tech Stack:** React, TypeScript, React Router, Tailwind CSS, localStorage (existing)

---

## Data Model

No schema changes. Sessions are derived at read time from `PracticeLog`:

```ts
// Existing types (unchanged)
interface PracticeLog {
  id: string
  itemId: string
  practicedAt: string   // ISO timestamp
  colorBefore: Color
  colorAfter: Color
}
```

A **session** = all `PracticeLog` entries whose `itemId` belongs to the activity and whose `practicedAt` date (YYYY-MM-DD) is the same calendar day.

## New Storage Function

Add to `src/storage.ts`:

```ts
export interface SessionSummary {
  date: string   // YYYY-MM-DD
  itemCount: number   // distinct items practiced
  changes: { itemName: string; colorBefore: Color; colorAfter: Color }[]
}

export function getSessionHistory(activityId: string): SessionSummary[]
```

- Loads all logs, filters to items belonging to the activity.
- Groups by `practicedAt.slice(0, 10)` (calendar date).
- `itemCount` = count of distinct `itemId` values in that day's logs.
- `changes` = entries where `colorBefore !== colorAfter`, using the item's `name` looked up from items. If an item was re-rated multiple times in one day, use only the last log entry for that item (highest `practicedAt`).
- Returns sessions sorted newest-first.

## New Screen: HistoryScreen

**File:** `src/screens/HistoryScreen.tsx`

**Route:** `/activity/:activityId/history`

**Behavior:**
- Loads activity (redirects to `/` if not found).
- Calls `getSessionHistory(activityId)`.
- If no sessions: shows "No sessions recorded yet — start practicing!"
- Otherwise: renders a scrollable list of session cards (newest first).

**Session card layout:**
- Header: formatted date (e.g. "May 16, 2026")
- Subtitle: "N item practiced" / "N items practiced" (pluralised)
- If `changes.length > 0`: list each change as `<item name> <ColorDot before> → <ColorDot after>`
- If `changes.length === 0`: show "No ratings changed" in muted text

**Back navigation:** `← Back` link to `/activity/:activityId`

## Routing

Add to `src/App.tsx`:

```tsx
import HistoryScreen from './screens/HistoryScreen'
// inside <Routes>:
<Route path="/activity/:activityId/history" element={<HistoryScreen />} />
```

## Activity Dashboard

Add a "History" button to `src/screens/ActivityDashboardScreen.tsx`, between the existing Stats and Manage buttons:

```tsx
<button
  onClick={() => navigate(`/activity/${activityId}/history`)}
  className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold"
>
  History
</button>
```

## Edge Cases

- Activity not found → redirect to `/`.
- No logs for activity → empty state message.
- Item deleted after being practiced → skip that log entry's name lookup gracefully (filter out logs whose itemId has no matching item).
- Same item re-rated multiple times in one day → use only the last rating change for that item when building `changes`.
