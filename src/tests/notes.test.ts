import { describe, it, expect } from 'vitest'
import { getNotesForItem, appendLog } from '../storage'
import type { PracticeLog } from '../types'

const makeLog = (overrides: Partial<PracticeLog> = {}): PracticeLog => ({
  id: 'log-1',
  itemId: 'item-1',
  practicedAt: '2026-01-01T10:00:00.000Z',
  colorBefore: 'red',
  colorAfter: 'yellow',
  ...overrides,
})

describe('getNotesForItem', () => {
  it('returns empty array when no logs exist', () => {
    expect(getNotesForItem('item-1')).toEqual([])
  })

  it('returns empty array when logs have no notes', () => {
    appendLog(makeLog({ id: 'log-1' }))
    expect(getNotesForItem('item-1')).toEqual([])
  })

  it('returns only logs with notes for the given item', () => {
    appendLog(makeLog({ id: 'log-1', note: 'Good session' }))
    appendLog(makeLog({ id: 'log-2', itemId: 'item-2', note: 'Other item' }))
    const notes = getNotesForItem('item-1')
    expect(notes).toHaveLength(1)
    expect(notes[0].note).toBe('Good session')
  })

  it('sorts notes newest-first by practicedAt', () => {
    appendLog(makeLog({ id: 'log-1', practicedAt: '2026-01-01T10:00:00.000Z', note: 'First' }))
    appendLog(makeLog({ id: 'log-2', practicedAt: '2026-01-02T10:00:00.000Z', note: 'Second' }))
    const notes = getNotesForItem('item-1')
    expect(notes[0].note).toBe('Second')
    expect(notes[1].note).toBe('First')
  })

  it('excludes logs with empty string notes', () => {
    appendLog(makeLog({ id: 'log-1', note: '' }))
    expect(getNotesForItem('item-1')).toEqual([])
  })
})
