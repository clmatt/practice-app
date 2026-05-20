# Day-Based Session Counter

**Date:** 2026-05-20
**Status:** Approved

## Overview

Change the Auto Practice session counter from session-scoped to day-scoped, and add a skip indicator below it. The counter should reflect progress across the whole day so that starting a second session in the same day correctly shows items already practiced rather than resetting to 0.

---

## Changes

### `src/screens/PracticeSessionScreen.tsx` only

**X (numerator) — day-based**

Replace `sessionLog.length` in the header counter with a computed value: the count of items in the current filtered pool that have been practiced today.

Computed inline at render time:

```typescript
const todayPracticedIds = activityId ? getTodayPracticedItemIds(activityId) : new Set<string>()

const filteredPool = (() => {
  if (advancedFilter) {
    const ast = parseFilter(advancedFilter)
    return typeof ast === 'string' ? [] : items.filter(i => evaluateFilter(ast, i.tags ?? []))
  }
  return activeTags.size === 0
    ? items
    : items.filter(i => (i.tags ?? []).some(t => activeTags.has(t)))
})()

const todayDoneCount = filteredPool.filter(i => todayPracticedIds.has(i.id)).length
```

`sessionTotal` (Y) is unchanged — still the total count of items in the filtered pool.

**Skip indicator**

The header left side (currently a single `<span>`) becomes a small flex column during draw and rate phases:

```tsx
<div className="flex flex-col">
  <span className="text-slate-400 text-sm">{todayDoneCount} / {sessionTotal} done</span>
  {skippedItemIds.size > 0 && (
    <span className="text-slate-500 text-xs">{skippedItemIds.size} skipped this session</span>
  )}
</div>
```

Only shown during draw and rate phases (same condition as today).

---

## Out of Scope

- No changes to `sessionLog` (still used for the session-complete summary screen)
- No changes to Manual Practice
- No changes to session history / Stats screen
- No changes to Y (`sessionTotal`)
