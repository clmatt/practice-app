import { describe, it, expect } from 'vitest'
import { workScore, workScoresByItem } from '../workScore'
import type { Color, Item, PracticeLog } from '../types'

const reps = (n: number, c: Color): Color[] => Array(n).fill(c)

describe('workScore', () => {
  it('is the starting color when there are no ratings yet (red 1, yellow 0.5, green 0)', () => {
    expect(workScore('red', [], 3)).toBe(1)
    expect(workScore('yellow', [], 3)).toBe(0.5)
    expect(workScore('green', [], 3)).toBe(0)
  })

  it('after a long red stretch, one green still leaves a lot of work', () => {
    expect(workScore('red', [...reps(20, 'red'), 'green'], 3)).toBeCloseTo(0.79, 2)
    expect(workScore('red', [...reps(20, 'red'), ...reps(10, 'green')], 3)).toBeCloseTo(0.10, 2)
  })

  it('a green item with a one-off red history needs much less work', () => {
    expect(workScore('green', [...reps(20, 'green'), 'red', 'green'], 3)).toBeCloseTo(0.16, 2)
  })

  it('halves the weight of a rating every half-life reps', () => {
    // After 3 greens with a 3-rep memory, the red start counts for half.
    expect(workScore('red', reps(3, 'green'), 3)).toBeCloseTo(0.5, 10)
    expect(workScore('red', reps(1, 'green'), 1)).toBeCloseTo(0.5, 10)
  })
})

const item = (id: string, color: Color): Item => ({ id, activityId: 'a', name: id, color, createdAt: '2026-01-01T00:00:00.000Z' })
const log = (itemId: string, at: string, colorBefore: Color, colorAfter: Color, o: Partial<PracticeLog> = {}): PracticeLog =>
  ({ id: `${itemId}-${at}`, itemId, practicedAt: at, colorBefore, colorAfter, ...o })

describe('workScoresByItem', () => {
  it('starts from the color before the first log, reads logs in time order, and counts hand edits', () => {
    const scores = workScoresByItem([item('x', 'green'), item('y', 'yellow')], [
      log('x', '2026-01-03T10:00:00.000Z', 'yellow', 'green', { source: 'edit' }),
      log('x', '2026-01-02T10:00:00.000Z', 'red', 'yellow'),
    ], 3)
    // red start → yellow → green
    expect(scores.x).toBeCloseTo(workScore('red', ['yellow', 'green'], 3), 10)
    // never rated: its own color
    expect(scores.y).toBe(0.5)
  })
})
