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
