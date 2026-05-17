import { describe, it, expect } from 'vitest'
import { selectItem, computeRecencyWeights } from '../selection'
import type { Item } from '../types'

const makeItem = (id: string, color: Item['color']): Item => ({
  id,
  activityId: 'act-1',
  name: id,
  color,
  createdAt: new Date().toISOString(),
})

const weights = { red: 0.6, yellow: 0.3, green: 0.1 }

describe('selectItem', () => {
  it('returns null for empty item list', () => {
    expect(selectItem([], new Set(), weights)).toBeNull()
  })

  it('returns null when all items have been practiced today', () => {
    const items = [makeItem('a', 'red'), makeItem('b', 'yellow')]
    expect(selectItem(items, new Set(['a', 'b']), weights)).toBeNull()
  })

  it('returns the single available item', () => {
    const items = [makeItem('a', 'red'), makeItem('b', 'yellow')]
    expect(selectItem(items, new Set(['b']), weights)).toEqual(items[0])
  })

  it('never returns a practiced item across many draws', () => {
    const items = [makeItem('a', 'red'), makeItem('b', 'red'), makeItem('c', 'green')]
    const practiced = new Set(['a'])
    for (let i = 0; i < 100; i++) {
      expect(selectItem(items, practiced, weights)?.id).not.toBe('a')
    }
  })

  it('selects from all available colors over many draws', () => {
    const items = [makeItem('r', 'red'), makeItem('y', 'yellow'), makeItem('g', 'green')]
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const item = selectItem(items, new Set(), weights)
      if (item) seen.add(item.color)
    }
    expect(seen.has('red')).toBe(true)
    expect(seen.has('yellow')).toBe(true)
    expect(seen.has('green')).toBe(true)
  })

  it('skips empty categories and redistributes their weight', () => {
    const items = [makeItem('r', 'red'), makeItem('y', 'yellow')]
    const seen = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const item = selectItem(items, new Set(), weights)
      if (item) seen.add(item.color)
    }
    expect(seen.has('green')).toBe(false)
    expect(seen.has('red')).toBe(true)
    expect(seen.has('yellow')).toBe(true)
  })

  it('red is selected more often than yellow, yellow more than green', () => {
    const items = [makeItem('r', 'red'), makeItem('y', 'yellow'), makeItem('g', 'green')]
    const tally = { red: 0, yellow: 0, green: 0 }
    for (let i = 0; i < 1000; i++) {
      const item = selectItem(items, new Set(), weights)
      if (item) tally[item.color]++
    }
    expect(tally.red).toBeGreaterThan(tally.yellow)
    expect(tally.yellow).toBeGreaterThan(tally.green)
  })
})

describe('computeRecencyWeights', () => {
  const makeW = (id: string): Item => ({
    id, activityId: 'act-1', name: id, color: 'red', createdAt: '2024-01-01T00:00:00.000Z',
  })

  it('single item gets weight 1', () => {
    expect(computeRecencyWeights([makeW('a')], 0.9, {})).toEqual([1])
  })

  it('two never-practiced items get equal weight', () => {
    const [a, b] = [makeW('a'), makeW('b')]
    const [wa, wb] = computeRecencyWeights([a, b], 0.9, {})
    expect(wa).toBeCloseTo(0.5)
    expect(wb).toBeCloseTo(0.5)
  })

  it('stale item gets higher weight than recent with bias < 1', () => {
    const [a, b] = [makeW('a'), makeW('b')]
    const lastPracticedAt = { a: '2024-01-01T00:00:00.000Z', b: '2024-06-01T00:00:00.000Z' }
    const [wa, wb] = computeRecencyWeights([a, b], 0.5, lastPracticedAt)
    expect(wa).toBeGreaterThan(wb)
    expect(wa).toBeCloseTo(1 / 1.5)
    expect(wb).toBeCloseTo(0.5 / 1.5)
  })

  it('never-practiced item gets higher weight than practiced item with bias < 1', () => {
    const [a, b] = [makeW('a'), makeW('b')]
    const lastPracticedAt = { b: '2024-06-01T00:00:00.000Z' }
    const [wa, wb] = computeRecencyWeights([a, b], 0.5, lastPracticedAt)
    expect(wa).toBeGreaterThan(wb)
  })

  it('bias=1 produces uniform weights regardless of recency', () => {
    const [a, b, c] = [makeW('a'), makeW('b'), makeW('c')]
    const lastPracticedAt = {
      a: '2024-01-01T00:00:00.000Z',
      b: '2024-03-01T00:00:00.000Z',
      c: '2024-06-01T00:00:00.000Z',
    }
    const [wa, wb, wc] = computeRecencyWeights([a, b, c], 1, lastPracticedAt)
    expect(wa).toBeCloseTo(1 / 3)
    expect(wb).toBeCloseTo(1 / 3)
    expect(wc).toBeCloseTo(1 / 3)
  })

  it('bias=0 gives all weight to rank-0 (most stale) item', () => {
    const [a, b] = [makeW('a'), makeW('b')]
    const lastPracticedAt = { a: '2024-01-01T00:00:00.000Z', b: '2024-06-01T00:00:00.000Z' }
    const [wa, wb] = computeRecencyWeights([a, b], 0, lastPracticedAt)
    expect(wa).toBeCloseTo(1)
    expect(wb).toBeCloseTo(0)
  })

  it('bias=0 with multiple never-practiced items distributes uniformly among them', () => {
    const [a, b] = [makeW('a'), makeW('b')]
    const [wa, wb] = computeRecencyWeights([a, b], 0, {})
    expect(wa).toBeCloseTo(0.5)
    expect(wb).toBeCloseTo(0.5)
  })

  it('items with the same timestamp share a rank and get equal weight', () => {
    const [a, b, c] = [makeW('a'), makeW('b'), makeW('c')]
    const lastPracticedAt = {
      a: '2024-01-01T00:00:00.000Z',
      b: '2024-01-01T00:00:00.000Z',
      c: '2024-06-01T00:00:00.000Z',
    }
    const [wa, wb, wc] = computeRecencyWeights([a, b, c], 0.5, lastPracticedAt)
    expect(wa).toBeCloseTo(wb)
    expect(wa).toBeGreaterThan(wc)
  })

  it('weight for each item is independent of pool order', () => {
    const [a, b] = [makeW('a'), makeW('b')]
    const lastPracticedAt = { a: '2024-01-01T00:00:00.000Z', b: '2024-06-01T00:00:00.000Z' }
    const w1 = computeRecencyWeights([a, b], 0.5, lastPracticedAt)
    const w2 = computeRecencyWeights([b, a], 0.5, lastPracticedAt)
    expect(w1[0]).toBeCloseTo(w2[1])
    expect(w1[1]).toBeCloseTo(w2[0])
  })
})
