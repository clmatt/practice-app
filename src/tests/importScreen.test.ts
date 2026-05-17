import { describe, it, expect } from 'vitest'
import {
  validateImportPayload,
  findActivityConflicts,
  findItemConflicts,
  executeImport,
  type ImportPayload,
} from '../screens/ImportScreen'
import { getActivities, getItems, getLogs, saveActivity, saveItem, appendLog } from '../storage'
import type { Activity, Item, PracticeLog } from '../types'

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'act-1',
  name: 'Juggling',
  itemLabel: 'trick',
  weights: { red: 0.6, yellow: 0.3, green: 0.1 },
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'item-1',
  activityId: 'act-1',
  name: 'Mills Mess',
  color: 'red',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makeLog = (overrides: Partial<PracticeLog> = {}): PracticeLog => ({
  id: 'log-1',
  itemId: 'item-1',
  practicedAt: '2026-01-01T10:00:00.000Z',
  colorBefore: 'red',
  colorAfter: 'yellow',
  ...overrides,
})

const makePayload = (overrides: Partial<ImportPayload> = {}): ImportPayload => ({
  exportedAt: '2026-01-01T00:00:00.000Z',
  activities: [],
  items: [],
  logs: [],
  ...overrides,
})

describe('validateImportPayload', () => {
  it('returns null for null input', () => {
    expect(validateImportPayload(null)).toBeNull()
  })

  it('returns null for a non-object', () => {
    expect(validateImportPayload('string')).toBeNull()
  })

  it('returns null if activities is missing', () => {
    expect(validateImportPayload({ items: [], logs: [] })).toBeNull()
  })

  it('returns null if activities is not an array', () => {
    expect(validateImportPayload({ activities: 'x', items: [], logs: [] })).toBeNull()
  })

  it('returns the payload when all arrays are present', () => {
    const payload = { exportedAt: '2026-01-01', activities: [], items: [], logs: [] }
    expect(validateImportPayload(payload)).toEqual(payload)
  })
})

describe('findActivityConflicts', () => {
  it('returns empty array when no name matches', () => {
    const imported = [makeActivity({ name: 'Juggling' })]
    const existing = [makeActivity({ id: 'e1', name: 'Piano' })]
    expect(findActivityConflicts(imported, existing)).toEqual([])
  })

  it('returns the imported activity when its name matches an existing one', () => {
    const imported = [makeActivity({ name: 'Juggling' })]
    const existing = [makeActivity({ id: 'e1', name: 'Juggling' })]
    expect(findActivityConflicts(imported, existing)).toEqual([imported[0]])
  })

  it('returns only the matching imported activities, not all', () => {
    const imported = [
      makeActivity({ id: 'i1', name: 'Juggling' }),
      makeActivity({ id: 'i2', name: 'Piano' }),
    ]
    const existing = [makeActivity({ id: 'e1', name: 'Juggling' })]
    const conflicts = findActivityConflicts(imported, existing)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].id).toBe('i1')
  })

  it('returns empty array when existing list is empty', () => {
    const imported = [makeActivity({ name: 'Juggling' })]
    expect(findActivityConflicts(imported, [])).toEqual([])
  })
})

describe('findItemConflicts', () => {
  it('returns empty array when no item names match', () => {
    const impAct = makeActivity({ id: 'imp-act' })
    const existAct = makeActivity({ id: 'exist-act' })
    const impItems = [makeItem({ id: 'i1', activityId: 'imp-act', name: 'Mills Mess' })]
    const existItems = [makeItem({ id: 'e1', activityId: 'exist-act', name: 'Shower' })]
    expect(findItemConflicts(impAct, existAct, impItems, existItems)).toEqual([])
  })

  it('returns conflict pairs when item names match', () => {
    const impAct = makeActivity({ id: 'imp-act' })
    const existAct = makeActivity({ id: 'exist-act' })
    const impItem = makeItem({ id: 'i1', activityId: 'imp-act', name: 'Mills Mess' })
    const existItem = makeItem({ id: 'e1', activityId: 'exist-act', name: 'Mills Mess' })
    const conflicts = findItemConflicts(impAct, existAct, [impItem], [existItem])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].importedItem).toEqual(impItem)
    expect(conflicts[0].existingItem).toEqual(existItem)
  })

  it('ignores imported items not belonging to the imported activity', () => {
    const impAct = makeActivity({ id: 'imp-act' })
    const existAct = makeActivity({ id: 'exist-act' })
    const wrongActItem = makeItem({ id: 'i1', activityId: 'other-act', name: 'Mills Mess' })
    const existItem = makeItem({ id: 'e1', activityId: 'exist-act', name: 'Mills Mess' })
    expect(findItemConflicts(impAct, existAct, [wrongActItem], [existItem])).toEqual([])
  })
})

describe('executeImport', () => {
  it('imports activity, items, and logs with fresh IDs', () => {
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act' })],
      logs: [makeLog({ id: 'imp-log', itemId: 'imp-item' })],
    })
    executeImport(payload, new Map(), new Map())
    const acts = getActivities()
    expect(acts).toHaveLength(1)
    expect(acts[0].name).toBe('Juggling')
    expect(acts[0].id).not.toBe('imp-act')
    const items = getItems(acts[0].id)
    expect(items).toHaveLength(1)
    expect(items[0].id).not.toBe('imp-item')
    const logs = getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].itemId).toBe(items[0].id)
  })

  it('keep-existing skips the activity and its items entirely', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act' })],
    })
    const stats = executeImport(payload, new Map([['imp-act', 'keep-existing']]), new Map())
    expect(getActivities()).toHaveLength(1)
    expect(getActivities()[0].id).toBe('exist-act')
    expect(stats.skipped).toBe(1)
  })

  it('replace deletes existing activity and imports fresh', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Shower' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess' })],
    })
    executeImport(payload, new Map([['imp-act', 'replace']]), new Map())
    const acts = getActivities()
    expect(acts).toHaveLength(1)
    expect(acts[0].id).not.toBe('exist-act')
    const items = getItems(acts[0].id)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Mills Mess')
  })

  it('keep-both imports with "(imported)" name suffix', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
    })
    executeImport(payload, new Map([['imp-act', 'keep-both']]), new Map())
    const acts = getActivities()
    expect(acts).toHaveLength(2)
    const imported = acts.find(a => a.id !== 'exist-act')!
    expect(imported.name).toBe('Juggling (imported)')
  })

  it('combine merges non-conflicting items into the existing activity without creating a new one', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Shower' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess' })],
    })
    executeImport(payload, new Map([['imp-act', 'combine']]), new Map())
    expect(getActivities()).toHaveLength(1)
    const items = getItems('exist-act')
    expect(items).toHaveLength(2)
    expect(items.map(i => i.name).sort()).toEqual(['Mills Mess', 'Shower'])
  })

  it('combine + item keep-existing discards the imported item and its logs', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Mills Mess' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess' })],
      logs: [makeLog({ id: 'imp-log', itemId: 'imp-item' })],
    })
    const stats = executeImport(
      payload,
      new Map([['imp-act', 'combine']]),
      new Map([['imp-item', 'keep-existing']]),
    )
    expect(getItems('exist-act')).toHaveLength(1)
    expect(getItems('exist-act')[0].id).toBe('exist-item')
    expect(getLogs()).toHaveLength(0)
    expect(stats.skipped).toBe(1)
  })

  it('combine + item keep-imported replaces existing item and its logs', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Mills Mess', color: 'red' }))
    appendLog(makeLog({ id: 'exist-log', itemId: 'exist-item' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess', color: 'green' })],
      logs: [makeLog({ id: 'imp-log', itemId: 'imp-item', colorAfter: 'green' })],
    })
    executeImport(
      payload,
      new Map([['imp-act', 'combine']]),
      new Map([['imp-item', 'keep-imported']]),
    )
    const items = getItems('exist-act')
    expect(items).toHaveLength(1)
    expect(items[0].color).toBe('green')
    expect(items[0].id).not.toBe('exist-item')
    const logs = getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].colorAfter).toBe('green')
  })

  it('combine + item keep-both adds imported alongside existing', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Mills Mess', color: 'red' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess', color: 'green' })],
    })
    executeImport(
      payload,
      new Map([['imp-act', 'combine']]),
      new Map([['imp-item', 'keep-both']]),
    )
    const items = getItems('exist-act')
    expect(items).toHaveLength(2)
    expect(items.every(i => i.name === 'Mills Mess')).toBe(true)
    expect(items.map(i => i.color).sort()).toEqual(['green', 'red'])
  })

  it('returns zero stats for an empty payload', () => {
    const stats = executeImport(makePayload(), new Map(), new Map())
    expect(stats).toEqual({ activitiesAdded: 0, itemsAdded: 0, logsAdded: 0, skipped: 0 })
  })
})
