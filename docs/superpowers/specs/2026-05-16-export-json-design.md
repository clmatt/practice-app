# Export JSON Design

**Goal:** Let the user download all their app data as a JSON file for backup.

**Architecture:** A pure utility function `exportData()` reads all localStorage, shapes it into a clean JSON structure, and triggers a browser download via a temporary `<a>` element. The trigger is an "Export data" button on the home screen.

---

## Data Shape

```ts
interface ExportShape {
  exportedAt: string           // ISO timestamp
  activities: Activity[]
  items: Item[]
  logs: PracticeLog[]
}
```

All raw data from storage — no transformation needed. The consumer (e.g. a future import feature) can reconstruct the app state directly.

## New Utility: `src/utils.ts`

Add `exportData()` alongside the existing `generateId()`:

```ts
export function exportData(): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    activities: getActivities(),
    items: load<Item>('practice:items'),
    logs: load<PracticeLog>('practice:logs'),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `practice-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

**Note:** `load` and the storage functions need to be importable from `utils.ts`. Since `utils.ts` currently has no storage dependency, the cleanest approach is to import `getActivities`, `getItems` (all activities), and `getLogs` from `storage.ts` rather than calling `load` directly. Export shape is built from the public storage API.

Revised implementation:

```ts
import { getActivities, getLogs } from './storage'
import type { Item } from './types'

function loadAllItems(): Item[] {
  try {
    return JSON.parse(localStorage.getItem('practice:items') ?? '[]')
  } catch {
    return []
  }
}

export function exportData(): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    activities: getActivities(),
    items: loadAllItems(),
    logs: getLogs(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `practice-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

`getItems(activityId)` filters by activity, so we read all items directly from localStorage to avoid iterating over every activity. This is intentional.

## UI: `src/screens/HomeScreen.tsx`

Add an "Export data" link/button at the bottom of the home screen, below the activity list and Add Activity button:

```tsx
<button
  onClick={exportData}
  className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 text-center"
>
  Export data
</button>
```

Styled as a subtle text link (not a prominent button) since it's a utility action, not a primary flow.

## Edge Cases

- Empty data: exports valid JSON with empty arrays — no special handling needed
- iOS Safari: `<a>` click with `download` attribute may open the file in-browser instead of downloading. Acceptable given the app's "personal use" scope.
