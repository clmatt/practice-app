import { describe, it, expect } from 'vitest'
import {
  getActivities, saveActivity, deleteActivity,
  getItems, saveItem, deleteItem,
  getLogs, appendLog, getTodayPracticedItemIds,
  getSessionHistory,
} from '../storage'
import type { Activity, Item, PracticeLog } from '../types'

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'act-1',
  name: 'Juggling',
  itemLabel: 'trick',
  weights: { red: 0.6, yellow: 0.3, green: 0.1 },
  createdAt: new Date().toISOString(),
  ...overrides,
})

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'item-1',
  activityId: 'act-1',
  name: 'Mills Mess',
  color: 'red',
  createdAt: new Date().toISOString(),
  ...overrides,
})

const makeLog = (overrides: Partial<PracticeLog> = {}): PracticeLog => ({
  id: 'log-1',
  itemId: 'item-1',
  practicedAt: new Date().toISOString(),
  colorBefore: 'red',
  colorAfter: 'yellow',
  ...overrides,
})

describe('activities', () => {
  it('returns empty array when nothing stored', () => {
    expect(getActivities()).toEqual([])
  })

  it('saves and retrieves an activity', () => {
    const a = makeActivity()
    saveActivity(a)
    expect(getActivities()).toEqual([a])
  })

  it('updates an existing activity in place', () => {
    saveActivity(makeActivity())
    saveActivity(makeActivity({ name: 'Juggling v2' }))
    const all = getActivities()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Juggling v2')
  })

  it('deletes an activity by id', () => {
    saveActivity(makeActivity())
    deleteActivity('act-1')
    expect(getActivities()).toEqual([])
  })
})

describe('items', () => {
  it('returns only items for the given activityId', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1' }))
    saveItem(makeItem({ id: 'i2', activityId: 'act-2' }))
    expect(getItems('act-1')).toHaveLength(1)
    expect(getItems('act-1')[0].id).toBe('i1')
  })

  it('updates an existing item in place', () => {
    saveItem(makeItem())
    saveItem(makeItem({ color: 'green' }))
    const all = getItems('act-1')
    expect(all).toHaveLength(1)
    expect(all[0].color).toBe('green')
  })

  it('deletes an item by id', () => {
    saveItem(makeItem())
    deleteItem('item-1')
    expect(getItems('act-1')).toEqual([])
  })
})

describe('logs', () => {
  it('appends logs without replacing', () => {
    appendLog(makeLog({ id: 'l1' }))
    appendLog(makeLog({ id: 'l2', itemId: 'item-2' }))
    expect(getLogs()).toHaveLength(2)
  })

  it('getTodayPracticedItemIds includes items logged today', () => {
    saveItem(makeItem({ id: 'item-1', activityId: 'act-1' }))
    saveItem(makeItem({ id: 'item-2', activityId: 'act-1' }))
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    appendLog(makeLog({ id: 'l1', itemId: 'item-1', practicedAt: new Date().toISOString() }))
    appendLog(makeLog({ id: 'l2', itemId: 'item-2', practicedAt: yesterday }))
    const ids = getTodayPracticedItemIds('act-1')
    expect(ids.has('item-1')).toBe(true)
    expect(ids.has('item-2')).toBe(false)
  })

  it('getTodayPracticedItemIds only includes items from the given activity', () => {
    saveItem(makeItem({ id: 'item-1', activityId: 'act-1' }))
    saveItem(makeItem({ id: 'item-2', activityId: 'act-2' }))
    appendLog(makeLog({ id: 'l1', itemId: 'item-1' }))
    appendLog(makeLog({ id: 'l2', itemId: 'item-2' }))
    const ids = getTodayPracticedItemIds('act-1')
    expect(ids.has('item-1')).toBe(true)
    expect(ids.has('item-2')).toBe(false)
  })
})

describe('getSessionHistory', () => {
  it('returns empty array when there are no logs', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1' }))
    expect(getSessionHistory('act-1')).toEqual([])
  })

  it('returns one session for logs on the same day', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1', name: 'Mills Mess' }))
    saveItem(makeItem({ id: 'i2', activityId: 'act-1', name: 'Shower' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'yellow' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i2', practicedAt: '2026-05-16T10:05:00.000Z', colorBefore: 'yellow', colorAfter: 'yellow' }))
    const sessions = getSessionHistory('act-1')
    expect(sessions).toHaveLength(1)
    expect(sessions[0].date).toBe('2026-05-16')
    expect(sessions[0].itemCount).toBe(2)
  })

  it('returns two sessions for logs on different days, newest first', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-14T10:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    const sessions = getSessionHistory('act-1')
    expect(sessions).toHaveLength(2)
    expect(sessions[0].date).toBe('2026-05-16')
    expect(sessions[1].date).toBe('2026-05-14')
  })

  it('itemCount counts distinct items, not total log entries', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-16T09:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'yellow' }))
    const sessions = getSessionHistory('act-1')
    expect(sessions[0].itemCount).toBe(1)
  })

  it('changes only includes items where color actually changed', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1', name: 'Mills Mess' }))
    saveItem(makeItem({ id: 'i2', activityId: 'act-1', name: 'Shower' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'yellow' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i2', practicedAt: '2026-05-16T10:05:00.000Z', colorBefore: 'yellow', colorAfter: 'yellow' }))
    const sessions = getSessionHistory('act-1')
    expect(sessions[0].changes).toHaveLength(1)
    expect(sessions[0].changes[0].itemName).toBe('Mills Mess')
    expect(sessions[0].changes[0].colorBefore).toBe('red')
    expect(sessions[0].changes[0].colorAfter).toBe('yellow')
  })

  it('excludes logs for items not in the given activity', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1' }))
    saveItem(makeItem({ id: 'i2', activityId: 'act-2' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i2', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'red' }))
    const sessions = getSessionHistory('act-1')
    expect(sessions[0].itemCount).toBe(1)
  })

  it('for multiple logs of the same item in one day, uses the last log for change detection', () => {
    saveItem(makeItem({ id: 'i1', activityId: 'act-1', name: 'Mills Mess' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-16T09:00:00.000Z', colorBefore: 'red', colorAfter: 'yellow' }))
    appendLog(makeLog({ id: 'l2', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'yellow', colorAfter: 'yellow' }))
    const sessions = getSessionHistory('act-1')
    // Last log for i1: yellow → yellow (no change)
    expect(sessions[0].changes).toHaveLength(0)
  })

  it('skips logs for deleted items gracefully', () => {
    // i1 is NOT saved — simulates a deleted item
    appendLog(makeLog({ id: 'l1', itemId: 'i1', practicedAt: '2026-05-16T10:00:00.000Z', colorBefore: 'red', colorAfter: 'yellow' }))
    const sessions = getSessionHistory('act-1')
    expect(sessions).toHaveLength(0)
  })
})
