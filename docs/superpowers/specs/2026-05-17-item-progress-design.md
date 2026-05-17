# Item Progress Screen Design

**Goal:** Let the user see the full practice history for a single item — every session grouped into color runs — on a dedicated detail screen.

**Architecture:** New `ItemProgressScreen` at `/activity/:activityId/manage/:itemId`. Entry point is the item name in `ManageItemsScreen`, which becomes a `<Link>`. No new storage functions needed; `getLogs()` filtered by `itemId` provides all the data.

---

## Route

`/activity/:activityId/manage/:itemId`

Added to `App.tsx` alongside the existing manage routes.

---

## Data Model

Filter all `PracticeLog` entries by `itemId`, sort ascending by `practicedAt`. Group consecutive logs with the same `colorAfter` into **runs**:

```ts
interface Run {
  color: Color
  count: number        // number of sessions in this run
  startDate: string    // YYYY-MM-DD of first session
  endDate: string      // YYYY-MM-DD of last session (same as startDate if count === 1)
}
```

A new run begins whenever `colorAfter` differs from the previous log's `colorAfter`. The same color can appear as multiple non-consecutive runs (regression + recovery shows as e.g. red → yellow → green → yellow → green).

The current run is always the last in the array. If `count === 1` and `startDate === endDate`, show only one date (no range).

---

## Screen Layout

```
← Back (to Manage Items)

[Item name]                     h1
● Currently [color]             small badge

[Vertical bar + run list]

  Red          3 sessions · Apr 20 – Apr 25
  Yellow       5 sessions · May 3 – May 8
  Green        2 sessions · May 10 – May 12
  Yellow       2 sessions · May 14 – May 15
  Green · current   1 session · May 17
```

The vertical bar is a single `<div>` column; each segment's `flex` grows proportional to its `count`. Color changes at run boundaries with no transition labels — the color shift is self-evident. The current (last) run has a soft glow (`box-shadow`).

Empty state (no logs): "No practice sessions recorded yet."

---

## Entry Point

In `ManageItemsScreen`, the item name changes from a plain `<span>` to a `<Link to={...}>` styled in violet (matching the Edit link). Edit and Delete remain in the row unchanged.

```tsx
<Link
  to={`/activity/${activityId}/manage/${item.id}`}
  className="flex-1 text-sm text-violet-400 hover:text-violet-300"
>
  {item.name}
</Link>
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/screens/ItemProgressScreen.tsx` | New screen |
| `src/screens/ManageItemsScreen.tsx` | Item name → `<Link>` |
| `src/App.tsx` | New route |

---

## Edge Cases

- **No logs:** Show empty state — "No practice sessions recorded yet."
- **Single session:** One run, `count: 1`, no date range needed.
- **Single run (no color changes):** One block covering all sessions.
- **Regression:** Same color appears multiple times as separate runs — rendered naturally, no special handling.
- **Item not found:** Guard in `useEffect`; navigate back to `/` if `activityId` or `itemId` is invalid.
- **Date range with single date:** Render "May 17" not "May 17 – May 17".
