import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../db', async importOriginal => {
  const actual = await importOriginal<typeof import('../db')>()
  return { ...actual, applyOps: vi.fn(actual.applyOps) }
})

import { applyOps } from '../db'
import { saveActivity, getActivities, onStorageError, flushWrites, reopenStorageForTests } from '../storage'
import type { Activity } from '../types'

const activity = (o: Partial<Activity> = {}): Activity => ({
  id: 'act-1', name: 'Juggling', itemLabel: 'trick',
  weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z', ...o,
})

let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
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

  it('a throwing error listener does not block other listeners or later writes', async () => {
    vi.mocked(applyOps).mockRejectedValueOnce(new Error('boom'))
    const throwingListener = vi.fn(() => { throw new Error('listener boom') })
    const okListener = vi.fn()
    const unsubscribeThrowing = onStorageError(throwingListener)
    const unsubscribeOk = onStorageError(okListener)

    saveActivity(activity())
    await flushWrites()
    expect(throwingListener).toHaveBeenCalledTimes(1)
    expect(okListener).toHaveBeenCalledTimes(1)

    // The write queue must not be poisoned by the listener throwing — this
    // next write should still make it to IndexedDB. (act-1's own write really
    // did fail and is not expected to have persisted.)
    saveActivity(activity({ id: 'act-2', name: 'Climbing' }))
    await flushWrites()
    await reopenStorageForTests()
    expect(getActivities().map(a => a.id)).toEqual(['act-2'])

    unsubscribeThrowing()
    unsubscribeOk()
  })

  it('recovers from a lost IndexedDB connection by reopening and retrying, without notifying listeners', async () => {
    vi.mocked(applyOps).mockRejectedValueOnce(new DOMException('lost', 'InvalidStateError'))
    const listener = vi.fn()
    const unsubscribe = onStorageError(listener)

    saveActivity(activity())
    await flushWrites()
    expect(listener).not.toHaveBeenCalled()

    await reopenStorageForTests()
    expect(getActivities()).toEqual([activity()])
    unsubscribe()
  })

  it('recovers from an UnknownError (the common WebKit lost-connection failure) by reopening and retrying', async () => {
    vi.mocked(applyOps).mockRejectedValueOnce(new DOMException('lost', 'UnknownError'))
    const listener = vi.fn()
    const unsubscribe = onStorageError(listener)

    saveActivity(activity())
    await flushWrites()
    expect(listener).not.toHaveBeenCalled()

    await reopenStorageForTests()
    expect(getActivities()).toEqual([activity()])
    unsubscribe()
  })

  it('does not retry a QuotaExceededError (retrying a full disk cannot help)', async () => {
    vi.mocked(applyOps).mockRejectedValueOnce(new DOMException('Storage full', 'QuotaExceededError'))
    const listener = vi.fn()
    const unsubscribe = onStorageError(listener)
    const callsBefore = vi.mocked(applyOps).mock.calls.length

    saveActivity(activity())
    await flushWrites()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(vi.mocked(applyOps).mock.calls.length - callsBefore).toBe(1) // no retry attempted
    unsubscribe()
  })

  it('notifies listeners once when the connection is lost and the retry also fails', async () => {
    vi.mocked(applyOps)
      .mockRejectedValueOnce(new DOMException('lost', 'UnknownError'))
      .mockRejectedValueOnce(new DOMException('still lost', 'UnknownError'))
    const listener = vi.fn()
    const unsubscribe = onStorageError(listener)
    const callsBefore = vi.mocked(applyOps).mock.calls.length

    saveActivity(activity())
    await flushWrites()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(vi.mocked(applyOps).mock.calls.length - callsBefore).toBe(2) // the original attempt, then one retry after reopening
    unsubscribe()
  })
})
