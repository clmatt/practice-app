# Skip Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Items skipped during a practice session never appear again in that same session.

**Architecture:** Add a `skippedItemIds` Set to `PracticeSessionScreen` state. On skip, add the current item's id to the set and pass the updated set directly into `drawNextItem` (bypassing stale closure) so it is merged with `todayPracticedItemIds` when calling `selectItem`. No storage changes needed — skips already produce no log entries.

**Tech Stack:** React 19, TypeScript, existing `selectItem` function in `src/selection.ts`.

---

## File Structure

| File | Change |
|------|--------|
| `src/screens/PracticeSessionScreen.tsx` | Add `skippedItemIds` state, update `drawNextItem` signature + logic, update `handleSkip` |

---

### Task 1: Add skip deduplication to PracticeSessionScreen

**Files:**
- Modify: `src/screens/PracticeSessionScreen.tsx`

This is the only file that changes. The full updated file is below — apply the diff carefully.

- [ ] **Step 1: Read the current file**

Read `src/screens/PracticeSessionScreen.tsx` to understand the current state before editing.

- [ ] **Step 2: Add `skippedItemIds` state**

After the existing `filterExhausted` state declaration (currently line 25), add:

```tsx
const [skippedItemIds, setSkippedItemIds] = useState<Set<string>>(new Set())
```

The state block should now look like:

```tsx
const [sessionLog, setSessionLog] = useState<Array<{ name: string; colorBefore: Color; colorAfter: Color }>>([])
const [filterExhausted, setFilterExhausted] = useState(false)
const [skippedItemIds, setSkippedItemIds] = useState<Set<string>>(new Set())
```

- [ ] **Step 3: Update `drawNextItem` to accept a `skipped` parameter and exclude skipped items**

Find the current `drawNextItem` function. Replace the entire function with:

```tsx
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

Key changes from the original:
- Parameter `skipped: Set<string> = skippedItemIds` (defaults to current state value)
- `excluded` merges `todayPracticed` and `skipped`
- Both `selectItem` calls use `excluded` instead of `todayPracticed`

- [ ] **Step 4: Update `handleSkip` to build the updated set and pass it directly**

Find the current `handleSkip` function:

```tsx
const handleSkip = () => {
  drawNextItem()
}
```

Replace with:

```tsx
const handleSkip = () => {
  if (!currentItem) return
  const updated = new Set([...skippedItemIds, currentItem.id])
  setSkippedItemIds(updated)
  drawNextItem(updated)
}
```

**Why pass `updated` explicitly:** `setSkippedItemIds` schedules a React state update — `skippedItemIds` inside the `drawNextItem` closure would still hold the old value. Passing the updated set directly avoids this stale-closure bug.

- [ ] **Step 5: Verify TypeScript compiles**

Node is at `C:\Program Files\nodejs`. Run:

```
cd "C:\Users\Picco\Desktop\Practice App"
"C:\Program Files\nodejs\npm.cmd" run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 6: Commit and push**

```
git add src/screens/PracticeSessionScreen.tsx
git commit -m "feat: exclude skipped items from future draws in the same session"
git push
```
