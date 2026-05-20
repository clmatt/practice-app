# Advanced Filter for Auto Practice

**Date:** 2026-05-20  
**Status:** Approved

## Overview

Add boolean tag-expression filtering to the Auto Practice session screen. Simple tag-toggle mode remains the default; an "Advanced Filter" button opens a bottom sheet modal where users can type expressions like `"good" && ("V2" || "V3" || "V4")`. Filters can be named, saved, renamed, and deleted per activity.

---

## Data Model

New type added to `src/types.ts`:

```typescript
interface SavedFilter {
  id: string
  activityId: string
  name: string
  expression: string  // e.g. "good" && ("V2" || "V3" || "V4")
  createdAt: string
}
```

Stored in AsyncStorage under key `practice:saved-filters` as a flat `SavedFilter[]`. All CRUD operations are scoped by `activityId` at query time.

New functions in `src/storage.ts`:
- `getSavedFilters(activityId: string): Promise<SavedFilter[]>`
- `upsertSavedFilter(filter: SavedFilter): Promise<void>`
- `deleteSavedFilter(id: string): Promise<void>`

---

## Expression Parser (`src/filterParser.ts` — new file)

### Grammar

```
expression = or_expr
or_expr    = and_expr ( "||" and_expr )*
and_expr   = not_expr ( "&&" not_expr )*
not_expr   = "!" primary | primary
primary    = '"' tag_name '"' | "(" expression ")"
```

### AST Node Types

```typescript
type FilterNode =
  | { type: 'tag';  value: string }
  | { type: 'and';  left: FilterNode; right: FilterNode }
  | { type: 'or';   left: FilterNode; right: FilterNode }
  | { type: 'not';  operand: FilterNode }
```

### API

```typescript
// Returns AST on success, error string on failure
function parseFilter(expression: string): FilterNode | string

// Evaluates AST against an item's tags
function evaluateFilter(node: FilterNode, tags: string[]): boolean
```

Syntax errors are returned as strings (not thrown) so the UI can display them inline without crashing.

---

## Tag Sanitization

In `AddEditItemScreen`, strip `"` characters from tag names before saving. This keeps tag names safe for use as quoted string literals in expressions.

Tags already stored in AsyncStorage that contain `"` will never match any filter expression (exact string match fails silently) — no crash, no migration needed.

---

## UI Changes

### `PracticeSessionScreen` — new state

```typescript
const [advancedFilter, setAdvancedFilter] = useState<string | null>(null)
const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
const [showFilterModal, setShowFilterModal] = useState(false)
```

### Setup phase

- Existing simple tag-toggle chips remain unchanged and visible by default.
- "⚡ Advanced Filter" button below the tag chips opens the bottom sheet modal.
- When `advancedFilter` is set: hide the tag chips, show the expression badge (tappable to reopen modal).

### Draw phase

- When `advancedFilter` is null: existing tag pill row shown as-is.
- When `advancedFilter` is set: tag pill row replaced by a tappable expression badge (`⚡ "good" && ("V2" || "V3")` with an "edit" label). Tapping reopens the modal.

### Item filtering

```typescript
// When advancedFilter is set, replace existing activeTags logic:
const ast = parseFilter(advancedFilter)
const filtered = typeof ast === 'string'
  ? []  // invalid expression — show no items
  : items.filter(item => evaluateFilter(ast, item.tags ?? []))
```

---

## Bottom Sheet Modal

Single modal component (`AdvancedFilterModal`) used in both setup and draw phases.

**Contents (top to bottom):**

1. **Saved filters list** — one row per saved filter for this activity. Tapping a row loads its expression into the text field. Each row has a `···` button revealing inline Rename and Delete actions.
2. **Expression text field** — multiline, monospace font. Live parse feedback: green "● N items match" on valid expression, red error message on invalid syntax.
3. **Tag chip row** — all tags for this activity. Tapping a chip appends `"tagname"` at the cursor position in the text field.
4. **Action row** — "Apply" button (disabled if expression is invalid or empty) and "Save As…" button (prompts for a name, then saves and applies).

**Clearing the filter:** Tapping "Apply" with an empty expression clears the advanced filter and returns to simple mode.

---

## Saved Filter Management

- **Create:** type an expression → "Save As…" → enter a name → saved and applied.
- **Load:** tap a saved filter row → expression loads into the field → tap "Apply".
- **Rename:** tap `···` on a row → "Rename" → enter new name inline.
- **Delete:** tap `···` on a row → "Delete" → confirm → removed from list.

---

## Out of Scope

- Combining simple tag toggles and advanced filter simultaneously (one mode at a time).
- Importing/exporting saved filters across activities or devices.
- Filter usage analytics.
