import { describe, it, expect } from 'vitest'
import { openDb, applyOps, readAll, type WriteOp } from '../db'

describe('applyOps', () => {
  it('rolls back the whole batch when one op throws synchronously', async () => {
    const db = await openDb()
    const ops: WriteOp[] = [
      { store: 'items', type: 'put', value: { id: 'a' } },
      // Missing the keyPath ('id') the 'items' store requires — IndexedDB
      // raises a DataError synchronously from store.put() for this one.
      { store: 'items', type: 'put', value: { nope: 1 } as unknown as { id: string } },
      { store: 'meta', type: 'put', key: 'lastBackupAt', value: '2026-01-01T00:00:00.000Z' },
    ]

    await expect(applyOps(db, ops)).rejects.toThrow()
    db.close()

    const reopened = await openDb()
    const all = await readAll(reopened)
    expect(all.items).toEqual([])
    expect(all.meta.lastBackupAt).toBeUndefined()
    reopened.close()
  })
})
