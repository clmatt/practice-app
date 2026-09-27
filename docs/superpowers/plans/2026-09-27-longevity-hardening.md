# Longevity Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Practice App safe to leave untouched for years: no silent data loss, no slowdowns as history grows, correct local dates, a deploy pipeline that keeps working, and docs that make it easy to pick back up.

**Architecture:** Storage moves from localStorage to IndexedDB behind the *same synchronous API*: everything is loaded into memory once at startup (`initStorage()`), reads come from memory, writes update memory immediately and are persisted to IndexedDB in an ordered background queue. A schema version + migration chain guards future data-shape changes. Backup/restore moves into `src/backup.ts` and carries the schema version and saved filters.

**Tech Stack:** React 19, TypeScript 6 (`erasableSyntaxOnly` is on — no parameter properties, enums or namespaces), Vite 8, Vitest 4 + jsdom, `fake-indexeddb` (new dev dependency, tests only), GitHub Actions + GitHub Pages.

**Spec:** No separate spec doc. Requirements (agreed with the user in conversation on 2026-09-27):
1. Stats chart calculation must stay fast with years of history (was O(dates × items × logs); 10.7s for 2 years of data).
2. Storage must not silently fail when full; move to IndexedDB (much larger quota) and surface write failures.
3. Data safety: request persistent storage, show "last backup" age on Home, include saved filters in export, make export work well on iPhone (share sheet → Save to Files).
4. Group practice by *local* calendar date everywhere (user is in America/Los_Angeles; UTC grouping pushes evening practice into the next day).
5. Stored data carries a schema version, with a migration chain for future changes; exports carry it too.
6. Top-level error boundary with an Export button so a render crash never locks the user out of their data.
7. CI: current Node/actions versions, run lint + tests before deploying; remove the stale `gh-pages` deploy path; pin Node version.
8. Lint passes with zero errors.
9. Smaller: lazy-load Stats (recharts is most of the bundle); clamp weight inputs to 0–100; deleting an item also deletes its logs.
10. README and CLAUDE.md make it easy to spin up future sessions.

## Global Constraints

- Branch: all work happens on branch `longevity`. Commit after each task and `git push -u origin longevity` (pushing `main` deploys to the user's phone — never push `main` during task work).
- Never `git add -A` / `git add .` — the untracked file `docs/superpowers/plans/2026-05-20-operator-buttons.md` belongs to the user and must not be committed. Add files by path.
- Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Legacy localStorage keys (`practice:activities`, `practice:items`, `practice:logs`, `practice:saved-filters`) must **never be deleted or written** by the new code. They are the safety net for the user's real data.
- No new runtime dependencies. `fake-indexeddb` is the only new dev dependency.
- `tsconfig.app.json` has `erasableSyntaxOnly: true`: do not use TypeScript parameter properties (`constructor(public x: number)`), enums, or namespaces.
- Tests run in timezone `America/Los_Angeles` (configured in Task 3). Before that task, existing tests use times like `T10:00:00.000Z` that are the same calendar date in UTC and LA.
- Verification commands (run from repo root): `npm test`, `npm run lint`, `npm run build`. Node 24 is installed locally.
- Match existing code style: 2-space indent, no semicolons, single quotes, Tailwind classes, slate/violet palette.

## Review Focus

1. **The user's existing data lives in localStorage on their phone.** On first launch of the new version it must appear intact (activities, items, logs, saved filters), and the localStorage copy must remain untouched. → Task 2 tests `migrates legacy localStorage data on first start` and `leaves legacy localStorage untouched`.
2. **Deleting everything must not resurrect old data.** After migration, if the user deletes all activities and relaunches, the legacy localStorage data must NOT be re-imported. → Task 2 test `does not re-import legacy data once the database is initialised`.
3. **Backups made by the old version** (no `schemaVersion`, no `savedFilters`) must still import. A backup from a *newer* app version must be refused with a clear message, not half-imported. → Task 4 tests.
4. **A failed write** (storage full) must not freeze the practice flow: in-memory state keeps working, later writes are still attempted, and a banner offers Export. → Task 2 `storageErrors` tests, Task 5 banner test.
5. **Evening practice in Pacific time** (e.g. 7pm PDT = 02:00Z next day) must count as that local day in the "today" counter, session history, item progress and chart. → Task 3 tests.

---

### Task 1: Data schema version and migration chain

**Files:**
- Create: `src/migrations.ts`
- Test: `src/tests/migrations.test.ts`

**Interfaces:**
- Consumes: types from `src/types.ts` (`Activity`, `Item`, `PracticeLog`, `SavedFilter`).
- Produces:
  - `CURRENT_SCHEMA_VERSION: number` (= 1)
  - `interface DataSnapshot { activities: Activity[]; items: Item[]; logs: PracticeLog[]; savedFilters: SavedFilter[] }`
  - `type Migration = (data: DataSnapshot) => DataSnapshot`
  - `MIGRATIONS: Record<number, Migration>` (empty for now)
  - `class NewerSchemaError extends Error` with fields `found: number`, `supported: number`
  - `migrateSnapshot(data: DataSnapshot, fromVersion: number, migrations?: Record<number, Migration>, targetVersion?: number): DataSnapshot`

- [ ] **Step 1: Write the failing test** — create `src/tests/migrations.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION, migrateSnapshot, NewerSchemaError,
  type DataSnapshot, type Migration,
} from '../migrations'

const snapshot = (): DataSnapshot => ({
  activities: [{ id: 'a1', name: 'Juggling', itemLabel: 'trick', weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z' }],
  items: [{ id: 'i1', activityId: 'a1', name: 'Mills Mess', color: 'red', createdAt: '2026-01-01T00:00:00.000Z' }],
  logs: [],
  savedFilters: [],
})

describe('migrateSnapshot', () => {
  it('current schema version is 1', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1)
  })

  it('returns data unchanged when already at the target version', () => {
    const data = snapshot()
    expect(migrateSnapshot(data, CURRENT_SCHEMA_VERSION)).toEqual(data)
  })

  it('applies each migration step in order', () => {
    const migrations: Record<number, Migration> = {
      1: d => ({ ...d, items: d.items.map(i => ({ ...i, tags: ['v2'] })) }),
      2: d => ({ ...d, items: d.items.map(i => ({ ...i, tags: [...(i.tags ?? []), 'v3'] })) }),
    }
    const result = migrateSnapshot(snapshot(), 1, migrations, 3)
    expect(result.items[0].tags).toEqual(['v2', 'v3'])
  })

  it('starts from the given version, skipping earlier steps', () => {
    const migrations: Record<number, Migration> = {
      1: () => { throw new Error('should not run') },
      2: d => ({ ...d, logs: [] }),
    }
    expect(() => migrateSnapshot(snapshot(), 2, migrations, 3)).not.toThrow()
  })

  it('throws NewerSchemaError when data is newer than the app', () => {
    expect(() => migrateSnapshot(snapshot(), 5, {}, 1)).toThrow(NewerSchemaError)
    try {
      migrateSnapshot(snapshot(), 5, {}, 1)
    } catch (e) {
      expect((e as NewerSchemaError).found).toBe(5)
      expect((e as NewerSchemaError).supported).toBe(1)
    }
  })

  it('throws when a migration step is missing', () => {
    expect(() => migrateSnapshot(snapshot(), 1, {}, 2)).toThrow('No migration from data version 1 to 2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/migrations.test.ts`
Expected: FAIL — cannot resolve `../migrations`.

- [ ] **Step 3: Implement** — create `src/migrations.ts`:

```ts
import type { Activity, Item, PracticeLog, SavedFilter } from './types'

/**
 * Version of the stored data shape.
 *
 * When a change to types.ts means data saved by an older version of the app
 * needs converting, bump this and add a step to MIGRATIONS that converts from
 * the previous version. Migrations run on startup (stored data) and on import
 * (backup files).
 */
export const CURRENT_SCHEMA_VERSION = 1

export interface DataSnapshot {
  activities: Activity[]
  items: Item[]
  logs: PracticeLog[]
  savedFilters: SavedFilter[]
}

export type Migration = (data: DataSnapshot) => DataSnapshot

/** MIGRATIONS[n] converts data from version n to version n + 1. */
export const MIGRATIONS: Record<number, Migration> = {}

export class NewerSchemaError extends Error {
  readonly found: number
  readonly supported: number

  constructor(found: number, supported: number) {
    super(
      `This data was saved by a newer version of the app (data version ${found}; ` +
      `this version understands up to ${supported}). Reload the app to update it.`,
    )
    this.name = 'NewerSchemaError'
    this.found = found
    this.supported = supported
  }
}

export function migrateSnapshot(
  data: DataSnapshot,
  fromVersion: number,
  migrations: Record<number, Migration> = MIGRATIONS,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
): DataSnapshot {
  if (fromVersion > targetVersion) throw new NewerSchemaError(fromVersion, targetVersion)
  let result = data
  for (let v = fromVersion; v < targetVersion; v++) {
    const step = migrations[v]
    if (!step) throw new Error(`No migration from data version ${v} to ${v + 1}`)
    result = step(result)
  }
  return result
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/tests/migrations.test.ts` → PASS (6 tests). Then `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/migrations.ts src/tests/migrations.test.ts
git commit -m "feat: add data schema version and migration chain"
git push -u origin longevity
```

---

### Task 2: IndexedDB storage engine (in-memory cache, background writes, legacy migration)

**Files:**
- Create: `src/db.ts`, `src/components/StartupErrorScreen.tsx`, `src/tests/storageEngine.test.ts`, `src/tests/storageErrors.test.ts`
- Modify: `src/storage.ts` (rewrite internals; keep every existing exported query/mutation signature), `src/main.tsx`, `src/tests/setup.ts`, `src/tests/notes.test.ts` (remove its `localStorage.clear()` beforeEach), `package.json` (dev dep)

**Interfaces:**
- Consumes (Task 1): `CURRENT_SCHEMA_VERSION`, `DataSnapshot`, `migrateSnapshot`, `NewerSchemaError` from `src/migrations.ts`.
- Produces (`src/db.ts`):
  - `DB_NAME = 'practice-app'`
  - `RECORD_STORES = ['activities', 'items', 'logs', 'savedFilters'] as const`, `type RecordStore`
  - `interface Meta { schemaVersion?: number; lastBackupAt?: string }`
  - `type WriteOp = { store: RecordStore; type: 'put'; value: { id: string } } | { store: RecordStore; type: 'delete'; id: string } | { store: RecordStore; type: 'clear' } | { store: 'meta'; type: 'put'; key: keyof Meta; value: unknown }`
  - `openDb(): Promise<IDBDatabase>`, `readAll(db): Promise<DataSnapshot & { meta: Meta }>`, `applyOps(db, ops: WriteOp[]): Promise<void>`, `deleteDb(): Promise<void>`
- Produces (`src/storage.ts`, new exports in addition to all existing ones):
  - `initStorage(): Promise<void>` — must resolve before the app renders; rejects with `NewerSchemaError` if stored data is newer.
  - `onStorageError(listener: (error: unknown) => void): () => void` — returns unsubscribe.
  - `flushWrites(): Promise<void>` — resolves when all queued writes have settled.
  - `getSnapshot(): DataSnapshot` — copies of all four collections.
  - `importRecords(records: Partial<DataSnapshot>): void` — bulk append (used by import, Task 4).
  - `getLastBackupAt(): string | null`, `recordBackup(at?: string): void`
  - Test helpers: `resetStorageForTests(): Promise<void>` (deletes the DB, clears memory), `reopenStorageForTests(): Promise<void>` (simulates an app restart: flush, close, re-init from the DB).

- [ ] **Step 1: Install fake-indexeddb**

Run: `npm install -D fake-indexeddb@^6`

- [ ] **Step 2: Update test setup** — replace `src/tests/setup.ts` with:

```ts
import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
import { beforeEach } from 'vitest'

// Every test starts with an empty database and empty localStorage.
// storage is imported lazily so that vi.mock('../db') in a test file still
// applies (modules imported statically here would load before the mock).
beforeEach(async () => {
  const { initStorage, resetStorageForTests } = await import('../storage')
  localStorage.clear()
  await resetStorageForTests()
  await initStorage()
})
```

In `src/tests/notes.test.ts`, delete the `beforeEach(() => { localStorage.clear() })` block and remove `beforeEach` from its vitest import.

- [ ] **Step 3: Write the failing engine tests** — create `src/tests/storageEngine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  initStorage, resetStorageForTests, reopenStorageForTests, flushWrites,
  getActivities, saveActivity, deleteActivity, getItems, saveItem, getLogs, appendLog,
  getSavedFilters, upsertSavedFilter, importRecords, getSnapshot,
  getLastBackupAt, recordBackup,
} from '../storage'
import { openDb, applyOps } from '../db'
import { NewerSchemaError } from '../migrations'
import type { Activity, Item, PracticeLog, SavedFilter } from '../types'

const activity = (o: Partial<Activity> = {}): Activity => ({
  id: 'act-1', name: 'Juggling', itemLabel: 'trick',
  weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z', ...o,
})
const item = (o: Partial<Item> = {}): Item => ({
  id: 'item-1', activityId: 'act-1', name: 'Mills Mess', color: 'red', createdAt: '2026-01-01T00:00:00.000Z', ...o,
})
const log = (o: Partial<PracticeLog> = {}): PracticeLog => ({
  id: 'log-1', itemId: 'item-1', practicedAt: '2026-01-02T10:00:00.000Z', colorBefore: 'red', colorAfter: 'yellow', ...o,
})
const filter = (o: Partial<SavedFilter> = {}): SavedFilter => ({
  id: 'sf-1', activityId: 'act-1', name: 'Hard', expression: '"hard"', createdAt: '2026-01-01T00:00:00.000Z', ...o,
})

function seedLegacy() {
  localStorage.setItem('practice:activities', JSON.stringify([activity()]))
  localStorage.setItem('practice:items', JSON.stringify([item()]))
  localStorage.setItem('practice:logs', JSON.stringify([log()]))
  localStorage.setItem('practice:saved-filters', JSON.stringify([filter()]))
}

describe('storage engine', () => {
  it('persists writes across an app restart', async () => {
    saveActivity(activity())
    saveItem(item())
    appendLog(log())
    upsertSavedFilter(filter())
    await reopenStorageForTests()
    expect(getActivities()).toEqual([activity()])
    expect(getItems('act-1')).toEqual([item()])
    expect(getLogs()).toEqual([log()])
    expect(getSavedFilters('act-1')).toEqual([filter()])
  })

  it('persists deletes across an app restart', async () => {
    saveActivity(activity())
    saveItem(item())
    appendLog(log())
    deleteActivity('act-1')
    await reopenStorageForTests()
    expect(getSnapshot()).toEqual({ activities: [], items: [], logs: [], savedFilters: [] })
  })

  it('migrates legacy localStorage data on first start', async () => {
    await resetStorageForTests()
    seedLegacy()
    await initStorage()
    expect(getActivities()).toEqual([activity()])
    expect(getItems('act-1')).toEqual([item()])
    expect(getLogs()).toEqual([log()])
    expect(getSavedFilters('act-1')).toEqual([filter()])
    // ...and it was written to IndexedDB, not just memory
    await reopenStorageForTests()
    expect(getActivities()).toEqual([activity()])
  })

  it('leaves legacy localStorage untouched', async () => {
    await resetStorageForTests()
    seedLegacy()
    const before = { ...localStorage }
    await initStorage()
    saveActivity(activity({ id: 'act-2', name: 'Climbing' }))
    await flushWrites()
    expect({ ...localStorage }).toEqual(before)
  })

  it('does not re-import legacy data once the database is initialised', async () => {
    await resetStorageForTests()
    seedLegacy()
    await initStorage()
    deleteActivity('act-1')
    await reopenStorageForTests()
    expect(getActivities()).toEqual([])
  })

  it('ignores corrupt legacy data', async () => {
    await resetStorageForTests()
    localStorage.setItem('practice:activities', '{not json')
    localStorage.setItem('practice:items', '"a string"')
    await initStorage()
    expect(getActivities()).toEqual([])
    expect(getItems('act-1')).toEqual([])
  })

  it('refuses to open data saved by a newer app version', async () => {
    const db = await openDb()
    await applyOps(db, [{ store: 'meta', type: 'put', key: 'schemaVersion', value: 99 }])
    db.close()
    await expect(reopenStorageForTests()).rejects.toBeInstanceOf(NewerSchemaError)
  })

  it('loads collections in chronological order', async () => {
    saveActivity(activity({ id: 'zzz', name: 'Older', createdAt: '2025-01-01T00:00:00.000Z' }))
    saveActivity(activity({ id: 'aaa', name: 'Newer', createdAt: '2026-06-01T00:00:00.000Z' }))
    appendLog(log({ id: 'l-b', practicedAt: '2026-03-01T10:00:00.000Z' }))
    appendLog(log({ id: 'l-a', practicedAt: '2026-02-01T10:00:00.000Z' }))
    await reopenStorageForTests()
    expect(getActivities().map(a => a.name)).toEqual(['Older', 'Newer'])
    expect(getLogs().map(l => l.id)).toEqual(['l-a', 'l-b'])
  })

  it('returned arrays are copies — mutating them does not change storage', () => {
    saveActivity(activity())
    getActivities().pop()
    expect(getActivities()).toHaveLength(1)
  })

  it('importRecords bulk-adds records and persists them', async () => {
    importRecords({
      activities: [activity()],
      items: [item(), item({ id: 'item-2', name: 'Box' })],
      logs: [log(), log({ id: 'log-2' })],
      savedFilters: [filter()],
    })
    await reopenStorageForTests()
    const snap = getSnapshot()
    expect(snap.activities).toHaveLength(1)
    expect(snap.items).toHaveLength(2)
    expect(snap.logs).toHaveLength(2)
    expect(snap.savedFilters).toHaveLength(1)
  })

  it('records the last backup time and persists it', async () => {
    expect(getLastBackupAt()).toBeNull()
    recordBackup('2026-09-01T12:00:00.000Z')
    await reopenStorageForTests()
    expect(getLastBackupAt()).toBe('2026-09-01T12:00:00.000Z')
  })
})
```

- [ ] **Step 4: Write the failing write-error tests** — create `src/tests/storageErrors.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('../db', async importOriginal => {
  const actual = await importOriginal<typeof import('../db')>()
  return { ...actual, applyOps: vi.fn(actual.applyOps) }
})

import { applyOps } from '../db'
import { saveActivity, getActivities, onStorageError, flushWrites } from '../storage'
import type { Activity } from '../types'

const activity = (o: Partial<Activity> = {}): Activity => ({
  id: 'act-1', name: 'Juggling', itemLabel: 'trick',
  weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z', ...o,
})

describe('storage write failures', () => {
  it('notifies listeners, keeps in-memory data, and keeps attempting later writes', async () => {
    vi.mocked(applyOps).mockRejectedValueOnce(new DOMException('Storage full', 'QuotaExceededError'))
    const listener = vi.fn()
    const unsubscribe = onStorageError(listener)

    saveActivity(activity())
    await flushWrites()
    expect(listener).toHaveBeenCalledTimes(1)
    expect((listener.mock.calls[0][0] as DOMException).name).toBe('QuotaExceededError')
    expect(getActivities()).toHaveLength(1)

    saveActivity(activity({ id: 'act-2', name: 'Climbing' }))
    await flushWrites()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(vi.mocked(applyOps).mock.calls.at(-1)?.[1]).toEqual([
      { store: 'activities', type: 'put', value: activity({ id: 'act-2', name: 'Climbing' }) },
    ])
    unsubscribe()
  })

  it('unsubscribed listeners are not called', async () => {
    vi.mocked(applyOps).mockRejectedValueOnce(new Error('boom'))
    const listener = vi.fn()
    onStorageError(listener)()
    saveActivity(activity())
    await flushWrites()
    expect(listener).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `initStorage`/`resetStorageForTests` etc. are not exported, `../db` not found.

- [ ] **Step 6: Implement `src/db.ts`**

```ts
import type { DataSnapshot } from './migrations'

/**
 * Thin promise wrapper around IndexedDB. Only storage.ts should use this.
 * Record stores are keyed by `id`; the meta store holds single values by key.
 */

export const DB_NAME = 'practice-app'
const DB_VERSION = 1

export const RECORD_STORES = ['activities', 'items', 'logs', 'savedFilters'] as const
export type RecordStore = typeof RECORD_STORES[number]
const META_STORE = 'meta'

export interface Meta {
  schemaVersion?: number
  lastBackupAt?: string
}

export type WriteOp =
  | { store: RecordStore; type: 'put'; value: { id: string } }
  | { store: RecordStore; type: 'delete'; id: string }
  | { store: RecordStore; type: 'clear' }
  | { store: 'meta'; type: 'put'; key: keyof Meta; value: unknown }

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of RECORD_STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function readAll(db: IDBDatabase): Promise<DataSnapshot & { meta: Meta }> {
  const tx = db.transaction([...RECORD_STORES, META_STORE], 'readonly')
  const [activities, items, logs, savedFilters, metaKeys, metaValues] = await Promise.all([
    request(tx.objectStore('activities').getAll()),
    request(tx.objectStore('items').getAll()),
    request(tx.objectStore('logs').getAll()),
    request(tx.objectStore('savedFilters').getAll()),
    request(tx.objectStore(META_STORE).getAllKeys()),
    request(tx.objectStore(META_STORE).getAll()),
  ])
  const meta: Record<string, unknown> = {}
  metaKeys.forEach((key, i) => { meta[String(key)] = metaValues[i] })
  return { activities, items, logs, savedFilters, meta: meta as Meta }
}

/** Applies all ops in a single transaction: either all succeed or none do. */
export function applyOps(db: IDBDatabase, ops: WriteOp[]): Promise<void> {
  if (ops.length === 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...new Set(ops.map(op => op.store))], 'readwrite')
    for (const op of ops) {
      const store = tx.objectStore(op.store)
      if (op.store === 'meta') store.put(op.value, op.key)
      else if (op.type === 'put') store.put(op.value)
      else if (op.type === 'delete') store.delete(op.id)
      else store.clear()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Database write was aborted'))
  })
}

export function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
```

(If TypeScript can't narrow `op` inside the loop, add explicit narrowing; behaviour must stay as written. `db.transaction(...)` may throw synchronously, e.g. if the connection is closed — because it's inside the Promise executor, that becomes a rejection, which is what we want.)

- [ ] **Step 7: Rewrite `src/storage.ts` internals**

Replace the top of the file (imports, `KEYS`, `load`, `save`, `isToday`) and every function body that used `load`/`save` so that all reads come from the in-memory `state` and all writes go through `persist`. **Keep every existing exported function name and signature**, and keep the query functions' logic (`getColorDistributionByDay`, `getSessionHistory`, etc.) identical apart from reading `state.*` instead of `getLogs()`/`getItems()` where convenient. `isToday` stays as-is for now (Task 3 changes it).

New top of file:

```ts
import type { Activity, Item, PracticeLog, Color, SessionSummary, SavedFilter } from './types'
import { openDb, readAll, applyOps, deleteDb, type Meta, type RecordStore, type WriteOp } from './db'
import { CURRENT_SCHEMA_VERSION, migrateSnapshot, type DataSnapshot } from './migrations'

export type { SessionSummary, SavedFilter } from './types'

/*
 * How storage works
 * -----------------
 * All data is loaded into memory once at startup (initStorage, called from
 * main.tsx before the app renders). Reads are synchronous and come from
 * memory. Writes update memory immediately, then are saved to IndexedDB in
 * the background, one transaction at a time, in order. If a background save
 * fails (e.g. the device is out of space), onStorageError listeners are told
 * so the UI can warn the user to export.
 *
 * Rules: never mutate the arrays in `state` in place — replace them. Getters
 * return copies. The order of getLogs() is not guaranteed; sort if it matters.
 */

// Where the app kept its data before IndexedDB. Read once, on the first start
// with an empty database. Never write or delete these: they are a safety net.
const LEGACY_KEYS = {
  activities: 'practice:activities',
  items: 'practice:items',
  logs: 'practice:logs',
  savedFilters: 'practice:saved-filters',
} as const

interface State extends DataSnapshot {
  meta: Meta
}

const emptyState = (): State => ({ activities: [], items: [], logs: [], savedFilters: [], meta: {} })

let state: State = emptyState()
let db: IDBDatabase | null = null
let writeQueue: Promise<void> = Promise.resolve()
const errorListeners = new Set<(error: unknown) => void>()

function readLegacy<T>(key: string): T[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const byCreatedAt = <T extends { createdAt: string }>(a: T, b: T) => a.createdAt.localeCompare(b.createdAt)

function inChronologicalOrder(data: DataSnapshot): DataSnapshot {
  return {
    activities: [...data.activities].sort(byCreatedAt),
    items: [...data.items].sort(byCreatedAt),
    logs: [...data.logs].sort((a, b) => a.practicedAt.localeCompare(b.practicedAt)),
    savedFilters: [...data.savedFilters].sort(byCreatedAt),
  }
}

const puts = (store: RecordStore, records: { id: string }[]): WriteOp[] =>
  records.map(value => ({ store, type: 'put', value }))

const deletes = (store: RecordStore, ids: Iterable<string>): WriteOp[] =>
  [...ids].map(id => ({ store, type: 'delete', id }))

/** Ops that replace everything in the database with `data` at the current schema version. */
function replaceAllOps(data: DataSnapshot): WriteOp[] {
  return [
    { store: 'activities', type: 'clear' },
    { store: 'items', type: 'clear' },
    { store: 'logs', type: 'clear' },
    { store: 'savedFilters', type: 'clear' },
    ...puts('activities', data.activities),
    ...puts('items', data.items),
    ...puts('logs', data.logs),
    ...puts('savedFilters', data.savedFilters),
    { store: 'meta', type: 'put', key: 'schemaVersion', value: CURRENT_SCHEMA_VERSION },
  ]
}

export async function initStorage(): Promise<void> {
  const database = await openDb()
  try {
    await loadFrom(database)
  } catch (error) {
    database.close() // an open connection would block deleting/upgrading the database
    throw error
  }
  db = database
  void requestPersistentStorage()
}

async function loadFrom(database: IDBDatabase): Promise<void> {
  const loaded = await readAll(database)

  let data: DataSnapshot
  if (loaded.meta.schemaVersion === undefined) {
    // First start on IndexedDB: bring over anything the localStorage version saved.
    data = migrateSnapshot({
      activities: readLegacy<Activity>(LEGACY_KEYS.activities),
      items: readLegacy<Item>(LEGACY_KEYS.items),
      logs: readLegacy<PracticeLog>(LEGACY_KEYS.logs),
      savedFilters: readLegacy<SavedFilter>(LEGACY_KEYS.savedFilters),
    }, 1)
    await applyOps(database, replaceAllOps(data))
  } else {
    const fromVersion = loaded.meta.schemaVersion
    data = migrateSnapshot({
      activities: loaded.activities,
      items: loaded.items,
      logs: loaded.logs,
      savedFilters: loaded.savedFilters,
    }, fromVersion)
    if (fromVersion < CURRENT_SCHEMA_VERSION) await applyOps(database, replaceAllOps(data))
  }

  state = { ...inChronologicalOrder(data), meta: { ...loaded.meta, schemaVersion: CURRENT_SCHEMA_VERSION } }
}

/** Asks the browser not to evict our data under storage pressure. Best effort. */
async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    // Not supported or refused — nothing more we can do.
  }
}

function persist(ops: WriteOp[]): void {
  const database = db
  if (!database) throw new Error('initStorage() must finish before data can be saved')
  writeQueue = writeQueue
    .then(() => applyOps(database, ops))
    .catch(error => {
      console.error('Failed to save to IndexedDB', error)
      for (const listener of errorListeners) listener(error)
    })
}

export function onStorageError(listener: (error: unknown) => void): () => void {
  errorListeners.add(listener)
  return () => { errorListeners.delete(listener) }
}

/** Resolves once every write queued so far has been saved (or has failed). */
export function flushWrites(): Promise<void> {
  return writeQueue
}

export function getSnapshot(): DataSnapshot {
  return {
    activities: [...state.activities],
    items: [...state.items],
    logs: [...state.logs],
    savedFilters: [...state.savedFilters],
  }
}

/** Adds many records at once (used by import). Records must have fresh ids. */
export function importRecords(records: Partial<DataSnapshot>): void {
  const activities = records.activities ?? []
  const items = records.items ?? []
  const logs = records.logs ?? []
  const savedFilters = records.savedFilters ?? []
  state = {
    ...state,
    activities: [...state.activities, ...activities],
    items: [...state.items, ...items],
    logs: [...state.logs, ...logs],
    savedFilters: [...state.savedFilters, ...savedFilters],
  }
  persist([
    ...puts('activities', activities),
    ...puts('items', items),
    ...puts('logs', logs),
    ...puts('savedFilters', savedFilters),
  ])
}

export function getLastBackupAt(): string | null {
  return state.meta.lastBackupAt ?? null
}

export function recordBackup(at: string = new Date().toISOString()): void {
  state = { ...state, meta: { ...state.meta, lastBackupAt: at } }
  persist([{ store: 'meta', type: 'put', key: 'lastBackupAt', value: at }])
}

// --- Test helpers ---

/** Deletes the database and clears memory. Call initStorage() afterwards. */
export async function resetStorageForTests(): Promise<void> {
  await writeQueue
  db?.close()
  db = null
  state = emptyState()
  writeQueue = Promise.resolve()
  await deleteDb()
}

/** Simulates an app restart: waits for pending writes, then reloads from the database. */
export async function reopenStorageForTests(): Promise<void> {
  await writeQueue
  db?.close()
  db = null
  state = emptyState()
  await initStorage()
}

function upsert<T extends { id: string }>(list: T[], record: T): T[] {
  const idx = list.findIndex(r => r.id === record.id)
  return idx >= 0 ? list.map((r, i) => (i === idx ? record : r)) : [...list, record]
}
```

Rewritten mutations/getters (replace the old bodies; keep the rest of the file's query functions but have them read `state.items` / `state.logs` directly instead of calling `getItems`/`getLogs` where that avoids needless copying):

```ts
// --- Activities ---

export function getActivities(): Activity[] {
  return [...state.activities]
}

export function saveActivity(activity: Activity): void {
  state = { ...state, activities: upsert(state.activities, activity) }
  persist([{ store: 'activities', type: 'put', value: activity }])
}

export function deleteActivity(id: string): void {
  const itemIds = new Set(state.items.filter(i => i.activityId === id).map(i => i.id))
  const logIds = state.logs.filter(l => itemIds.has(l.itemId)).map(l => l.id)
  const filterIds = state.savedFilters.filter(f => f.activityId === id).map(f => f.id)
  state = {
    ...state,
    activities: state.activities.filter(a => a.id !== id),
    items: state.items.filter(i => !itemIds.has(i.id)),
    logs: state.logs.filter(l => !itemIds.has(l.itemId)),
    savedFilters: state.savedFilters.filter(f => f.activityId !== id),
  }
  persist([
    ...deletes('activities', [id]),
    ...deletes('items', itemIds),
    ...deletes('logs', logIds),
    ...deletes('savedFilters', filterIds),
  ])
}

// --- Items ---

export function getItems(activityId: string): Item[] {
  return state.items.filter(i => i.activityId === activityId)
}

export function getAllItems(): Item[] {
  return [...state.items]
}

export function saveItem(item: Item): void {
  state = { ...state, items: upsert(state.items, item) }
  persist([{ store: 'items', type: 'put', value: item }])
}

export function deleteItem(id: string): void {
  state = { ...state, items: state.items.filter(i => i.id !== id) }
  persist(deletes('items', [id]))
}

export function deleteItemWithLogs(itemId: string): void {
  const logIds = state.logs.filter(l => l.itemId === itemId).map(l => l.id)
  state = {
    ...state,
    items: state.items.filter(i => i.id !== itemId),
    logs: state.logs.filter(l => l.itemId !== itemId),
  }
  persist([...deletes('items', [itemId]), ...deletes('logs', logIds)])
}

// --- Logs ---

export function getLogs(): PracticeLog[] {
  return [...state.logs]
}

export function appendLog(log: PracticeLog): void {
  state = { ...state, logs: [...state.logs, log] }
  persist([{ store: 'logs', type: 'put', value: log }])
}

// --- Saved Filters ---

export function getSavedFilters(activityId: string): SavedFilter[] {
  return state.savedFilters.filter(f => f.activityId === activityId)
}

export function upsertSavedFilter(filter: SavedFilter): void {
  state = { ...state, savedFilters: upsert(state.savedFilters, filter) }
  persist([{ store: 'savedFilters', type: 'put', value: filter }])
}

export function deleteSavedFilter(id: string): void {
  state = { ...state, savedFilters: state.savedFilters.filter(f => f.id !== id) }
  persist(deletes('savedFilters', [id]))
}
```

- [ ] **Step 8: Startup error screen** — create `src/components/StartupErrorScreen.tsx`:

```tsx
import { NewerSchemaError } from '../migrations'

export default function StartupErrorScreen({ error }: { error: unknown }) {
  const isNewer = error instanceof NewerSchemaError
  return (
    <div
      className="h-full bg-slate-950 text-slate-100 max-w-md mx-auto p-6 flex flex-col justify-center gap-4"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <h1 className="text-xl font-bold">
        {isNewer ? 'Update needed' : "Couldn't open your data"}
      </h1>
      <p className="text-slate-400 text-sm">
        {isNewer
          ? (error as NewerSchemaError).message
          : 'The app could not open its storage. Nothing has been deleted. Try reloading; if this keeps happening, check that the browser is not in private mode and has free space.'}
      </p>
      {!isNewer && error instanceof Error && (
        <p className="text-xs text-slate-500 font-mono break-words">{error.message}</p>
      )}
      <button
        onClick={() => window.location.reload()}
        className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold"
      >
        Reload
      </button>
    </div>
  )
}
```

- [ ] **Step 9: Initialise storage before rendering** — replace `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import StartupErrorScreen from './components/StartupErrorScreen'
import { initStorage } from './storage'

const root = createRoot(document.getElementById('root')!)

initStorage().then(
  () => root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
  error => {
    console.error('Failed to initialise storage', error)
    root.render(<StartupErrorScreen error={error} />)
  },
)
```

- [ ] **Step 10: Run the full suite** — `npm test` → all tests pass (existing storage/notes/importScreen/utils tests must pass unchanged apart from the setup change). `npm run build` → succeeds. Also `npx tsc -b` clean.

If `storageErrors.test.ts` shows the mock isn't applied (listener never called), the `vi.mock('../db')` isn't reaching the storage module instance — check that `setup.ts` imports storage dynamically as shown. If fake-indexeddb reports `structuredClone` missing under jsdom, polyfill it at the top of `setup.ts` with Node's global before importing `fake-indexeddb/auto`.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/db.ts src/storage.ts src/main.tsx src/components/StartupErrorScreen.tsx src/tests/setup.ts src/tests/notes.test.ts src/tests/storageEngine.test.ts src/tests/storageErrors.test.ts
git commit -m "feat: move storage to IndexedDB with in-memory cache and legacy migration"
git push
```

---

### Task 3: Group practice by local calendar date

**Files:**
- Create: `src/dates.ts`, `src/tests/dates.test.ts`
- Modify: `vite.config.ts` (test timezone), `src/storage.ts` (`isToday`, `getColorDistributionByDay`, `getSessionHistory`), `src/screens/ItemProgressScreen.tsx` (`buildRuns`, `formatDateRange`), `src/screens/StatsScreen.tsx` (`formatDate`, `formatShortDate`), `src/screens/HomeScreen.tsx` (`lastPracticedLabel`)
- Test: `src/tests/dates.test.ts`, plus new cases in `src/tests/storage.test.ts` and `src/tests/itemProgress.test.ts`

**Interfaces:**
- Produces (`src/dates.ts`):
  - `localDateKey(value: string | Date): string` — `'YYYY-MM-DD'` in the device's timezone
  - `daysBetweenKeys(from: string, to: string): number` — calendar days from `from` to `to`
  - `formatDateKey(key: string, options: Intl.DateTimeFormatOptions): string` — `en-US` display of a date key

- [ ] **Step 1: Pin the test timezone** — in `vite.config.ts`, inside `test: { ... }`, add:

```ts
    // Tests assume the user's timezone so local-date behaviour is exercised
    // (UTC-7/-8: evening practice is already "tomorrow" in UTC).
    env: { TZ: 'America/Los_Angeles' },
```

- [ ] **Step 2: Write failing tests** — create `src/tests/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { localDateKey, daysBetweenKeys, formatDateKey } from '../dates'

describe('test environment', () => {
  it('runs in America/Los_Angeles', () => {
    // 01:00Z on May 16 is 6pm PDT on May 15
    expect(new Date('2026-05-16T01:00:00.000Z').getHours()).toBe(18)
  })
})

describe('localDateKey', () => {
  it('uses the local date, not the UTC date', () => {
    expect(localDateKey('2026-05-16T01:00:00.000Z')).toBe('2026-05-15')
  })

  it('accepts a Date', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('pads month and day', () => {
    expect(localDateKey(new Date(2026, 2, 7, 12))).toBe('2026-03-07')
  })
})

describe('daysBetweenKeys', () => {
  it('counts calendar days', () => {
    expect(daysBetweenKeys('2026-05-15', '2026-05-15')).toBe(0)
    expect(daysBetweenKeys('2026-05-15', '2026-05-16')).toBe(1)
    expect(daysBetweenKeys('2026-02-27', '2026-03-02')).toBe(3)
  })

  it('is not thrown off by daylight saving changes', () => {
    // US DST starts 2026-03-08
    expect(daysBetweenKeys('2026-03-07', '2026-03-09')).toBe(2)
  })
})

describe('formatDateKey', () => {
  it('formats a key without shifting the day', () => {
    expect(formatDateKey('2026-05-15', { month: 'long', day: 'numeric', year: 'numeric' })).toBe('May 15, 2026')
  })
})
```

Append to `src/tests/storage.test.ts` (add `vi, afterEach` to its vitest import):

```ts
describe('local calendar dates', () => {
  afterEach(() => { vi.useRealTimers() })

  it('getSessionHistory groups evening practice with the same local day', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1', name: 'Mills Mess' }))
    // 1pm and 6:30pm PDT on May 15, then 9am PDT on May 16
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-15T20:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i1', practicedAt: '2026-05-16T01:30:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    appendLog(makeLog({ id: 'l3', itemId: 'i1', practicedAt: '2026-05-16T16:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    const sessions = getSessionHistory('act-1')
    expect(sessions.map(s => s.date)).toEqual(['2026-05-16', '2026-05-15'])
  })

  it('getTodayPracticedItemIds uses the local day', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-16T02:00:00.000Z')) // 7pm PDT May 15
    saveItem(makeItem({ id: 'item-1', activityId: 'act-1' }))
    saveItem(makeItem({ id: 'item-2', activityId: 'act-1' }))
    appendLog(makeLog({ id: 'l1', itemId: 'item-1', practicedAt: '2026-05-15T22:00:00.000Z' })) // 3pm May 15
    appendLog(makeLog({ id: 'l2', itemId: 'item-2', practicedAt: '2026-05-15T06:00:00.000Z' })) // 11pm May 14
    const ids = getTodayPracticedItemIds('act-1')
    expect(ids.has('item-1')).toBe(true)
    expect(ids.has('item-2')).toBe(false)
  })

  it('getColorDistributionByDay uses local dates', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1', color: 'yellow', createdAt: '2026-05-01T00:00:00.000Z' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-16T01:30:00.000Z', colorBefore: 'red', colorAfter: 'yellow' }))
    expect(getColorDistributionByDay('act-1').map(d => d.date)).toEqual(['2026-05-15'])
  })
})
```

(Also add `getColorDistributionByDay` to the storage import at the top of `storage.test.ts`.)

Append to `src/tests/itemProgress.test.ts` inside the `describe('buildRuns', ...)`:

```ts
  it('dates runs by local day', () => {
    // 8pm PDT May 1
    const runs = buildRuns([makeLog('green', '2026-05-02T03:00:00.000Z')])
    expect(runs[0].startDate).toBe('2026-05-01')
  })
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `../dates` missing; the new storage/buildRuns tests fail with UTC dates (e.g. `'2026-05-16'` instead of `'2026-05-15'`).

- [ ] **Step 4: Implement `src/dates.ts`**

```ts
/**
 * Calendar dates in the device's local timezone.
 *
 * Timestamps are stored as UTC ISO strings. Never use iso.slice(0, 10) to get
 * "the day" — that's the UTC date, which for US evenings is already tomorrow.
 */

/** 'YYYY-MM-DD' for the local calendar day containing `value`. */
export function localDateKey(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Whole calendar days from `from` to `to` (both 'YYYY-MM-DD'); positive if `to` is later. */
export function daysBetweenKeys(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

/** Formats a 'YYYY-MM-DD' key for display (en-US), e.g. "May 15, 2026". */
export function formatDateKey(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(key + 'T00:00:00').toLocaleDateString('en-US', options)
}
```

- [ ] **Step 5: Use local dates everywhere**

`src/storage.ts` — add `import { localDateKey } from './dates'` and:
- Replace `isToday` with:
  ```ts
  function isToday(iso: string): boolean {
    return localDateKey(iso) === localDateKey(new Date())
  }
  ```
- In `getColorDistributionByDay`: replace `l.practicedAt.slice(0, 10)` (both places) with `localDateKey(l.practicedAt)` and `item.createdAt.slice(0, 10)` with `localDateKey(item.createdAt)`.
- In `getSessionHistory`: `const date = localDateKey(log.practicedAt)`.

`src/screens/ItemProgressScreen.tsx` — `import { localDateKey, formatDateKey } from '../dates'`; in `buildRuns` use `const date = localDateKey(log.practicedAt)`; replace `formatDateRange`'s inner `fmt` with `const fmt = (d: string) => formatDateKey(d, { month: 'short', day: 'numeric' })`.

`src/screens/StatsScreen.tsx` — `import { localDateKey, formatDateKey } from '../dates'`; replace the two formatters with:
```ts
function formatDate(dateKey: string): string {
  return formatDateKey(dateKey, { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatShortDate(iso: string): string {
  return formatDateKey(localDateKey(iso), { month: 'long', day: 'numeric' })
}
```

`src/screens/HomeScreen.tsx` — `import { localDateKey, daysBetweenKeys } from '../dates'`; replace the `mostRecent`/`today`/`diffDays` computation with:
```ts
  const mostRecent = dates.reduce((a, b) => (a > b ? a : b))
  const diffDays = daysBetweenKeys(localDateKey(mostRecent), localDateKey(new Date()))
```

Search for leftovers: `grep -rn "slice(0, 10)" src --include=*.ts --include=*.tsx | grep -v tests/` → only `src/utils.ts` (export filename; Task 4 replaces it) may remain.

- [ ] **Step 6: Run tests** — `npm test` → all pass. `npm run build` → succeeds.

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts src/dates.ts src/tests/dates.test.ts src/storage.ts src/tests/storage.test.ts src/screens/ItemProgressScreen.tsx src/tests/itemProgress.test.ts src/screens/StatsScreen.tsx src/screens/HomeScreen.tsx
git commit -m "fix: group practice by local calendar date instead of UTC"
git push
```

---

### Task 4: Backup file module — versioned export with saved filters, share sheet, last-backup tracking, import

**Files:**
- Create: `src/backup.ts`, `src/tests/backup.test.ts`
- Delete: `src/utils.ts`'s `exportData` (keep `generateId`), `src/tests/utils.test.ts`, `src/tests/importScreen.test.ts` (their tests move into `backup.test.ts`)
- Modify: `src/screens/ImportScreen.tsx` (import logic moves out; UI stays), `src/screens/HomeScreen.tsx` (export button + last-backup line)

**Interfaces:**
- Consumes: `getSnapshot`, `importRecords`, `recordBackup`, `getLastBackupAt`, `getActivities`, `getItems`, `getSavedFilters`, `deleteActivity`, `deleteItemWithLogs` (storage, Task 2); `CURRENT_SCHEMA_VERSION`, `migrateSnapshot`, `NewerSchemaError` (Task 1); `localDateKey`, `daysBetweenKeys` (Task 3); `generateId` (utils).
- Produces (`src/backup.ts`):
  - `interface BackupFile { app: 'practice-app'; schemaVersion: number; exportedAt: string; activities; items; logs; savedFilters }`
  - `interface ImportPayload { exportedAt: string; activities: Activity[]; items: Item[]; logs: PracticeLog[]; savedFilters?: SavedFilter[] }`
  - `buildBackup(now?: Date): BackupFile`
  - `backupFileName(now?: Date): string` → `practice-backup-YYYY-MM-DD.json` (local date)
  - `exportData(): Promise<boolean>` — true if saved/shared, false if the user cancelled the share sheet
  - `describeLastBackup(lastBackupAt: string | null, now?: Date): { text: string; stale: boolean }`
  - `BACKUP_STALE_DAYS = 30`
  - `validateImportPayload(raw: unknown): ImportPayload | null` — throws `NewerSchemaError` for backups from a newer app
  - `findActivityConflicts`, `findItemConflicts`, `executeImport` and types `ActivityResolution`, `ItemResolution`, `ImportStats`, `ItemConflict` — same signatures as today in `ImportScreen.tsx`

- [ ] **Step 1: Move the existing tests** — `git mv src/tests/importScreen.test.ts src/tests/backup.test.ts`. In it, change the import source from `'../screens/ImportScreen'` to `'../backup'`. Then append the export tests below, and delete `src/tests/utils.test.ts` (`git rm`). Add `vi, beforeEach, afterEach` to the vitest import and add `getSavedFilters, upsertSavedFilter, recordBackup, getLastBackupAt` to the storage import, and `buildBackup, backupFileName, exportData, describeLastBackup` to the `../backup` import, plus `import { NewerSchemaError } from '../migrations'` and `SavedFilter` to the types import.

Append:

```ts
const makeFilter = (overrides: Partial<SavedFilter> = {}): SavedFilter => ({
  id: 'sf-1',
  activityId: 'act-1',
  name: 'Hard ones',
  expression: '"hard"',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('buildBackup', () => {
  it('includes app id, schema version, all collections and saved filters', () => {
    saveActivity(makeActivity())
    saveItem(makeItem())
    appendLog(makeLog())
    upsertSavedFilter(makeFilter())
    const backup = buildBackup(new Date('2026-05-16T01:00:00.000Z'))
    expect(backup.app).toBe('practice-app')
    expect(backup.schemaVersion).toBe(1)
    expect(backup.exportedAt).toBe('2026-05-16T01:00:00.000Z')
    expect(backup.activities).toHaveLength(1)
    expect(backup.items).toHaveLength(1)
    expect(backup.logs).toHaveLength(1)
    expect(backup.savedFilters).toEqual([makeFilter()])
  })

  it('names the file with the local date', () => {
    // 6pm PDT on May 15
    expect(backupFileName(new Date('2026-05-16T01:00:00.000Z'))).toBe('practice-backup-2026-05-15.json')
  })
})

describe('exportData', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function stubDownload() {
    const blobs: Blob[] = []
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => { blobs.push(blob); return 'blob:mock-url' },
      revokeObjectURL: vi.fn(),
    })
    const clicks: string[] = []
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag)
      if (tag === 'a') vi.spyOn(el, 'click').mockImplementation(() => { clicks.push((el as HTMLAnchorElement).download) })
      return el
    })
    return { blobs, clicks }
  }

  it('downloads the backup when sharing files is unavailable, and records the backup', async () => {
    const { blobs, clicks } = stubDownload()
    saveActivity(makeActivity())
    expect(await exportData()).toBe(true)
    expect(clicks[0]).toMatch(/^practice-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const parsed = JSON.parse(await blobs[0].text())
    expect(parsed.activities).toHaveLength(1)
    expect(parsed.schemaVersion).toBe(1)
    expect(getLastBackupAt()).not.toBeNull()
  })

  it('uses the share sheet when files can be shared', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    expect(await exportData()).toBe(true)
    expect(share).toHaveBeenCalledTimes(1)
    const file = share.mock.calls[0][0].files[0] as File
    expect(file.name).toMatch(/^practice-backup-.*\.json$/)
    expect(getLastBackupAt()).not.toBeNull()
  })

  it('returns false and records nothing when the share sheet is cancelled', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    expect(await exportData()).toBe(false)
    expect(getLastBackupAt()).toBeNull()
  })

  it('falls back to download when sharing fails for another reason', async () => {
    const { clicks } = stubDownload()
    const share = vi.fn().mockRejectedValue(new DOMException('nope', 'NotAllowedError'))
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    expect(await exportData()).toBe(true)
    expect(clicks).toHaveLength(1)
  })
})

describe('describeLastBackup', () => {
  const now = new Date('2026-09-27T19:00:00.000Z') // noon PDT Sep 27

  it('never backed up is stale', () => {
    expect(describeLastBackup(null, now)).toEqual({ text: 'Never backed up', stale: true })
  })

  it('today / yesterday / N days ago', () => {
    expect(describeLastBackup('2026-09-27T16:00:00.000Z', now)).toEqual({ text: 'Last backup: today', stale: false })
    expect(describeLastBackup('2026-09-26T16:00:00.000Z', now)).toEqual({ text: 'Last backup: yesterday', stale: false })
    expect(describeLastBackup('2026-09-17T16:00:00.000Z', now)).toEqual({ text: 'Last backup: 10 days ago', stale: false })
  })

  it('30 or more days is stale', () => {
    expect(describeLastBackup('2026-08-28T16:00:00.000Z', now).stale).toBe(true)
  })
})

describe('import: versions and saved filters', () => {
  it('accepts backups from before schemaVersion and savedFilters existed', () => {
    const old = { exportedAt: '2026-01-01T00:00:00.000Z', activities: [], items: [], logs: [] }
    expect(validateImportPayload(old)).toEqual({ ...old, savedFilters: [] })
  })

  it('rejects backups from a newer app version', () => {
    const newer = { app: 'practice-app', schemaVersion: 99, exportedAt: '', activities: [], items: [], logs: [], savedFilters: [] }
    expect(() => validateImportPayload(newer)).toThrow(NewerSchemaError)
  })

  it('imports saved filters with the new activity id', () => {
    const payload = makePayload({ activities: [makeActivity()], savedFilters: [makeFilter()] })
    executeImport(payload, new Map(), new Map())
    const act = getActivities()[0]
    expect(getSavedFilters(act.id).map(f => f.name)).toEqual(['Hard ones'])
    expect(getSavedFilters(act.id)[0].id).not.toBe('sf-1')
  })

  it('combine adds only saved filters whose name is new to the existing activity', () => {
    saveActivity(makeActivity({ id: 'existing' }))
    upsertSavedFilter(makeFilter({ id: 'mine', activityId: 'existing', name: 'Hard ones' }))
    const payload = makePayload({
      activities: [makeActivity()],
      savedFilters: [makeFilter(), makeFilter({ id: 'sf-2', name: 'Easy ones', expression: '"easy"' })],
    })
    executeImport(payload, new Map([['act-1', 'combine']]), new Map())
    expect(getSavedFilters('existing').map(f => f.name).sort()).toEqual(['Easy ones', 'Hard ones'])
  })

  it('keep-existing skips saved filters too', () => {
    saveActivity(makeActivity({ id: 'existing' }))
    executeImport(makePayload({ activities: [makeActivity()], savedFilters: [makeFilter()] }), new Map([['act-1', 'keep-existing']]), new Map())
    expect(getSavedFilters('existing')).toEqual([])
  })
})
```

Notes for the implementer: `makePayload` already exists in the moved file (defaults: empty `activities`/`items`/`logs`); `makeActivity()` defaults to id `act-1`, name "Juggling", so an existing activity also named "Juggling" is a name conflict. The "moved" tests that call `saveItem`/`appendLog` then `executeImport` keep working because storage reads are synchronous.

- [ ] **Step 2: Run tests to verify they fail** — `npm test` → FAIL: `../backup` not found.

- [ ] **Step 3: Implement `src/backup.ts`**

Move `ImportPayload`, `ActivityResolution`, `ItemResolution`, `ImportStats`, `ItemConflict`, `validateImportPayload`, `findActivityConflicts`, `findItemConflicts`, `executeImport` out of `ImportScreen.tsx` into this file, then change them as shown. Full file:

```ts
import {
  getSnapshot, importRecords, recordBackup, getActivities, getItems, getSavedFilters,
  deleteActivity, deleteItemWithLogs,
} from './storage'
import { CURRENT_SCHEMA_VERSION, migrateSnapshot } from './migrations'
import { localDateKey, daysBetweenKeys } from './dates'
import { generateId } from './utils'
import type { Activity, Item, PracticeLog, SavedFilter } from './types'

/*
 * Backup files: what Export writes and Import reads.
 * Files carry schemaVersion so old backups can be migrated on import
 * (see migrations.ts). Files from before versioning have no schemaVersion
 * and no savedFilters; treat them as version 1.
 */

export interface BackupFile {
  app: 'practice-app'
  schemaVersion: number
  exportedAt: string
  activities: Activity[]
  items: Item[]
  logs: PracticeLog[]
  savedFilters: SavedFilter[]
}

export interface ImportPayload {
  exportedAt: string
  activities: Activity[]
  items: Item[]
  logs: PracticeLog[]
  savedFilters?: SavedFilter[]
}

export type ActivityResolution = 'keep-existing' | 'replace' | 'keep-both' | 'combine'
export type ItemResolution = 'keep-existing' | 'keep-imported' | 'keep-both'

export interface ImportStats {
  activitiesAdded: number
  itemsAdded: number
  logsAdded: number
  skipped: number
}

export interface ItemConflict {
  importedItem: Item
  existingItem: Item
}

export const BACKUP_STALE_DAYS = 30

// --- Export ---

export function buildBackup(now: Date = new Date()): BackupFile {
  return {
    app: 'practice-app',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    ...getSnapshot(),
  }
}

export function backupFileName(now: Date = new Date()): string {
  return `practice-backup-${localDateKey(now)}.json`
}

function download(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Saves a backup file. Where the browser can share files (iPhone), opens the
 * share sheet so the user can "Save to Files"; otherwise downloads it.
 * Resolves false if the user cancelled the share sheet.
 */
export async function exportData(): Promise<boolean> {
  const now = new Date()
  const file = new File([JSON.stringify(buildBackup(now), null, 2)], backupFileName(now), { type: 'application/json' })

  let shared = false
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Practice App backup' })
      shared = true
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false
      // Any other failure: fall back to a plain download below.
    }
  }
  if (!shared) download(file)

  recordBackup(now.toISOString())
  return true
}

export function describeLastBackup(lastBackupAt: string | null, now: Date = new Date()): { text: string; stale: boolean } {
  if (!lastBackupAt) return { text: 'Never backed up', stale: true }
  const days = daysBetweenKeys(localDateKey(lastBackupAt), localDateKey(now))
  const text = days <= 0 ? 'Last backup: today'
    : days === 1 ? 'Last backup: yesterday'
    : `Last backup: ${days} days ago`
  return { text, stale: days >= BACKUP_STALE_DAYS }
}

// --- Import ---

/**
 * Returns the payload (migrated to the current schema) or null if it isn't a
 * backup file. Throws NewerSchemaError for backups from a newer app version.
 */
export function validateImportPayload(raw: unknown): ImportPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.activities) || !Array.isArray(r.items) || !Array.isArray(r.logs)) return null
  if (r.savedFilters !== undefined && !Array.isArray(r.savedFilters)) return null
  const fromVersion = typeof r.schemaVersion === 'number' ? r.schemaVersion : 1
  const migrated = migrateSnapshot({
    activities: r.activities as Activity[],
    items: r.items as Item[],
    logs: r.logs as PracticeLog[],
    savedFilters: (r.savedFilters ?? []) as SavedFilter[],
  }, fromVersion)
  return { exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : '', ...migrated }
}

// findActivityConflicts and findItemConflicts: move verbatim from ImportScreen.tsx.

export function executeImport(
  payload: ImportPayload,
  actResolutions: Map<string, ActivityResolution>,
  itemResolutions: Map<string, ItemResolution>,
): ImportStats {
  const stats: ImportStats = { activitiesAdded: 0, itemsAdded: 0, logsAdded: 0, skipped: 0 }
  const existingActByName = new Map(getActivities().map(a => [a.name, a]))
  const newActivities: Activity[] = []
  const newItems: Item[] = []
  const newLogs: PracticeLog[] = []
  const newFilters: SavedFilter[] = []
  const importedFilters = payload.savedFilters ?? []

  function addItemsAndLogs(impItems: Item[], targetActivityId: string) {
    const idMap = new Map<string, string>()
    for (const impItem of impItems) {
      const newId = generateId()
      idMap.set(impItem.id, newId)
      newItems.push({ ...impItem, id: newId, activityId: targetActivityId })
      stats.itemsAdded++
    }
    for (const log of payload.logs) {
      const newItemId = idMap.get(log.itemId)
      if (!newItemId) continue
      newLogs.push({ ...log, id: generateId(), itemId: newItemId })
      stats.logsAdded++
    }
  }

  function addFilters(impActivityId: string, targetActivityId: string, skipNames: Set<string>) {
    for (const f of importedFilters) {
      if (f.activityId !== impActivityId || skipNames.has(f.name)) continue
      newFilters.push({ ...f, id: generateId(), activityId: targetActivityId })
    }
  }

  for (const impAct of payload.activities) {
    const resolution = actResolutions.get(impAct.id)
    const existingAct = existingActByName.get(impAct.name)
    const impItems = payload.items.filter(i => i.activityId === impAct.id)

    if (resolution === 'keep-existing') {
      stats.skipped++
      continue
    }

    if (resolution === 'combine' && existingAct) {
      const existingByName = new Map(getItems(existingAct.id).map(i => [i.name, i]))
      const toAdd: Item[] = []
      for (const impItem of impItems) {
        const existingItem = existingByName.get(impItem.name)
        const itemRes = itemResolutions.get(impItem.id)
        if (existingItem && itemRes === 'keep-existing') {
          stats.skipped++
          continue
        }
        if (existingItem && itemRes === 'keep-imported') deleteItemWithLogs(existingItem.id)
        toAdd.push(impItem)
      }
      addItemsAndLogs(toAdd, existingAct.id)
      addFilters(impAct.id, existingAct.id, new Set(getSavedFilters(existingAct.id).map(f => f.name)))
      continue
    }

    if (resolution === 'replace' && existingAct) deleteActivity(existingAct.id)

    const newActId = generateId()
    const actName = resolution === 'keep-both' ? `${impAct.name} (imported)` : impAct.name
    newActivities.push({ ...impAct, id: newActId, name: actName })
    stats.activitiesAdded++
    addItemsAndLogs(impItems, newActId)
    addFilters(impAct.id, newActId, new Set())
  }

  importRecords({ activities: newActivities, items: newItems, logs: newLogs, savedFilters: newFilters })
  return stats
}
```

Replace `src/utils.ts` with just:

```ts
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
```

- [ ] **Step 4: Update `ImportScreen.tsx`** — delete the moved types/functions; import them instead:

```ts
import {
  validateImportPayload, findActivityConflicts, findItemConflicts, executeImport,
  type ImportPayload, type ActivityResolution, type ItemResolution, type ImportStats, type ItemConflict,
} from '../backup'
import { NewerSchemaError } from '../migrations'
```

Remove now-unused storage imports (`saveActivity, saveItem, appendLog, deleteActivity, deleteItemWithLogs`) and `generateId`. In `handleFile`'s `catch`, show the version message:

```ts
      } catch (e) {
        setError(e instanceof NewerSchemaError
          ? 'This backup was made by a newer version of the app. Reload the app to update it, then try again.'
          : "This doesn't look like a valid backup file.")
      }
```

- [ ] **Step 5: Update `HomeScreen.tsx`** — export button + last-backup line.

```ts
import { generateId } from '../utils'
import { exportData, describeLastBackup } from '../backup'
import { getActivities, saveActivity, deleteActivity, getLastPracticedByItem, getLastBackupAt } from '../storage'
```

Add state and handler inside the component:

```ts
  const [lastBackupAt, setLastBackupAt] = useState(() => getLastBackupAt())

  async function handleExport() {
    if (await exportData()) setLastBackupAt(getLastBackupAt())
  }

  const backup = describeLastBackup(lastBackupAt)
```

Change the Export button to `onClick={() => void handleExport()}` and directly under it (before the Import button) add:

```tsx
        {activities.length > 0 && (
          <p className={`text-xs text-center -mt-1 mb-1 ${backup.stale ? 'text-amber-400' : 'text-slate-600'}`}>
            {backup.text}
          </p>
        )}
```

- [ ] **Step 6: Run tests** — `npm test` → all pass. `npm run build` → succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/backup.ts src/utils.ts src/screens/ImportScreen.tsx src/screens/HomeScreen.tsx src/tests/backup.test.ts
git status --short   # expect: the rename importScreen.test.ts → backup.test.ts and deletion of utils.test.ts are staged
git commit -m "feat: versioned backups with saved filters, share-sheet export and last-backup reminder"
git push
```

---

### Task 5: Crash and save-failure safety nets (error boundary, storage error banner)

**Files:**
- Create: `src/components/ErrorBoundary.tsx`, `src/components/StorageErrorBanner.tsx`, `src/tests/safetyNets.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `exportData` (backup, Task 4), `onStorageError` (storage, Task 2).
- Produces: default-export components `ErrorBoundary` (`{ children: ReactNode }`) and `StorageErrorBanner` (no props).

- [ ] **Step 1: Write failing tests** — create `src/tests/safetyNets.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

vi.mock('../db', async importOriginal => {
  const actual = await importOriginal<typeof import('../db')>()
  return { ...actual, applyOps: vi.fn(actual.applyOps) }
})

import { applyOps } from '../db'
import { saveActivity, flushWrites } from '../storage'
import ErrorBoundary from '../components/ErrorBoundary'
import StorageErrorBanner from '../components/StorageErrorBanner'

function Boom(): never {
  throw new Error('kaboom')
}

describe('ErrorBoundary', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('shows a recovery screen with export and reload instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('kaboom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export data' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('renders children when nothing throws', () => {
    render(<ErrorBoundary><p>all good</p></ErrorBoundary>)
    expect(screen.getByText('all good')).toBeInTheDocument()
  })
})

describe('StorageErrorBanner', () => {
  it('is hidden until a save fails, then offers export', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<StorageErrorBanner />)
    expect(screen.queryByRole('alert')).toBeNull()

    vi.mocked(applyOps).mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'))
    await act(async () => {
      saveActivity({ id: 'a', name: 'A', itemLabel: 'x', weights: { red: 1, yellow: 0, green: 0 }, createdAt: '2026-01-01T00:00:00.000Z' })
      await flushWrites()
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/storage is full/i)
    expect(screen.getByRole('button', { name: 'Export data' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/tests/safetyNets.test.tsx` → FAIL (components missing).

- [ ] **Step 3: Implement `src/components/ErrorBoundary.tsx`**

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { exportData } from '../backup'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Catches render crashes so the user can still export their data. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="h-full p-6 flex flex-col justify-center gap-4 bg-slate-950 text-slate-100">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="text-slate-400 text-sm">
          Your data is still saved on this device. Export a backup to be safe, then reload.
        </p>
        <p className="text-xs text-slate-500 font-mono break-words">{error.message}</p>
        <button
          onClick={() => void exportData()}
          className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold"
        >
          Export data
        </button>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold"
        >
          Reload
        </button>
        <button
          onClick={() => {
            window.location.hash = '#/'
            this.setState({ error: null })
          }}
          className="w-full text-slate-400 text-sm py-2"
        >
          Go to home screen
        </button>
      </div>
    )
  }
}
```

- [ ] **Step 4: Implement `src/components/StorageErrorBanner.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { onStorageError } from '../storage'
import { exportData } from '../backup'

function isQuotaError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'QuotaExceededError'
}

/** Shown when a background save fails, so changes are never lost silently. */
export default function StorageErrorBanner() {
  const [failure, setFailure] = useState<{ quota: boolean } | null>(null)

  useEffect(() => onStorageError(error => setFailure({ quota: isQuotaError(error) })), [])

  if (!failure) return null

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-50 max-w-md mx-auto bg-red-950 border-b border-red-800 px-4 pb-3 flex flex-col gap-2"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <p className="text-sm text-red-100">
        {failure.quota
          ? "Couldn't save your latest changes: this device's storage is full."
          : "Couldn't save your latest changes."}{' '}
        They'll be lost when the app closes. Export a backup now to keep them.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => void exportData()}
          className="flex-1 bg-red-700 hover:bg-red-600 rounded-lg py-2 text-sm font-semibold"
        >
          Export data
        </button>
        <button
          onClick={() => setFailure(null)}
          className="flex-1 bg-slate-800 hover:bg-slate-700 rounded-lg py-2 text-sm"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Wire into `src/App.tsx`** — import both; inside the outer `<div ...>` wrap `<Routes>` in `<ErrorBoundary>` and render `<StorageErrorBanner />` before it:

```tsx
      <div className="h-screen overflow-hidden bg-slate-950 text-slate-100 max-w-md mx-auto" style={{ paddingTop: 'env(safe-area-inset-top)', height: '100dvh' }}>
        <StorageErrorBanner />
        <ErrorBoundary>
          <Routes>
            {/* ...unchanged routes... */}
          </Routes>
        </ErrorBoundary>
      </div>
```

- [ ] **Step 6: Run tests** — `npm test` → all pass; `npm run build` → succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/components/StorageErrorBanner.tsx src/tests/safetyNets.test.tsx src/App.tsx
git commit -m "feat: add crash recovery screen and storage failure banner"
git push
```

---

### Task 6: Keep Stats fast with years of history; lazy-load Stats

**Files:**
- Modify: `src/storage.ts` (`getColorDistributionByDay`), `src/screens/StatsScreen.tsx` (memoise queries), `src/screens/PracticeSessionScreen.tsx` (hoist today set), `src/App.tsx` (lazy Stats)
- Test: `src/tests/storage.test.ts`

**Interfaces:**
- Consumes: `localDateKey` (Task 3), storage `state` internals (Task 2).
- Produces: `getColorDistributionByDay(activityId)` — same signature and output as today.

- [ ] **Step 1: Write characterisation + performance tests** — append to `src/tests/storage.test.ts` (add `getColorDistributionByDay` to its import if not already there):

```ts
describe('getColorDistributionByDay', () => {
  it('returns [] with no logs', () => {
    saveItem(makeItem({ id: 'i1' }))
    expect(getColorDistributionByDay('act-1')).toEqual([])
  })

  it('counts each item by its latest rating as of each practice day', () => {
    saveItem(makeItem({ id: 'i1', color: 'green', createdAt: '2026-05-01T12:00:00.000Z' }))
    saveItem(makeItem({ id: 'i2', color: 'yellow', createdAt: '2026-05-01T12:00:00.000Z' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-10T18:00:00.000Z', colorAfter: 'red' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i1', practicedAt: '2026-05-12T18:00:00.000Z', colorAfter: 'yellow' }))
    appendLog(makeLog({ id: 'l3', itemId: 'i1', practicedAt: '2026-05-12T19:00:00.000Z', colorAfter: 'green' }))
    // i2 never practiced: falls back to its current color
    expect(getColorDistributionByDay('act-1')).toEqual([
      { date: '2026-05-10', red: 1, yellow: 1, green: 0 },
      { date: '2026-05-12', red: 0, yellow: 1, green: 1 },
    ])
  })

  it('excludes items created after a given day', () => {
    saveItem(makeItem({ id: 'i1', color: 'red', createdAt: '2026-05-01T12:00:00.000Z' }))
    saveItem(makeItem({ id: 'i2', color: 'green', createdAt: '2026-05-11T12:00:00.000Z' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-10T18:00:00.000Z', colorAfter: 'red' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i1', practicedAt: '2026-05-12T18:00:00.000Z', colorAfter: 'red' }))
    expect(getColorDistributionByDay('act-1')).toEqual([
      { date: '2026-05-10', red: 1, yellow: 0, green: 0 },
      { date: '2026-05-12', red: 1, yellow: 0, green: 1 },
    ])
  })

  it('handles logs stored out of order', () => {
    saveItem(makeItem({ id: 'i1', color: 'red', createdAt: '2026-05-01T12:00:00.000Z' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i1', practicedAt: '2026-05-12T18:00:00.000Z', colorAfter: 'green' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-10T18:00:00.000Z', colorAfter: 'yellow' }))
    expect(getColorDistributionByDay('act-1')).toEqual([
      { date: '2026-05-10', red: 0, yellow: 1, green: 0 },
      { date: '2026-05-12', red: 0, yellow: 0, green: 1 },
    ])
  })

  it('stays fast with two years of daily practice', () => {
    const items = Array.from({ length: 150 }, (_, i) =>
      makeItem({ id: `i${i}`, name: `Item ${i}`, createdAt: '2024-01-01T12:00:00.000Z' }))
    const logs: PracticeLog[] = []
    const start = Date.parse('2024-01-02T18:00:00.000Z')
    for (let d = 0; d < 730; d++) {
      for (let k = 0; k < 20; k++) {
        logs.push(makeLog({
          id: `l${d}-${k}`,
          itemId: `i${(d * 20 + k) % 150}`,
          practicedAt: new Date(start + d * 86_400_000 + k * 60_000).toISOString(),
          colorAfter: k % 2 ? 'green' : 'yellow',
        }))
      }
    }
    importRecords({ items, logs })
    const t0 = performance.now()
    const result = getColorDistributionByDay('act-1')
    const elapsed = performance.now() - t0
    expect(result).toHaveLength(730)
    expect(elapsed).toBeLessThan(1000) // was ~10s before
  })
})
```

(Add `importRecords` to the storage import in this file.)

- [ ] **Step 2: Run** — `npx vitest run src/tests/storage.test.ts` → the correctness tests should PASS with the old implementation (they characterise current behaviour); the performance test FAILS (takes many seconds / times out). If a correctness test fails against the old code, fix the test expectation, not the code — they document existing behaviour.

- [ ] **Step 3: Replace `getColorDistributionByDay`** in `src/storage.ts`:

```ts
export function getColorDistributionByDay(
  activityId: string
): Array<{ date: string; red: number; yellow: number; green: number }> {
  const items = getItems(activityId)
  const itemIds = new Set(items.map(i => i.id))
  const logs = state.logs
    .filter(l => itemIds.has(l.itemId))
    .map(l => ({ log: l, date: localDateKey(l.practicedAt) }))
    .sort((a, b) => a.log.practicedAt.localeCompare(b.log.practicedAt))
  if (logs.length === 0) return []

  const dates = [...new Set(logs.map(l => l.date))]
  const createdOn = new Map(items.map(i => [i.id, localDateKey(i.createdAt)]))
  const colorSoFar = new Map<string, Color>()
  let next = 0

  // Walk the logs once in time order, snapshotting every item's latest color at the end of each practice day.
  return dates.map(date => {
    while (next < logs.length && logs[next].date <= date) {
      colorSoFar.set(logs[next].log.itemId, logs[next].log.colorAfter)
      next++
    }
    const counts = { red: 0, yellow: 0, green: 0 }
    for (const item of items) {
      if (createdOn.get(item.id)! > date) continue
      counts[colorSoFar.get(item.id) ?? item.color]++
    }
    return { date, ...counts }
  })
}
```

- [ ] **Step 4: Memoise Stats queries** — in `src/screens/StatsScreen.tsx`, import `useMemo` and replace the block from `const activity = ...` through `const totalReps = ...` so that all hooks run before the early return and the expensive queries run once per activity rather than on every keystroke:

```tsx
  const activity = useMemo(() => getActivities().find(a => a.id === activityId), [activityId])

  useEffect(() => {
    if (!activity) navigate('/')
  }, [activity, navigate])

  // Stats never change while this screen is open, so compute once per activity.
  const data = useMemo(() => {
    const allItems = getItems(activityId)
    const practiceCounts = getPracticeCountByItem(activityId)
    return {
      allItems,
      sessions: getSessionHistory(activityId),
      chartData: getColorDistributionByDay(activityId),
      lastPracticedAt: getLastPracticedByItem(activityId),
      practiceCounts,
      allTags: [...new Set(allItems.flatMap(i => i.tags ?? []))].sort(),
      totalReps: Object.values(practiceCounts).reduce((sum, n) => sum + n, 0),
    }
  }, [activityId])

  if (!activity) return null

  const { allItems, sessions, chartData, lastPracticedAt, practiceCounts, allTags, totalReps } = data
```

- [ ] **Step 5: Hoist the "done today" lookup** — in `src/screens/PracticeSessionScreen.tsx`, replace:

```tsx
  const todayDoneCount = activityId
    ? filteredPool.filter(i => getTodayPracticedItemIds(activityId).has(i.id)).length
    : 0
```
with:
```tsx
  const practicedToday = activityId ? getTodayPracticedItemIds(activityId) : new Set<string>()
  const todayDoneCount = filteredPool.filter(i => practicedToday.has(i.id)).length
```

- [ ] **Step 6: Lazy-load Stats** — in `src/App.tsx`:

```tsx
import { lazy, Suspense } from 'react'
// remove: import StatsScreen from './screens/StatsScreen'

// Stats pulls in the charting library (most of the bundle); load it on demand.
const StatsScreen = lazy(() => import('./screens/StatsScreen'))
```
and wrap `<Routes>...</Routes>` in `<Suspense fallback={null}>` (inside the ErrorBoundary).

- [ ] **Step 7: Verify** — `npm test` → all pass (perf test well under 1s). `npm run build` → the "chunks larger than 500 kB" warning should be gone or the main chunk noticeably smaller; confirm a separate `StatsScreen-*.js` chunk exists in `dist/assets/` and that the PWA precache list includes it (`grep -o 'StatsScreen[^"]*' dist/sw.js`).

- [ ] **Step 8: Commit**

```bash
git add src/storage.ts src/tests/storage.test.ts src/screens/StatsScreen.tsx src/screens/PracticeSessionScreen.tsx src/App.tsx
git commit -m "perf: compute stats chart in one pass and lazy-load the Stats screen"
git push
```

---

### Task 7: Lint to zero, plus small correctness fixes

**Files:**
- Create: `src/tabs.ts`, `src/itemRuns.ts`
- Modify: `src/components/TabBar.tsx`, `src/screens/ItemProgressScreen.tsx`, `src/tests/tabBar.test.ts`, `src/tests/itemProgress.test.ts`, `src/screens/HomeScreen.tsx`, `src/components/AdvancedFilterModal.tsx`, `src/screens/ManageItemsScreen.tsx`, `src/screens/ManualPracticeScreen.tsx`, `src/screens/PracticeChooserScreen.tsx`, `src/screens/ActivityDashboardScreen.tsx`, `src/screens/AddEditItemScreen.tsx`, `src/screens/PracticeSessionScreen.tsx`, `src/App.tsx`, `index.html`, `src/storage.ts` + `src/tests/storage.test.ts` (remove `deleteItem`)

**Interfaces:**
- Produces: `getActiveTab(pathname: string, activityId: string): Tab` and `type Tab` from `src/tabs.ts`; `buildRuns(logs: PracticeLog[]): Run[]` and `interface Run` from `src/itemRuns.ts`.

Current lint errors (`npm run lint`): `react-hooks/set-state-in-effect` in AdvancedFilterModal:23, ActivityDashboardScreen:23, AddEditItemScreen:35, HomeScreen:30, ManageItemsScreen:22, ManualPracticeScreen:26, PracticeChooserScreen:17, PracticeSessionScreen:195 and :242; `react-refresh/only-export-components` in TabBar:10 and ItemProgressScreen:14 (ImportScreen's were fixed in Task 4). Line numbers may have shifted.

Background: storage reads are now synchronous from memory and cheap, so "load in an effect then setState" is unnecessary — initialise state directly. Effects remain only to *redirect* (calling `navigate`, which is allowed).

- [ ] **Step 1: Move non-component exports**
  - Create `src/tabs.ts` containing `export type Tab = ...` and `export function getActiveTab(...)` moved verbatim from `TabBar.tsx`; `TabBar.tsx` imports them. Update `src/tests/tabBar.test.ts` to import from `'../tabs'`.
  - Create `src/itemRuns.ts` with `import type { Color, PracticeLog } from './types'`, `import { localDateKey } from './dates'`, `export interface Run {...}` and `export function buildRuns(...)` moved verbatim from `ItemProgressScreen.tsx`; the screen imports it. Update `src/tests/itemProgress.test.ts` to import from `'../itemRuns'`.

- [ ] **Step 2: Initialise from storage instead of effects** — apply this pattern:

`HomeScreen.tsx`: `const [activities, setActivities] = useState<Activity[]>(() => getActivities())` and delete the `useEffect`. Remove `useEffect` from the import if unused.

`AdvancedFilterModal.tsx`: `const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => getSavedFilters(activityId))`, delete its effect.

`ManageItemsScreen.tsx`, `ManualPracticeScreen.tsx`, `PracticeChooserScreen.tsx`:
```tsx
  const [activity] = useState<Activity | null>(() => getActivities().find(a => a.id === activityId) ?? null)
  const [items, setItems] = useState<Item[]>(() => (activityId ? getItems(activityId) : []))

  useEffect(() => {
    if (!activity) navigate('/')
  }, [activity, navigate])
```
(Drop `setItems` from the destructure where it's unused — ManageItems and PracticeChooser.)

`ActivityDashboardScreen.tsx`: initialise `activity` the same way (keep `setActivity`, used on save), `items` likewise, and initialise every draft from the activity:
```tsx
  const [draftName, setDraftName] = useState(() => activity?.name ?? '')
  const [draftLabel, setDraftLabel] = useState(() => activity?.itemLabel ?? '')
  const [draftWeights, setDraftWeights] = useState(() => ({
    red: Math.round((activity?.weights.red ?? 0.6) * 100),
    yellow: Math.round((activity?.weights.yellow ?? 0.3) * 100),
    green: Math.round((activity?.weights.green ?? 0.1) * 100),
  }))
  const [draftRecencyBias, setDraftRecencyBias] = useState(() => activity?.recencyBias ?? 0.9)
```
plus the redirect-only effect.

`AddEditItemScreen.tsx`: compute `activity`, `existingItem` and `allActivityTags` with lazy initialisers; initialise `name`, `color`, `tags` from `existingItem`; redirect effect:
```tsx
  useEffect(() => {
    if (!activity) navigate('/')
    else if (itemId && !existingItem) navigate(`/activity/${activityId}/manage`)
  }, [activity, existingItem, itemId, activityId, navigate])
```
(The tag-input focus effect at the top of the file doesn't call setState — leave it.) In `App.tsx`, give the two `AddEditItemScreen` routes distinct keys so switching between add and edit always remounts: `element={<AddEditItemScreen key="add" />}` and `element={<AddEditItemScreen key="edit" />}`.

- [ ] **Step 3: Restructure the auto-practice draw** (`PracticeSessionScreen.tsx`, both errors). Replace the load effect, `drawNextItem` `useCallback`, and the auto-draw effect with a pure draw helper plus lazy initial state:

Add above the component:
```tsx
type DrawResult =
  | { kind: 'item'; item: Item }
  | { kind: 'filter-exhausted' }
  | { kind: 'all-done' }

function drawFrom(
  activity: Activity,
  items: Item[],
  activeTags: Set<string>,
  advancedFilter: string | null,
  skipped: Set<string>,
): DrawResult {
  const excluded = new Set([...getTodayPracticedItemIds(activity.id), ...skipped])
  const lastPracticedAt = getLastPracticedByItem(activity.id)
  const recencyBias = activity.recencyBias ?? 0.9
  const pool = buildFilteredPool(items, activeTags, advancedFilter)
  const next = selectItem(pool, excluded, activity.weights, recencyBias, lastPracticedAt)
  if (next) return { kind: 'item', item: next }
  const filtering = activeTags.size > 0 || advancedFilter !== null
  if (filtering && selectItem(items, excluded, activity.weights, recencyBias, lastPracticedAt)) {
    return { kind: 'filter-exhausted' }
  }
  return { kind: 'all-done' }
}

function tagsOf(items: Item[]): string[] {
  return [...new Set(items.flatMap(i => i.tags ?? []))].sort()
}
```

In the component, replace the `activity`/`items`/`phase`/`currentItem`/`allTags`/`filterExhausted` state declarations with:
```tsx
  const [activity] = useState<Activity | null>(() => getActivities().find(a => a.id === activityId) ?? null)
  const [items, setItems] = useState<Item[]>(() => (activity ? getItems(activity.id) : []))
  const allTags = useMemo(() => tagsOf(items), [items])
  // With no tags there is nothing to choose in setup, so draw the first item straight away.
  const [firstDraw] = useState<DrawResult | null>(() =>
    activity && items.length > 0 && tagsOf(items).length === 0
      ? drawFrom(activity, items, new Set(), null, new Set())
      : null)
  const [phase, setPhase] = useState<Phase>(() =>
    firstDraw === null ? 'setup' : firstDraw.kind === 'item' ? 'draw' : 'done')
  const [currentItem, setCurrentItem] = useState<Item | null>(() =>
    firstDraw?.kind === 'item' ? firstDraw.item : null)
  const [filterExhausted, setFilterExhausted] = useState(false)
```
Keep the other state (`revealed`, `selectedColor`, `activeTags`, `sessionLog`, `skippedItemIds`, `noteText`, `advancedFilter`, `showFilterModal`) as is.

Redirect effect:
```tsx
  useEffect(() => {
    if (!activity) navigate('/')
    else if (items.length === 0) navigate(`/activity/${activity.id}`)
  }, [activity, items.length, navigate])
```

New `drawNextItem` (plain function, not `useCallback`):
```tsx
  function drawNextItem(skipped: Set<string> = skippedItemIds) {
    if (!activity) return
    const freshItems = getItems(activity.id)
    setItems(freshItems)
    const result = drawFrom(activity, freshItems, activeTags, advancedFilter, skipped)
    if (result.kind === 'item') {
      setCurrentItem(result.item)
      setPhase('draw')
      setRevealed(false)
      setSelectedColor(null)
    } else {
      setFilterExhausted(result.kind === 'filter-exhausted')
      setPhase('done')
      setCurrentItem(null)
    }
  }
```
Delete the old auto-draw `useEffect`. Update imports (`useMemo` in, `useCallback` out). All existing callers (`onStart`, `handleSkip`, `handleSave`) keep calling `drawNextItem(...)` unchanged. Behaviour must be identical to before: with tags → setup screen first; without tags → first item shown immediately; exhausted filter → "All done with your current filter"; everything practiced → "Session complete".

- [ ] **Step 4: Small fixes**
  - `ActivityDashboardScreen.tsx` weight inputs: `onChange={e => setDraftWeights(w => ({ ...w, [color]: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) }))}`.
  - `AddEditItemScreen.tsx` delete: call `deleteItemWithLogs(existingItem.id)` (import it instead of `deleteItem`) and change the confirm text to ``Delete "${existingItem.name}" and its practice history? This cannot be undone.``
  - Remove the now-unused `deleteItem` from `src/storage.ts` and its test (`'deletes an item by id'`) from `src/tests/storage.test.ts`; remove `getAllItems` from storage if `grep -rn getAllItems src` shows no users.
  - `index.html`: `<title>Practice App</title>`.

- [ ] **Step 5: Verify** — `npm run lint` → **0 problems**. `npm test` → all pass. `npm run build` → succeeds.

Then smoke-test the practice flow in a browser, since it has no component tests: `npm run dev`, open `http://localhost:5173/practice-app/`, create an activity, add 3 items (one with a tag), run Auto Practice (setup screen appears because a tag exists; start; rate; skip; finish), then delete the tag from that item and confirm Auto Practice starts straight on an item. If no browser is available to you, state that clearly in your report instead of claiming it works.

- [ ] **Step 6: Commit**

```bash
git add src/tabs.ts src/itemRuns.ts src/components/TabBar.tsx src/components/AdvancedFilterModal.tsx src/screens src/tests/tabBar.test.ts src/tests/itemProgress.test.ts src/tests/storage.test.ts src/storage.ts src/App.tsx index.html
git commit -m "refactor: initialise screens from storage directly; lint passes cleanly"
git push
```

---

### Task 8: CI that tests before deploying; pin Node; remove stale gh-pages path

**Files:**
- Modify: `.github/workflows/deploy.yml`, `package.json`, `package-lock.json`
- Create: `.nvmrc`

- [ ] **Step 1: Pin Node** — create `.nvmrc` containing `24` (single line). In `package.json` add after `"type": "module",`:

```json
  "engines": {
    "node": ">=24"
  },
```

- [ ] **Step 2: Remove the stale deploy path** — `npm uninstall gh-pages`; delete the `"deploy": "gh-pages -d dist"` script. Add a script for the icon generator so it's discoverable: `"icons": "node scripts/generate-icons.mjs"`.

- [ ] **Step 3: Replace `.github/workflows/deploy.yml`**

```yaml
name: Build, test and deploy

# Every push runs lint, tests and a build. Only pushes to main deploy to GitHub Pages.
on:
  push:
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
      - if: github.ref == 'refs/heads/main'
        uses: actions/upload-pages-artifact@v5
        with:
          path: ./dist

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v5
        id: deployment
```

Before committing, check each action's README on GitHub for breaking input changes in these majors (e.g. `curl -s https://raw.githubusercontent.com/actions/setup-node/v7/README.md | head -80`) and confirm `node-version-file` and `cache: npm` are still valid inputs for setup-node v7, and `path` for upload-pages-artifact v5. Adjust if needed.

- [ ] **Step 4: Verify locally** — `npm ci && npm run lint && npm test && npm run build` → all succeed.

- [ ] **Step 5: Commit and verify on GitHub**

```bash
git add .nvmrc package.json package-lock.json .github/workflows/deploy.yml
git commit -m "ci: run lint and tests before deploy, Node 24, current action versions"
git push
```

Then confirm the branch run passes (the repo is public; no `gh` CLI is installed):

```bash
curl -s "https://api.github.com/repos/clmatt/practice-app/actions/runs?branch=longevity&per_page=1" | grep -E '"(status|conclusion|html_url)"' | head -3
```

Re-run until `status` is `completed`; `conclusion` must be `success` (the deploy job should show as skipped for this branch). If it fails, fetch the jobs (`.../actions/runs/<id>/jobs`) to see which step failed and fix it.

---

### Task 9: README and CLAUDE.md for easy pick-up

**Files:**
- Modify: `README.md`
- Create: `CLAUDE.md`

Write both files with the content below, adjusting any detail that turned out differently during Tasks 1–8 (verify every command and path you mention actually exists).

- [ ] **Step 1: Replace `README.md`**

````markdown
# Practice App

A personal practice tracker that runs as an app on your phone's home screen.

**Live app:** https://clmatt.github.io/practice-app/

You create **activities** (e.g. "Juggling"), add **items** to each (e.g. individual tricks), and after practising an item you rate it red, yellow or green. Auto Practice draws items weighted towards the ones you struggle with and the ones you haven't touched in a while. Stats show how your ratings shift over time.

## Using it

**Install on iPhone:** open the live app in Safari → Share → *Add to Home Screen*. It works offline after the first load and updates itself when a new version is deployed (close and reopen it to pick up an update).

**Your data lives only on your phone** (in the browser's IndexedDB storage for the app's web address). There's no account or server. That means:

- **Back up regularly.** Home screen → *Export data*. On iPhone this opens the share sheet — choose *Save to Files* (iCloud Drive is a good spot). The Home screen shows when you last backed up and turns amber after 30 days.
- **Restore / move to a new phone:** install the app, then Home → *Import data* and pick a backup file. If an activity already exists you'll be asked whether to keep, replace, keep both, or combine.
- The data is tied to the address `clmatt.github.io/practice-app`. Renaming the GitHub account or repository changes the address, and the app at the new address starts empty — export first, then import at the new address.
- Clearing Safari's website data for the site deletes the data. The app asks the browser to keep its storage persistent, but a backup is the only real guarantee.

## Developing

Requires **Node 24** (see `.nvmrc`; with nvm: `nvm use`).

```bash
npm ci            # install exact dependency versions from package-lock.json
npm run dev       # dev server → http://localhost:5173/practice-app/
npm test          # run the test suite once (Vitest)
npm run lint      # ESLint
npm run build     # type-check and production build into dist/
npm run preview   # serve the production build locally
npm run icons     # regenerate public/icon-*.png from scripts/generate-icons.mjs
```

The dev server uses a separate storage area from the live app (different address), so testing locally never touches your real data.

### Deploying

Push to `main`. GitHub Actions (`.github/workflows/deploy.yml`) runs lint, tests and the build, and deploys to GitHub Pages only if all pass. Pushes to other branches run the same checks without deploying. Check progress at https://github.com/clmatt/practice-app/actions.

### Coming back after a long break

1. `nvm use` (or install Node 24), then `npm ci`.
2. `npm test && npm run lint && npm run build` — everything should pass before you change anything.
3. If `npm ci` or the build fails because the toolchain has aged, that's the moment to update dependencies (`npm outdated`, then update and re-run the checks). The deployed app is static files and keeps working regardless.
4. If the GitHub Actions deploy starts failing with deprecation errors, bump the action versions in `deploy.yml` to their current majors.

## How it works

**Stack:** React 19, TypeScript, React Router 7 (hash routing, so it works on GitHub Pages), Tailwind CSS 3, Recharts, Vite, vite-plugin-pwa.

```
src/
  main.tsx            starts storage, then renders the app
  App.tsx             routes, crash screen, storage-error banner
  types.ts            data model: Activity, Item, PracticeLog, SavedFilter
  storage.ts          all reads/writes + stats queries (in-memory, saved to IndexedDB)
  db.ts               thin IndexedDB wrapper (only storage.ts uses it)
  migrations.ts       data schema version + upgrade steps
  backup.ts           export/import file format and import conflict handling
  dates.ts            local-calendar-date helpers
  selection.ts        weighted random choice for Auto Practice
  filterParser.ts     advanced tag filter expressions ("a" && !("b" || "c"))
  screens/            one component per route
  components/         shared UI
  tests/              Vitest tests
docs/superpowers/     design specs and implementation plans from past work
```

**Storage:** on startup everything is loaded from IndexedDB into memory; reads are instant, and writes are saved in the background. If a save fails (e.g. the phone is out of space) a red banner offers an export. Versions before September 2026 kept data in `localStorage`; the first launch of a newer version copies it into IndexedDB automatically and leaves the old copy in place as a safety net.

**Changing the data model:** if you change `types.ts` in a way that old saved data or old backup files wouldn't match, bump `CURRENT_SCHEMA_VERSION` in `src/migrations.ts` and add a migration step with a test. Adding a new *optional* field doesn't need a migration.

**Dates:** timestamps are stored in UTC; anything grouped "by day" uses the phone's local date via `src/dates.ts`.
````

- [ ] **Step 2: Create `CLAUDE.md`**

```markdown
# Practice App — notes for Claude

Personal PWA (React 19 + TypeScript + Vite + Tailwind 3) for tracking practice of items rated red/yellow/green. Single user, iPhone home-screen app, no backend. See README.md for the product and layout.

## Commands
- `npm test` (Vitest, jsdom, fake-indexeddb, timezone pinned to America/Los_Angeles)
- `npm run lint` — must report 0 problems
- `npm run build` — type-check + production build
- `npm run dev` → http://localhost:5173/practice-app/
- Node 24 (`.nvmrc`)

## Deploying
Pushing `main` deploys to the user's phone via GitHub Actions (lint + test + build gate it). Do feature work on a branch; merge to `main` only when checks pass. The owner's standing preference: push after committing without asking.

## Rules that protect the user's data
- All data access goes through `src/storage.ts`. Reads are synchronous from an in-memory cache; writes update memory and queue an IndexedDB save. Never mutate `state` arrays in place; getters return copies.
- `main.tsx` awaits `initStorage()` before rendering. Tests get a fresh database per test via `src/tests/setup.ts`.
- Changing the stored data shape (anything in `src/types.ts` that old data or old backup files won't satisfy) requires bumping `CURRENT_SCHEMA_VERSION` and adding a step to `MIGRATIONS` in `src/migrations.ts`, with a test. New optional fields don't.
- Never delete or write the legacy localStorage keys (`practice:*`). They're a fallback copy of pre-IndexedDB data.
- Export files (`src/backup.ts`) must stay importable forever: keep accepting old files (no `schemaVersion` → version 1).
- Group by day with `localDateKey()` from `src/dates.ts`, never `iso.slice(0, 10)` (that's the UTC date).

## Conventions
- 2-space indent, no semicolons, single quotes; Tailwind utility classes; slate background, violet accents.
- `tsconfig` has `erasableSyntaxOnly`: no enums, namespaces or constructor parameter properties.
- Only components are exported from `.tsx` files (react-refresh lint rule); put helpers in `.ts` modules.
- Screens read storage directly in `useState` initialisers; effects are only for redirects (`react-hooks/set-state-in-effect` is enforced).
- Design specs and plans live in `docs/superpowers/`.
```

- [ ] **Step 3: Verify** — every command in both files runs (`npm run icons` may be skipped — it overwrites icons; just confirm the script entry exists). Every file path mentioned exists (`ls` them).

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: rewrite README and add CLAUDE.md for picking the project back up"
git push
```

---

## After all tasks (controller)

1. Whole-branch review.
2. Production-build smoke test of the legacy migration in a real browser if one is available: `npm run build && npm run preview`, seed `practice:*` localStorage keys, load the app, confirm data appears and survives a reload.
3. Merge `longevity` into `main`, push (this deploys), and confirm the Actions run on `main` succeeds and the live site loads.
