# Skip Deduplication Design

**Goal:** Items skipped during a practice session never appear again in that same session.

**Architecture:** Add a `skippedItemIds` Set to `PracticeSessionScreen` state. On skip, add the current item's id to the set. Pass the set into `drawNextItem` so it is merged with `todayPracticedItemIds` when calling `selectItem`. The set is in-memory only and resets when the session ends or the user navigates away.

**Note on history:** Skips already produce no `PracticeLog` entries (only "I practiced it → Save" does), so skipped items already do not appear in session history. No storage changes needed.

---

## Changes

### `src/screens/PracticeSessionScreen.tsx`

1. Add state: `const [skippedItemIds, setSkippedItemIds] = useState<Set<string>>(new Set())`

2. Update `handleSkip`:
```ts
const handleSkip = () => {
  if (currentItem) {
    setSkippedItemIds(prev => new Set([...prev, currentItem.id]))
  }
  drawNextItem()
}
```

3. Update `drawNextItem` to accept the skipped set as a parameter and merge it with `todayPracticed` before calling `selectItem`:
```ts
const drawNextItem = useCallback((skipped: Set<string> = skippedItemIds) => {
  if (!activity || !activityId) return
  const freshItems = getItems(activityId)
  setItems(freshItems)
  const todayPracticed = getTodayPracticedItemIds(activityId)
  const excluded = new Set([...todayPracticed, ...skipped])
  const filtered = activeTags.size === 0
    ? freshItems
    : freshItems.filter(i => (i.tags ?? []).some(t => activeTags.has(t)))
  const next = selectItem(filtered, excluded, activity.weights)
  if (next === null) {
    if (activeTags.size > 0) {
      const nextUnfiltered = selectItem(freshItems, excluded, activity.weights)
      if (nextUnfiltered !== null) {
        setFilterExhausted(true)
        setPhase('done')
        setCurrentItem(null)
        return
      }
    }
    setFilterExhausted(false)
    setPhase('done')
    setCurrentItem(null)
  } else {
    setCurrentItem(next)
    setPhase('draw')
    setRevealed(false)
    setSelectedColor(null)
  }
}, [activity, activityId, activeTags, skippedItemIds])
```

**Why pass `skipped` as a parameter:** `handleSkip` calls `setSkippedItemIds` then immediately calls `drawNextItem`. Because React state updates are async, `skippedItemIds` inside the callback closure would still be the old value. Passing the updated set explicitly avoids this stale-closure bug.

4. Update `handleSkip` to pass the updated set:
```ts
const handleSkip = () => {
  if (!currentItem) return
  const updated = new Set([...skippedItemIds, currentItem.id])
  setSkippedItemIds(updated)
  drawNextItem(updated)
}
```

## Edge Cases

- Tag filter changes mid-session: skipped items remain excluded regardless of which tags are active
- Filter-exhausted check: skipped items are also excluded from the "can we draw unfiltered?" check, so if all remaining unfiltered items were also skipped, the session correctly ends
- Session complete: `skippedItemIds` resets implicitly when the user navigates back and starts a new session (fresh component mount)
