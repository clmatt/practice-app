# Recency Bias Design

**Goal:** Add a per-activity recency bias parameter that makes the practice session prefer items practiced longest ago within each color bucket.

**Architecture:** Two-step selection unchanged in structure — color picked first using existing weight logic, then item picked within that color using geometric decay weights based on recency rank. `selectItem` gains two new parameters (`recencyBias`, `lastPracticedAt`); callers pass them in. `Activity` gets an optional `recencyBias` field (default 0.9).

---

## Algorithm

Selection is two steps:

1. **Color bucket** — identical to today. Color weights are redistributed from empty categories, then a weighted random draw picks the color.

2. **Item within bucket** — items in the chosen color bucket are ranked by last-practiced timestamp, ascending (least recently practiced = rank 0 = highest weight). Items never practiced are treated as most stale (rank 0). Weight for rank `r` is `recencyBias^r`. These weights are renormalized and sampled.

Special cases:
- Multiple never-practiced items all share rank 0 and receive equal weight.
- `recencyBias = 1` → uniform within color (equivalent to current behavior).
- `recencyBias = 0` → always picks the least recently practiced item in the chosen color bucket (weight 1 for rank 0, weight 0 for all others).

---

## Data

Add `recencyBias?: number` to the `Activity` interface in `src/types.ts`. Value range 0–1 inclusive. When absent (existing activities), default to 0.9 at read time (`activity.recencyBias ?? 0.9`). Stored with the activity object in localStorage via `saveActivity`.

---

## Logic

`selectItem` in `src/selection.ts` signature becomes:

```ts
export function selectItem(
  items: Item[],
  excluded: Set<string>,
  weights: Activity['weights'],
  recencyBias: number,
  lastPracticedAt: Record<string, string>,
): Item | null
```

The color-selection block is unchanged. The final uniform pick is replaced by a pure helper `weightedPickFromPool(pool, recencyBias, lastPracticedAt)` that:
1. Sorts pool by `lastPracticedAt[item.id]` ascending (undefined = most stale = first).
2. Assigns weights `recencyBias^rank`.
3. Renormalizes and samples.

`PracticeSessionScreen` calls `getLastPracticedByItem(activityId)` once per draw and passes the result plus `activity.recencyBias ?? 0.9` to `selectItem`. (Today's practiced items are already excluded before the call — no change needed there.)

---

## UI

A slider is added to the Activity Settings view in `ActivityDashboardScreen`, below the color weights section:

- Label: **Recency bias**
- Range: 0.00–1.00, step 0.01
- Current value displayed as a number (e.g. `0.90`) next to the slider
- Hint line: `1 = uniform, lower = prefer items practiced longest ago`

Draft state: `draftRecencyBias: number`, initialized from `activity.recencyBias ?? 0.9`. Saved as-is (no normalization needed) to `activity.recencyBias`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/types.ts` | Add `recencyBias?: number` to `Activity` |
| `src/selection.ts` | Add `recencyBias` + `lastPracticedAt` params; replace uniform pick with `weightedPickFromPool` |
| `src/tests/selection.test.ts` | New test file for `selectItem` and `weightedPickFromPool` |
| `src/screens/ActivityDashboardScreen.tsx` | Recency bias slider in Settings view |
| `src/screens/PracticeSessionScreen.tsx` | Pass `recencyBias` and `lastPracticedAt` to `selectItem` |
