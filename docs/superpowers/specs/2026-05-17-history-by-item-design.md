# History By Item Design

**Goal:** Move per-item color history out of Manage Items and into the History screen as a second tab, so that all history (session-based and item-based) lives in one place.

**Architecture:** `HistoryScreen` gains a tab bar with `By session` (existing, unchanged) and `By item` (new). Active tab is tracked via URL search param `?tab=items`. `ItemProgressScreen`'s back button reads React Router navigation state (`location.state?.from`) to return to the correct screen. The item name link in `ManageItemsScreen` is removed — color history detail now lives exclusively in History.

---

## History Screen

`HistoryScreen` renders a tab bar at the top of the page:

- **By session** — existing view, completely unchanged
- **By item** — new list view

Active tab is determined by `useSearchParams`: `tab=items` → By item tab; anything else (including no param) → By session tab. Clicking a tab updates the URL param without a full navigation.

### By Item Tab

Lists all items for the activity, sorted alphabetically by name. Each row:

- Color dot (item's current color)
- Item name (primary text)
- Secondary line: `Last practiced [Month Day] · [N] sessions` — e.g. `Last practiced May 12 · 12 sessions`
- Items never practiced show: `Never practiced · 0 sessions`
- Chevron `›` on the right
- Tapping the row navigates to `ItemProgressScreen` with navigation state `{ from: 'history' }`

Data: `getItems(activityId)`, `getLastPracticedByItem(activityId)`, `getPracticeCountByItem(activityId)` — all exist in `storage.ts`, no new functions needed.

Date format: `Month Day` (e.g. `May 12`) matching the style used elsewhere in the app, no year shown.

If the activity has no items, show: `No [label]s yet — start adding some!`

---

## ItemProgressScreen

The back link currently hardcodes `/activity/${activityId}/manage`. It changes to read `useLocation().state?.from`:

- `'history'` → back to `/activity/${activityId}/history?tab=items`
- anything else (including `undefined`) → back to `/activity/${activityId}/manage` (preserves existing behaviour)

The link text stays `← Back` in both cases.

Navigation from `HistoryScreen` passes `{ from: 'history' }` as the second argument to `navigate()`. Navigation from `ManageItemsScreen` (if the link is kept elsewhere) would pass `{ from: 'manage' }`, but since the manage link is being removed, the default fallback handles that case.

---

## ManageItemsScreen

The item name is currently a `<Link>` to `/activity/${activityId}/manage/${item.id}`. That link is removed. The item name becomes a plain `<span>` (unstyled text). The Edit and Delete affordances are unchanged.

---

## Files Changed

| File | Change |
|------|--------|
| `src/screens/HistoryScreen.tsx` | Add tab bar; add By item list view using `useSearchParams` |
| `src/screens/ItemProgressScreen.tsx` | Back link reads `location.state?.from` |
| `src/screens/ManageItemsScreen.tsx` | Remove item name `<Link>`, replace with `<span>` |
