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
    // Once one of these fires the transaction is done; ignore any further
    // event (e.g. the onabort that follows our own tx.abort() below).
    let settled = false
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }
    tx.oncomplete = () => settle(resolve)
    tx.onerror = () => settle(() => reject(tx.error))
    tx.onabort = () => settle(() => reject(tx.error ?? new Error('Database write was aborted')))
    try {
      for (const op of ops) {
        const store = tx.objectStore(op.store)
        if (op.store === 'meta') store.put(op.value, op.key)
        else if (op.type === 'put') store.put(op.value)
        else if (op.type === 'delete') store.delete(op.id)
        else store.clear()
      }
    } catch (error) {
      // A request can throw synchronously (e.g. DataError for a bad key)
      // without aborting the transaction on its own — abort it ourselves so
      // earlier ops in this batch don't silently commit. settle() runs first
      // so we reject with the real cause rather than the abort event.
      settle(() => reject(error))
      try {
        tx.abort()
      } catch {
        // Transaction already finished — nothing to abort.
      }
    }
  })
}

export function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
