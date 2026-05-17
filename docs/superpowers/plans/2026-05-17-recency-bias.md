# Recency Bias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-activity `recencyBias` parameter (0–1, default 0.9) that makes item selection within each color bucket prefer least-recently-practiced items using geometric decay weights.

**Architecture:** Export a pure `computeRecencyWeights` helper from `selection.ts`, then update `selectItem` to call it. `selectItem` gets two new optional params (`recencyBias=1`, `lastPracticedAt={}`) so existing callers compile without changes until Task 3 updates them. `Activity` gains `recencyBias?: number`. `PracticeSessionScreen` calls `getLastPracticedByItem` once per draw and passes it. `ActivityDashboardScreen` gains a slider for the setting.

**Tech Stack:** TypeScript, React 19, Vitest

---

### Task 1: Add `recencyBias` to `Activity` type + export `computeRecencyWeights` pure helper + unit tests

**Files:**
- Modify: `src/types.ts`
- Modify: `src/selection.ts`
- Modify: `src/tests/selection.test.ts`

- [ ] **Step 1: Write failing tests for `computeRecencyWeights`**

Append to `src/tests/selection.test.ts` (after the existing `describe('selectItem', ...)` block):

```ts
import { describe, it, expect } from 'vitest'
import { selectItem, computeRecencyWeights } from '../selection'
import type { Item } from '../types'
```

Replace the existing import line (which only imports `selectItem`) with the line above, then append:

```ts
describe('computeRecencyWeights', () => {
  const makeW = (id: string): Item => ({
    id, activityId: 'act-1', name: id, color: 'red', createdAt: '2024-01-01T00:00:00.000Z',
  })

  it('single item gets weight 1', () => {
    expect(computeRecencyWeights([makeW('a')], 0.9, {})).toEqual([1])
  })

  it('two never-practiced items get equal weight', () => {
    const [a, b] = [makeW('a'), makeW('b')]
    const [wa, wb] = computeRecencyWeights([a, b], 0.9, {})
    expect(wa).toBeCloseTo(0.5)
    expect(wb).toBeCloseTo(0.5)
  })

  it('stale item gets higher weight than recent with bias < 1', () => {
    const [a, b] = [makeW('a'), makeW('b')]
    const lastPracticedAt = { a: '2024-01-01T00:00:00.000Z', b: '2024-06-01T00:00:00.000Z' }
    const [wa, wb] = computeRecencyWeights([a, b], 0.5, lastPracticedAt)
    expect(wa).toBeGreaterThan(wb)
    expect(wa).toBeCloseTo(1 / 1.5)
    expect(wb).toBeCloseTo(0.5 / 1.5)
  })

  it('never-practiced item gets higher weight than practiced item with bias < 1', () => {
    const [a, b] = [makeW('a'), makeW('b')]
    const lastPracticedAt = { b: '2024-06-01T00:00:00.000Z' }
    const [wa, wb] = computeRecencyWeights([a, b], 0.5, lastPracticedAt)
    expect(wa).toBeGreaterThan(wb)
  })

  it('bias=1 produces uniform weights regardless of recency', () => {
    const [a, b, c] = [makeW('a'), makeW('b'), makeW('c')]
    const lastPracticedAt = {
      a: '2024-01-01T00:00:00.000Z',
      b: '2024-03-01T00:00:00.000Z',
      c: '2024-06-01T00:00:00.000Z',
    }
    const [wa, wb, wc] = computeRecencyWeights([a, b, c], 1, lastPracticedAt)
    expect(wa).toBeCloseTo(1 / 3)
    expect(wb).toBeCloseTo(1 / 3)
    expect(wc).toBeCloseTo(1 / 3)
  })

  it('bias=0 gives all weight to rank-0 (most stale) item', () => {
    const [a, b] = [makeW('a'), makeW('b')]
    const lastPracticedAt = { a: '2024-01-01T00:00:00.000Z', b: '2024-06-01T00:00:00.000Z' }
    const [wa, wb] = computeRecencyWeights([a, b], 0, lastPracticedAt)
    expect(wa).toBeCloseTo(1)
    expect(wb).toBeCloseTo(0)
  })

  it('bias=0 with multiple never-practiced items distributes uniformly among them', () => {
    const [a, b] = [makeW('a'), makeW('b')]
    const [wa, wb] = computeRecencyWeights([a, b], 0, {})
    expect(wa).toBeCloseTo(0.5)
    expect(wb).toBeCloseTo(0.5)
  })

  it('items with the same timestamp share a rank and get equal weight', () => {
    const [a, b, c] = [makeW('a'), makeW('b'), makeW('c')]
    const lastPracticedAt = {
      a: '2024-01-01T00:00:00.000Z',
      b: '2024-01-01T00:00:00.000Z',
      c: '2024-06-01T00:00:00.000Z',
    }
    const [wa, wb, wc] = computeRecencyWeights([a, b, c], 0.5, lastPracticedAt)
    expect(wa).toBeCloseTo(wb)
    expect(wa).toBeGreaterThan(wc)
  })

  it('weight for each item is independent of pool order', () => {
    const [a, b] = [makeW('a'), makeW('b')]
    const lastPracticedAt = { a: '2024-01-01T00:00:00.000Z', b: '2024-06-01T00:00:00.000Z' }
    const w1 = computeRecencyWeights([a, b], 0.5, lastPracticedAt)
    const w2 = computeRecencyWeights([b, a], 0.5, lastPracticedAt)
    expect(w1[0]).toBeCloseTo(w2[1])
    expect(w1[1]).toBeCloseTo(w2[0])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 15
```

Expected: FAIL — `computeRecencyWeights is not exported from '../selection'`

- [ ] **Step 3: Add `recencyBias?: number` to `Activity` in `src/types.ts`**

Full updated `Activity` interface:

```ts
export interface Activity {
  id: string
  name: string
  itemLabel: string
  weights: { red: number; yellow: number; green: number }
  recencyBias?: number
  createdAt: string
}
```

- [ ] **Step 4: Add `computeRecencyWeights` to `src/selection.ts`**

Add this function **before** `selectItem` (do not change `selectItem` yet):

```ts
export function computeRecencyWeights(
  pool: Item[],
  recencyBias: number,
  lastPracticedAt: Record<string, string>,
): number[] {
  const sorted = [...pool].sort((a, b) => {
    const la = lastPracticedAt[a.id]
    const lb = lastPracticedAt[b.id]
    if (!la && !lb) return 0
    if (!la) return -1
    if (!lb) return 1
    return la.localeCompare(lb)
  })
  const rankOf = new Map<string, number>()
  let rank = 0
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prev = lastPracticedAt[sorted[i - 1].id]
      const curr = lastPracticedAt[sorted[i].id]
      if (prev !== curr) rank++
    }
    rankOf.set(sorted[i].id, rank)
  }
  const raw = pool.map(item => Math.pow(recencyBias, rankOf.get(item.id)!))
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw.map(w => w / sum)
}
```

- [ ] **Step 5: Run tests to verify they pass**

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 15
```

Expected: all tests pass including the new `computeRecencyWeights` describe block.

- [ ] **Step 6: Commit**

```powershell
git -C "C:\Users\Picco\Desktop\Practice App" add src/types.ts src/selection.ts src/tests/selection.test.ts
git -C "C:\Users\Picco\Desktop\Practice App" commit -m "feat: add recencyBias type field and computeRecencyWeights helper"
```

---

### Task 2: Update `selectItem` to use recency weights + new `selectItem` tests

**Files:**
- Modify: `src/selection.ts`
- Modify: `src/tests/selection.test.ts`

- [ ] **Step 1: Write failing tests for the updated `selectItem` behavior**

Append inside the existing `describe('selectItem', ...)` block in `src/tests/selection.test.ts`, after the last existing `it(...)`:

```ts
  it('bias=0 always picks the least recently practiced item within the color bucket', () => {
    const items = [makeItem('stale', 'red'), makeItem('recent', 'red')]
    const lastPracticedAt = {
      stale: '2024-01-01T00:00:00.000Z',
      recent: '2024-06-01T00:00:00.000Z',
    }
    for (let i = 0; i < 50; i++) {
      expect(selectItem(items, new Set(), weights, 0, lastPracticedAt)?.id).toBe('stale')
    }
  })

  it('never-practiced item is treated as most stale with bias=0', () => {
    const items = [makeItem('never', 'red'), makeItem('practiced', 'red')]
    const lastPracticedAt = { practiced: '2024-06-01T00:00:00.000Z' }
    for (let i = 0; i < 50; i++) {
      expect(selectItem(items, new Set(), weights, 0, lastPracticedAt)?.id).toBe('never')
    }
  })

  it('bias=1 with lastPracticedAt behaves uniformly (selects all items)', () => {
    const items = [makeItem('a', 'red'), makeItem('b', 'red'), makeItem('c', 'red')]
    const lastPracticedAt = {
      a: '2024-01-01T00:00:00.000Z',
      b: '2024-03-01T00:00:00.000Z',
      c: '2024-06-01T00:00:00.000Z',
    }
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const item = selectItem(items, new Set(), weights, 1, lastPracticedAt)
      if (item) seen.add(item.id)
    }
    expect(seen.has('a')).toBe(true)
    expect(seen.has('b')).toBe(true)
    expect(seen.has('c')).toBe(true)
  })

  it('existing tests still pass with default params (no recencyBias or lastPracticedAt args)', () => {
    const items = [makeItem('r', 'red'), makeItem('y', 'yellow'), makeItem('g', 'green')]
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const item = selectItem(items, new Set(), weights)
      if (item) seen.add(item.color)
    }
    expect(seen.has('red')).toBe(true)
    expect(seen.has('yellow')).toBe(true)
    expect(seen.has('green')).toBe(true)
  })
```

- [ ] **Step 2: Run tests to confirm the new tests fail**

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 15
```

Expected: new `selectItem` tests fail (wrong number of args or wrong behavior).

- [ ] **Step 3: Update `selectItem` signature and replace the uniform pick**

Replace the entire `selectItem` function in `src/selection.ts` with:

```ts
export function selectItem(
  items: Item[],
  excluded: Set<string>,
  weights: Activity['weights'],
  recencyBias: number = 1,
  lastPracticedAt: Record<string, string> = {},
): Item | null {
  const available = items.filter(i => !excluded.has(i.id))
  if (available.length === 0) return null

  const byColor: Record<Color, Item[]> = {
    red: available.filter(i => i.color === 'red'),
    yellow: available.filter(i => i.color === 'yellow'),
    green: available.filter(i => i.color === 'green'),
  }

  const colors: Color[] = ['red', 'yellow', 'green']
  const nonEmpty = colors.filter(c => byColor[c].length > 0)

  const emptyWeight = colors
    .filter(c => byColor[c].length === 0)
    .reduce((sum, c) => sum + weights[c], 0)
  const totalNonEmptyWeight = nonEmpty.reduce((sum, c) => sum + weights[c], 0)

  const effective: Record<Color, number> = { red: 0, yellow: 0, green: 0 }
  for (const c of nonEmpty) {
    effective[c] = weights[c] + emptyWeight * (weights[c] / totalNonEmptyWeight)
  }

  const rand = Math.random()
  let cumulative = 0
  let chosenColor: Color = nonEmpty[0]
  for (const c of nonEmpty) {
    cumulative += effective[c]
    if (rand < cumulative) {
      chosenColor = c
      break
    }
  }

  const pool = byColor[chosenColor]
  const recencyWeights = computeRecencyWeights(pool, recencyBias, lastPracticedAt)
  const r2 = Math.random()
  let cum = 0
  for (let i = 0; i < pool.length; i++) {
    cum += recencyWeights[i]
    if (r2 < cum) return pool[i]
  }
  return pool[pool.length - 1]
}
```

- [ ] **Step 4: Run all tests to verify everything passes**

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 15
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git -C "C:\Users\Picco\Desktop\Practice App" add src/selection.ts src/tests/selection.test.ts
git -C "C:\Users\Picco\Desktop\Practice App" commit -m "feat: update selectItem to use recency-weighted sampling"
```

---

### Task 3: Wire PracticeSessionScreen to pass recencyBias and lastPracticedAt

**Files:**
- Modify: `src/screens/PracticeSessionScreen.tsx`

- [ ] **Step 1: Add `getLastPracticedByItem` to the storage import**

Change line 3 in `src/screens/PracticeSessionScreen.tsx` from:

```ts
import { getActivities, getItems, saveItem, appendLog, getTodayPracticedItemIds } from '../storage'
```

to:

```ts
import { getActivities, getItems, saveItem, appendLog, getTodayPracticedItemIds, getLastPracticedByItem } from '../storage'
```

- [ ] **Step 2: Call `getLastPracticedByItem` and pass recency params to both `selectItem` calls**

In the `drawNextItem` callback, find these two lines:

```ts
    const next = selectItem(filtered, excluded, activity.weights)
```

and:

```ts
        const nextUnfiltered = selectItem(freshItems, excluded, activity.weights)
```

Replace the entire block from `const todayPracticed` through both `selectItem` calls with:

```ts
    const todayPracticed = getTodayPracticedItemIds(activityId)
    const excluded = new Set([...todayPracticed, ...skipped])
    const lastPracticedAt = getLastPracticedByItem(activityId)
    const recencyBias = activity.recencyBias ?? 0.9
    const filtered = activeTags.size === 0
      ? freshItems
      : freshItems.filter(i => (i.tags ?? []).some(t => activeTags.has(t)))
    const next = selectItem(filtered, excluded, activity.weights, recencyBias, lastPracticedAt)
    if (next === null) {
      if (activeTags.size > 0) {
        const nextUnfiltered = selectItem(freshItems, excluded, activity.weights, recencyBias, lastPracticedAt)
```

The rest of the `drawNextItem` body is unchanged.

- [ ] **Step 3: Build to verify no TypeScript errors**

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vite\bin\vite.js" build 2>&1 | Select-Object -Last 10
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```powershell
git -C "C:\Users\Picco\Desktop\Practice App" add src/screens/PracticeSessionScreen.tsx
git -C "C:\Users\Picco\Desktop\Practice App" commit -m "feat: wire recencyBias and lastPracticedAt into PracticeSessionScreen"
```

---

### Task 4: Add recency bias slider to ActivityDashboardScreen

**Files:**
- Modify: `src/screens/ActivityDashboardScreen.tsx`

- [ ] **Step 1: Add `draftRecencyBias` state**

After the existing state declarations (after line `const [draftWeights, setDraftWeights] = useState...`), add:

```ts
  const [draftRecencyBias, setDraftRecencyBias] = useState(0.9)
```

- [ ] **Step 2: Initialize `draftRecencyBias` in useEffect**

Inside the `useEffect` that calls `setActivity(a)` etc., after `setDraftWeights({...})`, add:

```ts
    setDraftRecencyBias(a.recencyBias ?? 0.9)
```

- [ ] **Step 3: Save `recencyBias` in `handleSaveSettings`**

In `handleSaveSettings`, change the `updated` object from:

```ts
    const updated: Activity = {
      ...activity,
      name: draftName.trim() || activity.name,
      itemLabel: draftLabel.trim() || activity.itemLabel,
      weights: {
        red: draftWeights.red / total,
        yellow: draftWeights.yellow / total,
        green: draftWeights.green / total,
      },
    }
```

to:

```ts
    const updated: Activity = {
      ...activity,
      name: draftName.trim() || activity.name,
      itemLabel: draftLabel.trim() || activity.itemLabel,
      weights: {
        red: draftWeights.red / total,
        yellow: draftWeights.yellow / total,
        green: draftWeights.green / total,
      },
      recencyBias: draftRecencyBias,
    }
```

- [ ] **Step 4: Add the slider to the settings JSX**

After the weights `<div>` block (after the `<p>Total: ...` line and its closing `</div>` tags), and before the Save Settings button, add:

```tsx
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide mb-2 block">
              Recency bias
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={draftRecencyBias}
                onChange={e => setDraftRecencyBias(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-slate-300 w-12 text-right">
                {draftRecencyBias.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              1 = uniform, lower = prefer items practiced longest ago
            </p>
          </div>
```

- [ ] **Step 5: Build to verify no TypeScript errors**

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vite\bin\vite.js" build 2>&1 | Select-Object -Last 10
```

Expected: build succeeds.

- [ ] **Step 6: Run all tests**

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\Users\Picco\Desktop\Practice App\node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 15
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```powershell
git -C "C:\Users\Picco\Desktop\Practice App" add src/screens/ActivityDashboardScreen.tsx
git -C "C:\Users\Picco\Desktop\Practice App" commit -m "feat: add recency bias slider to activity settings"
```

---

## Self-Review

**Spec coverage:**
- `recencyBias?: number` on `Activity` — Task 1 ✓
- `computeRecencyWeights` exported helper — Task 1 ✓
- `selectItem` new signature with backward-compat defaults — Task 2 ✓
- Never-practiced items share rank 0 — covered in `computeRecencyWeights` implementation ✓
- `bias=1` → uniform — tested ✓
- `bias=0` → deterministic least-recently-practiced — tested ✓
- `PracticeSessionScreen` passes `recencyBias ?? 0.9` and `lastPracticedAt` — Task 3 ✓
- Both `selectItem` calls updated — Task 3 ✓
- Slider in Activity Settings, range 0.00–1.00, step 0.01 — Task 4 ✓
- Hint line `1 = uniform, lower = prefer items practiced longest ago` — Task 4 ✓
- `draftRecencyBias` initialized from `activity.recencyBias ?? 0.9` — Task 4 ✓

**Placeholder scan:** No TBDs or vague steps — all steps contain complete code.

**Type consistency:** `Activity['recencyBias']` is `number | undefined` throughout; `?? 0.9` applied consistently at read sites in Task 3 and Task 4.
