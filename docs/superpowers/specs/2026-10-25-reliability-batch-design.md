# Reliability & Structure Batch — Design Spec

**Date:** 2026-10-25
**Status:** Approved

## Goal

A batch of correctness fixes, data-safety improvements and structural cleanups found in a review of the whole app. No schema version bump: every new stored field is optional. Deferred to a later batch: real session records (needs a DB version bump), practice-science features, UI redesigns.

---

## A. Correctness

### A1. Manual colour edits are recorded

**Problem:** changing an item's colour on the Edit screen writes no log. The Stats chart keeps showing the colour from the item's latest log forever, and never-practiced items are drawn in today's colour on every past day.

**Design:**
- `PracticeLog` gets `source?: 'edit'`. Absent means a practice rep (all existing data and backups).
- `saveItem(item)` in `storage.ts`: if an item with that id exists and its colour differs, it also appends a log `{ colorBefore: old, colorAfter: new, source: 'edit', practicedAt: now }` in the **same** `persist()` call (one transaction). Any colour change that isn't practice is therefore logged.
- An internal `practiceLogs()` (logs without `source`) feeds every practice-only query: `getTodayPracticedItemIds`, `getPracticeCountByItem`, `getLastPracticedByItem`, `getNotesForItem`, `getSessionHistory`. Auto Practice recency and "practiced today" are therefore unaffected by edits.
- `getColorDistributionByDay` uses all logs. For days before an item's first log, the colour is that first log's `colorBefore`; with no logs, `item.color`.
- `buildRuns` (item page) takes all of the item's logs; a run's `count` counts practice reps only, and a run started by an edit log is flagged `edited: true`. The item page labels it "(changed manually)" and gives a zero-rep run a short fixed height, so the bar always ends on the current colour.
- `undoPracticeLog` already treats any later log as "rated since"; an edit after a rep correctly blocks restoring the old colour.

### A2. One transaction per rating

`recordPractice({ item, color, note }): string` in `storage.ts` appends the practice log and (if the colour changed) the updated item in one `persist()` call, and returns the log id. `PracticeSessionScreen` and `ManualPracticeScreen` use it instead of `appendLog` + `saveItem`. It writes the item directly (not through `saveItem`), so no edit log is produced.

### A3. Terminology

- A **rep** is one rating (one practice log).
- A **session** is a practice day.

Changes: item page "12 reps total" (was "sessions"); run labels "3 reps · May 1 – 5"; Items list "Last practiced May 3 · 12 reps". Stats ("Sessions", "Total reps") already matches.

### A4. Plurals

- `Activity.itemLabelPlural?: string` (optional override).
- `pluralLabel(activity)` in new `src/labels.ts`: the override if non-blank, otherwise English rules on `itemLabel`: consonant + `y` → `ies`; ends in `s`, `x`, `z`, `ch`, `sh` → `es`; otherwise `s`. Preserves the label's case.
- Activity Settings gets a "Plural (optional)" input whose placeholder shows the automatic plural.
- Every hand-built `${itemLabel}s` (Home, dashboard, Items, Manual Practice, chooser, Stats, delete confirmation, TabBar's `itemsTabLabel`) uses `pluralLabel`.

---

## B. Reliability

### B1. Auto Practice session resume

- New `src/sessionResume.ts`: `saveSession(activityId, state)`, `loadSession(activityId)`, `clearSession(activityId)`. Key `practice-app:auto-session:<activityId>` in `localStorage` (never one of the legacy `practice:*` keys). Every access is wrapped in try/catch; failure means "nothing to resume".
- Stored: `{ day: localDateKey, tags: string[], colors: Color[], advanced: string | null, skipped: string[], sessionLog: [...], currentItemId: string | null }`.
- Saved whenever that state changes during a session (draw, skip, save, undo, filter change).
- On opening Auto Practice: if a saved session exists for **today**, restore filter, skipped and summary. If `currentItemId` still exists, isn't archived and wasn't practiced today, show it in the draw phase; otherwise draw the next item (which may land on done). A session from another day is discarded.
- Cleared by: the Exit button, "Back to <activity>" after completion. Not cleared by reloads or iOS killing the app.
- Why not `sessionStorage`: iOS clears it when it terminates a home-screen app.

### B2. Archive instead of delete

- `Item.archivedAt?: string`.
- `getActiveItems(activityId)` in `storage.ts` (items without `archivedAt`). `getItems` keeps returning all items.
- Uses active items: Auto Practice (pool, tag chips, done counts), Manual Practice list, dashboard counts, the Practice chooser's "has items" check, Add/Edit tag suggestions, Stats "Total <items>".
- Items list: archived items hidden by default; an "Archived" toggle chip in the filter panel shows **only** archived items (kept in the URL as `archived=1`). Archived rows are dimmed with an "Archived" label.
- Chart: an archived item stops counting from the day after its archive date (`date > localDateKey(archivedAt)`). Session history and reps are untouched.
- Edit screen: "Archive <item>" replaces "Delete"; no confirmation; returns to the Items list.
- Item page for an archived item: a line "Archived on <date>", buttons **Unarchive** and **Delete permanently** (keeps the existing `window.confirm`).
- Duplicate-name check on Add/Edit includes archived items, with the message "An archived <item> has that name — unarchive it instead."
- Import/export: `archivedAt` travels with the item; no other change.

### B3. Export first before destructive actions

- New `components/ConfirmDestructive.tsx`: a panel with a message and three buttons — **Export backup, then …** (runs `exportData()`; continues only if it resolved `true`; shows the error if it threw), **… without backup**, **Cancel**.
- Delete activity (Settings): replaces `window.confirm`; message "Deletes <name>, its N <items> and M reps."
- Import: `executeImport` splits into `planImport(payload, actRes, itemRes)` → `{ records, remove: { activityIds, itemIds }, stats }` (pure, no writes) and `applyImport(plan)`. `executeImport` remains as `applyImport(planImport(...))` for existing callers/tests. When the plan removes anything (an activity "replace" or an item "keep imported"), the wizard shows a `confirm` step using the panel before applying, listing what gets removed.

### B4. Import validation

- In `validateImportPayload`, after migration, each record is checked:
  - activity: `id`, `name`, `itemLabel`, `createdAt` strings; `weights.red/yellow/green` finite numbers ≥ 0.
  - item: `id`, `activityId`, `name`, `createdAt` strings; `color` a rating; `tags` absent or an array of strings.
  - log: `id`, `itemId` strings; `practicedAt` a string that parses as a date; `colorBefore`/`colorAfter` ratings; `note` absent or a string.
  - saved filter: `id`, `activityId`, `name`, `expression` strings.
- Invalid records are dropped and counted in `ImportPayload.invalidRecords`, carried to `ImportStats.invalid`; the summary shows "N damaged records were skipped." when > 0.
- A file with no valid activity is rejected as not a backup.

### B5. Version on Home

- `vite.config.ts` defines `__APP_VERSION__` as `<short sha> · <build date>`; the sha comes from `GITHUB_SHA` (first 7 chars) in CI, else `git rev-parse --short HEAD`, else `dev`. Declared in `src/env.d.ts`.
- Home shows it in small grey text at the bottom: "Version 3c760fd · Oct 25, 2026".
- Update behaviour unchanged (silent auto-update).

### B6. WebKit end-to-end test

- Dev dependency `@playwright/test`; `playwright.config.ts` with a single WebKit project and a `webServer` running `npm run preview` on the built `dist/`.
- `e2e/persistence.spec.ts`: create an activity, add an item (red), Manual Practice → rate green, reload, check the item is green and Home says "Practiced today".
- Script `npm run test:e2e`. CI: after `npm run build`, `npx playwright install --with-deps webkit` and `npm run test:e2e`.
- Vitest excludes `e2e/`. The config file and spec are type-checked via `tsconfig.node.json`.

### B7. Smaller items

- `ManualPracticeScreen` tests: rate + save writes one log and updates colour; undo; search; archived items hidden.
- `generateId()` returns `crypto.randomUUID()`.

---

## C. Structure

- `RATINGS` in `palette.ts`: ordered `[{ color: 'red', name: 'Red', label: 'Struggled' }, …]`, plus `RATING_ORDER: Color[]`. Replaces `PRACTICE_COLORS`, the `COLORS` arrays in `ManageItemsScreen`/`itemList`, `LEGEND_ORDER`/`NAMES` in the chart, `ColorPicker`'s `OPTIONS`, the dashboard's inline arrays.
- `components/RatePanel.tsx`: colour picker + note + Save + Back, used by both practice screens.
- `components/NoteList.tsx`: past notes with dates, used by both practice screens and the item page.
- `toggled()` moves to `utils.ts`.
- `src/useActivity.ts`: `useActivity()` reads `activityId` from the route, returns `[activity, setActivity]` (state initialised from storage) and redirects to Home when it's missing. Used by every activity screen.
- `CLAUDE.md`: rules for `recordPractice`, edit logs/`practiceLogs`, archiving/`getActiveItems`, `RATINGS`, `pluralLabel`.

---

## Testing

Test-first for each change. Unit tests for storage (edit logs, recordPractice atomicity, active items, chart fallback, archive cut-off), labels, sessionResume, import validation and planImport; component tests for the practice screens (resume, archive), Items list archive filter, delete-activity panel, import confirm step. Lint, unit tests, build and the WebKit e2e test must all pass before merging to `main`.
