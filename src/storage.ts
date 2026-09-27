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

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
}

export function getTodayPracticedItemIds(activityId: string): Set<string> {
  const activityItemIds = new Set(getItems(activityId).map(i => i.id))
  return new Set(
    state.logs
      .filter(l => activityItemIds.has(l.itemId) && isToday(l.practicedAt))
      .map(l => l.itemId)
  )
}

// --- Stats queries ---

export function getColorDistributionByDay(
  activityId: string
): Array<{ date: string; red: number; yellow: number; green: number }> {
  const items = getItems(activityId)
  const logs = state.logs.filter(l => items.some(i => i.id === l.itemId))
  const dates = [...new Set(logs.map(l => l.practicedAt.slice(0, 10)))].sort()
  if (dates.length === 0) return []

  return dates.map(date => {
    const counts = { red: 0, yellow: 0, green: 0 }
    for (const item of items) {
      if (item.createdAt.slice(0, 10) > date) continue
      const itemLogs = logs
        .filter(l => l.itemId === item.id && l.practicedAt.slice(0, 10) <= date)
        .sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
      const color: Color = itemLogs.length > 0
        ? itemLogs[itemLogs.length - 1].colorAfter
        : item.color
      counts[color]++
    }
    return { date, ...counts }
  })
}

export function getPracticeCountByItem(activityId: string): Record<string, number> {
  const itemIds = new Set(getItems(activityId).map(i => i.id))
  const counts: Record<string, number> = {}
  for (const log of state.logs) {
    if (itemIds.has(log.itemId)) {
      counts[log.itemId] = (counts[log.itemId] ?? 0) + 1
    }
  }
  return counts
}

export function getLastPracticedByItem(activityId: string): Record<string, string> {
  const itemIds = new Set(getItems(activityId).map(i => i.id))
  const last: Record<string, string> = {}
  for (const log of state.logs) {
    if (itemIds.has(log.itemId)) {
      if (!last[log.itemId] || log.practicedAt > last[log.itemId]) {
        last[log.itemId] = log.practicedAt
      }
    }
  }
  return last
}

export function getNotesForItem(itemId: string): { practicedAt: string; note: string }[] {
  return state.logs
    .filter(l => l.itemId === itemId && !!l.note)
    .map(l => ({ practicedAt: l.practicedAt, note: l.note! }))
    .sort((a, b) => b.practicedAt.localeCompare(a.practicedAt))
}

export function getSessionHistory(activityId: string): SessionSummary[] {
  const items = getItems(activityId)
  const itemMap = new Map(items.map(i => [i.id, i.name]))
  const itemIds = new Set(items.map(i => i.id))

  const logs = state.logs.filter(l => itemIds.has(l.itemId))

  const byDate = new Map<string, PracticeLog[]>()
  for (const log of logs) {
    const date = log.practicedAt.slice(0, 10)
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(log)
  }

  const sessions: SessionSummary[] = []
  for (const [date, dateLogs] of byDate) {
    const practicedItemIds = new Set(dateLogs.map(l => l.itemId))

    const sortedDayLogs = [...dateLogs].sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
    const firstLogByItem = new Map<string, PracticeLog>()
    const lastLogByItem = new Map<string, PracticeLog>()
    for (const log of sortedDayLogs) {
      if (!firstLogByItem.has(log.itemId)) firstLogByItem.set(log.itemId, log)
      lastLogByItem.set(log.itemId, log)
    }

    const allPracticed = [...lastLogByItem.keys()]
      .filter(itemId => itemMap.has(itemId))
      .map(itemId => ({
        itemName: itemMap.get(itemId)!,
        colorBefore: firstLogByItem.get(itemId)!.colorBefore,
        colorAfter: lastLogByItem.get(itemId)!.colorAfter,
      }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName))

    const changes = allPracticed.filter(p => p.colorBefore !== p.colorAfter)

    sessions.push({ date, itemCount: practicedItemIds.size, changes, allPracticed })
  }

  return sessions.sort((a, b) => b.date.localeCompare(a.date))
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
