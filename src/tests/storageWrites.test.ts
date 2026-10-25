import { describe, it, expect, vi } from 'vitest'

vi.mock('../db', async importOriginal => {
  const actual = await importOriginal<typeof import('../db')>()
  return { ...actual, applyOps: vi.fn(actual.applyOps) }
})

import { applyOps } from '../db'
import { saveItem, recordPractice, flushWrites } from '../storage'
import type { Item } from '../types'

const item: Item = { id: 'i1', activityId: 'a1', name: 'Box', color: 'red', createdAt: '2026-01-01T00:00:00.000Z' }

describe('atomic writes', () => {
  it('a rating that changes the colour is one transaction', async () => {
    saveItem(item)
    await flushWrites()
    vi.mocked(applyOps).mockClear()
    recordPractice({ item, color: 'green' })
    await flushWrites()
    expect(applyOps).toHaveBeenCalledTimes(1)
    const ops = vi.mocked(applyOps).mock.calls[0][1]
    expect(ops.map(op => op.store).sort()).toEqual(['items', 'logs'])
  })

  it('a colour edit and its log are one transaction', async () => {
    saveItem(item)
    await flushWrites()
    vi.mocked(applyOps).mockClear()
    saveItem({ ...item, color: 'yellow' })
    await flushWrites()
    expect(applyOps).toHaveBeenCalledTimes(1)
    expect(vi.mocked(applyOps).mock.calls[0][1].map(op => op.store).sort()).toEqual(['items', 'logs'])
  })
})
