# Item Browser (Filtered View) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tag and color filter chips to the Manage Items screen so users can view items filtered by one or more tags and/or colors.

**Architecture:** Extend `ManageItemsScreen` with two pieces of local state (`activeTagFilters`, `activeColorFilters`) and a derived `filteredItems` computed in the render body. No new routes, screens, or storage changes. Edit and Delete actions remain available on filtered results.

**Tech Stack:** React 19, TypeScript, Tailwind CSS. Existing `Color` type from `src/types.ts`, `ColorDot` component.

---

## File Structure

| File | Change |
|------|--------|
| `src/screens/ManageItemsScreen.tsx` | Add filter state, derived filtered list, color + tag chip UI, count label, no-results empty state |

---

### Task 1: Add filter state and filtered item list to ManageItemsScreen

**Files:**
- Modify: `src/screens/ManageItemsScreen.tsx`

The current file is 88 lines. Below is the complete replacement. Apply it as a full file rewrite to avoid partial-edit errors.

- [ ] **Step 1: Read the current file**

Read `src/screens/ManageItemsScreen.tsx` to confirm it matches what's expected before rewriting.

- [ ] **Step 2: Rewrite the file**

Replace the entire contents of `src/screens/ManageItemsScreen.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ColorDot from '../components/ColorDot'
import { getActivities, getItems, deleteItem } from '../storage'
import type { Activity, Item, Color } from '../types'

export default function ManageItemsScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()

  const [activity, setActivity] = useState<Activity | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(new Set())
  const [activeColorFilters, setActiveColorFilters] = useState<Set<Color>>(new Set())

  useEffect(() => {
    const found = getActivities().find(a => a.id === activityId)
    if (!found) {
      navigate('/')
      return
    }
    setActivity(found)
    setItems(getItems(activityId!))
  }, [activityId, navigate])

  function handleDelete(itemId: string, itemName: string) {
    if (!window.confirm(`Delete "${itemName}"? This cannot be undone.`)) return
    deleteItem(itemId)
    setItems(getItems(activityId!))
  }

  function toggleTagFilter(tag: string) {
    setActiveTagFilters(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function toggleColorFilter(color: Color) {
    setActiveColorFilters(prev => {
      const next = new Set(prev)
      if (next.has(color)) next.delete(color)
      else next.add(color)
      return next
    })
  }

  if (!activity) return null

  const label = activity.itemLabel
  const allTags = [...new Set(items.flatMap(i => i.tags ?? []))].sort()
  const filtersActive = activeTagFilters.size > 0 || activeColorFilters.size > 0

  const filteredItems = items.filter(item => {
    const tagMatch = activeTagFilters.size === 0 || (item.tags ?? []).some(t => activeTagFilters.has(t))
    const colorMatch = activeColorFilters.size === 0 || activeColorFilters.has(item.color)
    return tagMatch && colorMatch
  })

  return (
    <div className="p-4 bg-slate-950 text-slate-100 min-h-screen">
      <Link to={`/activity/${activityId}`} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>

      <h1 className="text-xl font-bold mb-4">
        Manage {label}s
      </h1>

      {/* Color filter chips — always shown */}
      <div className="flex gap-2 mb-3">
        {(['red', 'yellow', 'green'] as const).map(color => (
          <button
            key={color}
            onClick={() => toggleColorFilter(color)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeColorFilters.has(color)
                ? 'bg-violet-600 text-white'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            <ColorDot color={color} size="sm" />
            <span className="capitalize">{color}</span>
          </button>
        ))}
      </div>

      {/* Tag filter chips — only shown if any items have tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTagFilter(tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeTagFilters.has(tag)
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Count label when filters are active */}
      {filtersActive && items.length > 0 && (
        <p className="text-slate-500 text-xs mb-3">
          Showing {filteredItems.length} of {items.length} {label}{items.length === 1 ? '' : 's'}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-slate-400 text-sm mb-6">No {label}s yet</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-slate-400 text-sm mb-6">No {label}s match the current filters.</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-6">
          {filteredItems.map(item => (
            <li key={item.id} className="bg-slate-800 rounded-xl px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <ColorDot color={item.color} size="md" />
                <span className="flex-1 text-sm">{item.name}</span>
                <Link
                  to={`/activity/${activityId}/manage/${item.id}/edit`}
                  className="text-violet-400 text-sm hover:text-violet-300"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(item.id, item.name)}
                  className="text-red-400 text-sm hover:text-red-300"
                >
                  Delete
                </button>
              </div>
              {(item.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(item.tags ?? []).map(tag => (
                    <span key={tag} className="bg-slate-700 rounded-full px-2 py-0.5 text-xs text-slate-300">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => navigate(`/activity/${activityId}/manage/add`)}
        className="bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold w-full"
      >
        Add {label}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Build to verify TypeScript**

```
cd "C:\Users\Picco\Desktop\Practice App"
"C:\Program Files\nodejs\npm.cmd" run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 4: Run tests to confirm nothing broke**

```
"C:\Program Files\nodejs\npm.cmd" test
```

Expected: all existing tests still pass (this change has no effect on storage or selection logic).

- [ ] **Step 5: Commit and push**

```
git add src/screens/ManageItemsScreen.tsx
git commit -m "feat: add tag and color filter chips to Manage Items screen"
git push
```
