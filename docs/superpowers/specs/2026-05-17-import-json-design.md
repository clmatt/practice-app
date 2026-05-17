# Import JSON Design

**Goal:** Let the user restore or merge data from a previously exported backup JSON file.

**Architecture:** A dedicated `/import` route renders `ImportScreen`, a multi-step wizard managing all state locally. Steps: file select → activity conflict resolution → item conflict resolution → summary. One new storage function needed: `deleteItemWithLogs(itemId)` — deletes an item and all its logs atomically. All other operations use existing `saveActivity`, `saveItem`, `appendLog`, `deleteItem`, `deleteActivity`. All imported entities receive fresh generated IDs; log `itemId` references are remapped before saving.

---

## Entry Point

HomeScreen gets an "Import data" button directly below the existing "Export data" button, styled identically (subtle text link).

---

## File Format

The import file is the output of `exportData()`:

```ts
interface ImportPayload {
  exportedAt: string
  activities: Activity[]
  items: Item[]
  logs: PracticeLog[]
}
```

Validation: file must be valid JSON with `activities`, `items`, and `logs` arrays. If invalid, show an inline error and stop.

---

## Wizard Steps

### Step 1 — File select

A full-screen prompt with a file picker button (`<input type="file" accept=".json">`). On file selection, parse and validate. If valid, identify activity conflicts (imported activity names that match existing activity names) and proceed.

- No conflicts → skip steps 2 and 3, execute import immediately, go to summary.
- Conflicts found → go to step 2.

### Step 2 — Activity conflict resolution

For each conflicting activity, show one screen with:

- Progress indicator: "Activity conflict X of N"
- Side-by-side summary of existing vs. importing (item count, session count)
- Four choices:
  - **Keep existing** — skip imported activity entirely (items + logs discarded)
  - **Replace with imported** — `deleteActivity(existing.id)` then import with fresh IDs
  - **Keep both** — import as "{name} (imported)" with fresh IDs for all entities
  - **Combine** — add non-conflicting items; queue item-level conflicts for step 3
- "Apply to all remaining activity conflicts" checkbox

### Step 3 — Item conflict resolution (Combine only)

For each item name collision within a "Combine" activity, one screen with:

- Progress indicator: "Item conflict X of N"
- Side-by-side: existing item (color, session count) vs. imported item (color, session count)
- Three choices:
  - **Keep existing** — discard imported item and its logs
  - **Keep imported** — `deleteItem(existing.id)` + remove its logs, add imported with fresh IDs
  - **Keep both** — add imported as a second item with fresh IDs and its own logs
- "Apply to all remaining item conflicts" checkbox

### Step 4 — Summary

Single screen: "Import complete." with counts of what was added, merged, and skipped.

---

## ID Handling

Every imported entity always receives a fresh ID from `generateId()`. Before saving logs, build a `Map<oldItemId, newItemId>` and remap each log's `itemId`. This avoids any collision with existing IDs regardless of origin.

---

## Conflict Detection

```
conflicts = importedActivities.filter(a =>
  existingActivities.some(e => e.name === a.name)
)
```

Item conflicts (within a Combine activity):
```
itemConflicts = importedItems.filter(i =>
  i.activityId === importedActivity.id &&
  existingItems.some(e => e.name === i.name)
)
```

---

## Edge Cases

- **Invalid file** — not JSON, or missing required arrays: show "This doesn't look like a valid backup file." Stay on step 1.
- **Empty import** — all arrays empty: no conflicts, import succeeds with zero additions. Summary shows "Nothing to import."
- **No conflicts** — import all data with fresh IDs immediately, skip conflict steps.
- **All activities conflict** — all resolved via wizard; no automatic pass-through.
- **"Replace" deletes all existing data for that activity** — `deleteActivity` already cascades to items and logs.
- **Logs referencing items not in the import** — ignored (orphaned logs from the source app's deleted items).

---

## Files Changed

| File | Change |
|------|--------|
| `src/storage.ts` | Add `deleteItemWithLogs(itemId: string)` |
| `src/screens/ImportScreen.tsx` | New multi-step wizard |
| `src/screens/HomeScreen.tsx` | Add "Import data" button |
| `src/App.tsx` | Add `/import` route |
