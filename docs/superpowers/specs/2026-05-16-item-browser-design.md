# Item Browser (Filtered View) Design

**Goal:** Let the user view their items for an activity filtered by tag and/or color, without leaving the familiar Manage Items screen.

**Architecture:** Extend `ManageItemsScreen` with filter chips at the top. Filtering is pure in-component state — no new routes, no new storage functions. The item list already rendered becomes filtered by the active tag and/or color selections. Edit and delete actions remain available on filtered results.

---

## Changes: `src/screens/ManageItemsScreen.tsx`

### State

```ts
const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(new Set())
const [activeColorFilters, setActiveColorFilters] = useState<Set<Color>>(new Set())
```

### Derived values (computed in render, no extra state)

```ts
const allTags = [...new Set(items.flatMap(i => i.tags ?? []))].sort()

const filteredItems = items.filter(item => {
  const tagMatch = activeTagFilters.size === 0 || (item.tags ?? []).some(t => activeTagFilters.has(t))
  const colorMatch = activeColorFilters.size === 0 || activeColorFilters.has(item.color)
  return tagMatch && colorMatch
})
```

Both filters are AND-combined: if tags and colors are both active, an item must satisfy both. Within each filter type, it's OR (any matching tag, any matching color).

### UI — filter chips above the item list

Show color filter chips first (always visible since every item has a color), then tag chips (only if any items have tags).

Color chips:
```tsx
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
```

Tag chips (only rendered if `allTags.length > 0`):
```tsx
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
```

### Empty state when filters produce no results

```tsx
{filteredItems.length === 0 && items.length > 0 && (
  <p className="text-slate-400 text-sm mb-6">No {label}s match the current filters.</p>
)}
```

(The existing "No {label}s yet" empty state only shows when `items.length === 0`.)

### Item count label

Show a count when filters are active: `Showing X of Y {label}s` between the filter chips and the list.

```tsx
{(activeTagFilters.size > 0 || activeColorFilters.size > 0) && (
  <p className="text-slate-500 text-xs mb-3">
    Showing {filteredItems.length} of {items.length} {label}{items.length === 1 ? '' : 's'}
  </p>
)}
```

### Toggle helpers

```ts
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
```

## Edge Cases

- Deleting an item while a filter is active: `handleDelete` calls `setItems(getItems(activityId!))` which refreshes the list; `filteredItems` recomputes from the new `items` on next render. Filter state is preserved.
- Adding an item: the "Add {label}" button navigates away, so filter state resets on return (new component mount). Acceptable.
- No tags on any items: tag chip section is hidden entirely; only color chips show.
- All items match a color filter: works correctly (no special case needed).
