import { describe, it, expect } from 'vitest'
import { buildRuns } from '../screens/ItemProgressScreen'
import type { Color, PracticeLog } from '../types'

const makeLog = (colorAfter: Color, practicedAt: string, colorBefore: Color = 'red'): PracticeLog => ({
  id: practicedAt,
  itemId: 'item-1',
  practicedAt,
  colorBefore,
  colorAfter,
})

describe('buildRuns', () => {
  it('returns empty array for no logs', () => {
    expect(buildRuns([])).toEqual([])
  })

  it('returns single run for one log', () => {
    const runs = buildRuns([makeLog('red', '2026-05-01T10:00:00.000Z')])
    expect(runs).toEqual([{ color: 'red', count: 1, startDate: '2026-05-01', endDate: '2026-05-01' }])
  })

  it('groups consecutive same-color logs into one run', () => {
    const logs = [
      makeLog('yellow', '2026-05-01T10:00:00.000Z'),
      makeLog('yellow', '2026-05-02T10:00:00.000Z'),
      makeLog('yellow', '2026-05-03T10:00:00.000Z'),
    ]
    const runs = buildRuns(logs)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toEqual({ color: 'yellow', count: 3, startDate: '2026-05-01', endDate: '2026-05-03' })
  })

  it('starts a new run when color changes', () => {
    const logs = [
      makeLog('red', '2026-05-01T10:00:00.000Z'),
      makeLog('yellow', '2026-05-02T10:00:00.000Z'),
    ]
    const runs = buildRuns(logs)
    expect(runs).toHaveLength(2)
    expect(runs[0]).toEqual({ color: 'red', count: 1, startDate: '2026-05-01', endDate: '2026-05-01' })
    expect(runs[1]).toEqual({ color: 'yellow', count: 1, startDate: '2026-05-02', endDate: '2026-05-02' })
  })

  it('handles regression — same color appears twice as separate runs', () => {
    const logs = [
      makeLog('yellow', '2026-05-01T10:00:00.000Z'),
      makeLog('green', '2026-05-02T10:00:00.000Z'),
      makeLog('yellow', '2026-05-03T10:00:00.000Z'),
    ]
    const runs = buildRuns(logs)
    expect(runs).toHaveLength(3)
    expect(runs.map(r => r.color)).toEqual(['yellow', 'green', 'yellow'])
  })

  it('sorts logs by practicedAt before grouping', () => {
    const logs = [
      makeLog('yellow', '2026-05-03T10:00:00.000Z'),
      makeLog('red', '2026-05-01T10:00:00.000Z'),
      makeLog('red', '2026-05-02T10:00:00.000Z'),
    ]
    const runs = buildRuns(logs)
    expect(runs).toHaveLength(2)
    expect(runs[0]).toEqual({ color: 'red', count: 2, startDate: '2026-05-01', endDate: '2026-05-02' })
    expect(runs[1]).toEqual({ color: 'yellow', count: 1, startDate: '2026-05-03', endDate: '2026-05-03' })
  })
})
