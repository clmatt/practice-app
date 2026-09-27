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
