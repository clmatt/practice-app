# Manual Practice Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Manual Practice screen where users can search for a specific item and log a rated practice session for it, and sort item lists alphabetically in ManageItemsScreen and the new screen.

**Architecture:** New `ManualPracticeScreen` with two local-state phases (list → rate). Entry point is a new button on `ActivityDashboardScreen` and a new route in `App.tsx`. `ManageItemsScreen` gets a one-line alphabetical sort. No new storage APIs — reuses `appendLog` and `saveItem` exactly as `PracticeSessionScreen` does.

**Tech Stack:** React, TypeScript, React Router v6, Tailwind CSS, Vitest

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/screens/ManageItemsScreen.tsx` | Add alphabetical sort to filtered list |
| Create | `src/screens/ManualPracticeScreen.tsx` | New screen: list phase + rate phase |
| Modify | `src/screens/ActivityDashboardScreen.tsx` | Add Manual Practice button |
| Modify | `src/App.tsx` | Add new route |

---

## Task 1: Sort items alphabetically in ManageItemsScreen

**Files:**
- Modify: `src/screens/ManageItemsScreen.tsx`

- [ ] **Step 1: Update filteredItems to sort alphabetically**

In `src/screens/ManageItemsScreen.tsx`, find this block (around line 29):

```tsx
const filteredItems = searchQuery.trim() === ''
  ? items
  : items.filter(item => item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
```

Replace it with:

```tsx
const filteredItems = (searchQuery.trim() === ''
  ? items
  : items.filter(item => item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
).sort((a, b) => a.name.localeCompare(b.name))
```

- [ ] **Step 2: Run existing tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/screens/ManageItemsScreen.tsx
git commit -m "feat: sort items alphabetically in ManageItemsScreen"
```

---

## Task 2: Create ManualPracticeScreen

**Files:**
- Create: `src/screens/ManualPracticeScreen.tsx`

- [ ] **Step 1: Create the file**

Create `src/screens/ManualPracticeScreen.tsx` with the full content below:

```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getActivities, getItems, saveItem, appendLog } from '../storage'
import { generateId } from '../utils'
import type { Activity, Item, Color } from '../types'
import ColorDot from '../components/ColorDot'
import ColorPicker from '../components/ColorPicker'

type Phase = 'list' | 'rate'

export default function ManualPracticeScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()

  const [activity, setActivity] = useState<Activity | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [phase, setPhase] = useState<Phase>('list')
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [selectedColor, setSelectedColor] = useState<Color | null>(null)

  useEffect(() => {
    const found = getActivities().find(a => a.id === activityId)
    if (!found) { navigate('/'); return }
    setActivity(found)
    setItems(getItems(activityId!))
  }, [activityId, navigate])

  if (!activity) return null

  const filteredItems = (searchQuery.trim() === ''
    ? items
    : items.filter(item => item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
  ).sort((a, b) => a.name.localeCompare(b.name))

  function handleSelectItem(item: Item) {
    setSelectedItem(item)
    setSelectedColor(null)
    setPhase('rate')
  }

  function handleSave() {
    if (!selectedItem || !selectedColor || !activityId) return

    const colorBefore = selectedItem.color
    const colorAfter = selectedColor

    appendLog({
      id: generateId(),
      itemId: selectedItem.id,
      practicedAt: new Date().toISOString(),
      colorBefore,
      colorAfter,
    })

    if (colorAfter !== colorBefore) {
      saveItem({ ...selectedItem, color: colorAfter })
      setItems(getItems(activityId))
    }

    setPhase('list')
    setSearchQuery('')
    setSelectedItem(null)
    setSelectedColor(null)
  }

  function handleBack() {
    setPhase('list')
    setSelectedItem(null)
    setSelectedColor(null)
  }

  if (phase === 'rate' && selectedItem) {
    return (
      <div className="p-4 flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100">
        <button onClick={handleBack} className="text-slate-400 text-sm mb-4 block">
          ← Back
        </button>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-3xl font-bold text-center">{selectedItem.name}</p>
          <div className="flex items-center gap-2">
            <ColorDot color={selectedItem.color} size="md" />
            <span className="text-slate-400 text-sm capitalize">{selectedItem.color}</span>
          </div>
          <p className="text-slate-400 text-sm">How did it go?</p>
        </div>

        <div className="flex flex-col gap-4">
          <ColorPicker value={selectedColor} onChange={setSelectedColor} />
          <button
            onClick={handleSave}
            disabled={selectedColor === null}
            className="bg-violet-600 hover:bg-violet-500 rounded-xl py-4 font-bold text-lg w-full disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
          <button
            onClick={handleBack}
            className="bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold w-full"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-slate-950 text-slate-100 min-h-screen">
      <button
        onClick={() => navigate(`/activity/${activityId}`)}
        className="text-slate-400 text-sm mb-4 block"
      >
        ← Back
      </button>

      <h1 className="text-xl font-bold mb-4">Manual Practice</h1>

      <input
        type="text"
        placeholder={`Search ${activity.itemLabel}s`}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="bg-slate-800 rounded-xl px-4 py-3 outline-none text-sm w-full mb-4"
      />

      {items.length === 0 ? (
        <p className="text-slate-400 text-sm">No {activity.itemLabel}s yet</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-slate-400 text-sm">No {activity.itemLabel}s match your search.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filteredItems.map(item => (
            <li key={item.id}>
              <button
                onClick={() => handleSelectItem(item)}
                className="bg-slate-800 rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
              >
                <ColorDot color={item.color} size="md" />
                <span className="flex-1 text-sm">{item.name}</span>
                <span className="text-violet-400 text-sm">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run existing tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/screens/ManualPracticeScreen.tsx
git commit -m "feat: create ManualPracticeScreen with list and rate phases"
```

---

## Task 3: Wire button and route

**Files:**
- Modify: `src/screens/ActivityDashboardScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add Manual Practice button to ActivityDashboardScreen**

In `src/screens/ActivityDashboardScreen.tsx`, find this block (around line 176):

```tsx
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
        <button
          onClick={() => navigate(`/activity/${activityId}/practice`)}
          className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-4 font-bold text-lg"
          disabled={items.length === 0}
        >
          Start Practice
        </button>
        {items.length === 0 && (
          <p className="text-center text-xs text-slate-500">Add some {activity.itemLabel}s first</p>
        )}
```

Replace it with:

```tsx
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
        <button
          onClick={() => navigate(`/activity/${activityId}/practice`)}
          className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-4 font-bold text-lg"
          disabled={items.length === 0}
        >
          Start Practice
        </button>
        <button
          onClick={() => navigate(`/activity/${activityId}/manual-practice`)}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold"
          disabled={items.length === 0}
        >
          Manual Practice
        </button>
        {items.length === 0 && (
          <p className="text-center text-xs text-slate-500">Add some {activity.itemLabel}s first</p>
        )}
```

- [ ] **Step 2: Add import and route in App.tsx**

In `src/App.tsx`, add the import alongside the other screen imports:

```tsx
import ManualPracticeScreen from './screens/ManualPracticeScreen'
```

Then inside `<Routes>`, add the new route after the practice route:

```tsx
<Route path="/activity/:activityId/manual-practice" element={<ManualPracticeScreen />} />
```

The full `App.tsx` should look like:

```tsx
import { HashRouter, Routes, Route } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import ActivityDashboardScreen from './screens/ActivityDashboardScreen'
import PracticeSessionScreen from './screens/PracticeSessionScreen'
import ManualPracticeScreen from './screens/ManualPracticeScreen'
import ManageItemsScreen from './screens/ManageItemsScreen'
import AddEditItemScreen from './screens/AddEditItemScreen'
import ItemProgressScreen from './screens/ItemProgressScreen'
import StatsScreen from './screens/StatsScreen'
import ImportScreen from './screens/ImportScreen'

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 max-w-md mx-auto">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/activity/:activityId" element={<ActivityDashboardScreen />} />
          <Route path="/activity/:activityId/practice" element={<PracticeSessionScreen />} />
          <Route path="/activity/:activityId/manual-practice" element={<ManualPracticeScreen />} />
          <Route path="/activity/:activityId/manage" element={<ManageItemsScreen />} />
          <Route path="/activity/:activityId/manage/add" element={<AddEditItemScreen />} />
          <Route path="/activity/:activityId/manage/:itemId" element={<ItemProgressScreen />} />
          <Route path="/activity/:activityId/manage/:itemId/edit" element={<AddEditItemScreen />} />
          <Route path="/activity/:activityId/stats" element={<StatsScreen />} />
          <Route path="/import" element={<ImportScreen />} />
        </Routes>
      </div>
    </HashRouter>
  )
}
```

- [ ] **Step 3: Run existing tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 4: Start dev server and verify manually**

```bash
npm run dev
```

Verify the following:
1. Activity dashboard shows "Manual Practice" button below "Start Practice" — both disabled when there are no items
2. Tapping "Manual Practice" navigates to the new screen
3. Items are listed alphabetically and the search input filters them
4. Tapping an item shows the rate phase: item name, current color dot + label, ColorPicker, Save and Back buttons
5. Save is disabled until a color is selected
6. After saving, the app returns to the list with search cleared; if the color changed, the item's dot reflects the new color
7. Back button from the rate phase returns to the list without saving
8. ManageItemsScreen also shows items in alphabetical order

- [ ] **Step 5: Commit**

```bash
git add src/screens/ActivityDashboardScreen.tsx src/App.tsx
git commit -m "feat: wire Manual Practice button and route"
```
