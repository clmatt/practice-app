# Day-Based Session Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the Auto Practice X/Y counter from session-scoped to day-scoped, and add a skip indicator below it.

**Architecture:** All changes are confined to `PracticeSessionScreen.tsx`. Two computed values are added after `sessionTotal`: `filteredPool` (the current filter's item list, reusing the same logic as `sessionTotal`) and `todayDoneCount` (items in that pool practiced today). The header span is replaced with a flex column that adds the skip count when non-zero.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest.

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify | `src/screens/PracticeSessionScreen.tsx` | Add `filteredPool`/`todayDoneCount` computed values; update header counter and add skip indicator |

---

## Task 1: Day-based counter and skip indicator

**Files:**
- Modify: `src/screens/PracticeSessionScreen.tsx`

- [ ] **Step 1: Add `filteredPool` and `todayDoneCount` after `sessionTotal`**

In `src/screens/PracticeSessionScreen.tsx`, find the `sessionTotal` block (around line 169) and add two new computed values immediately after it:

```typescript
  const filteredPool = (() => {
    if (advancedFilter) {
      const ast = parseFilter(advancedFilter)
      return typeof ast === 'string' ? [] : items.filter(i => evaluateFilter(ast, i.tags ?? []))
    }
    return activeTags.size === 0
      ? items
      : items.filter(i => (i.tags ?? []).some(t => activeTags.has(t)))
  })()

  const todayDoneCount = activityId
    ? filteredPool.filter(i => getTodayPracticedItemIds(activityId).has(i.id)).length
    : 0
```

- [ ] **Step 2: Replace the header counter span with a flex column**

Find this JSX in the header (around line 183):

```tsx
        {(phase === 'draw' || phase === 'rate') ? (
          <span className="text-slate-400 text-sm">{sessionLog.length} / {sessionTotal} done</span>
        ) : (
          <span />
        )}
```

Replace it with:

```tsx
        {(phase === 'draw' || phase === 'rate') ? (
          <div className="flex flex-col">
            <span className="text-slate-400 text-sm">{todayDoneCount} / {sessionTotal} done</span>
            {skippedItemIds.size > 0 && (
              <span className="text-slate-500 text-xs">{skippedItemIds.size} skipped this session</span>
            )}
          </div>
        ) : (
          <span />
        )}
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: `Tests  102 passed (102)`

- [ ] **Step 4: Commit**

```bash
git add src/screens/PracticeSessionScreen.tsx
git commit -m "feat: day-based practice counter and skip indicator in Auto Practice"
```

- [ ] **Step 5: Push**

```bash
git push
```
