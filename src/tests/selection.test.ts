import { describe, it, expect } from 'vitest'
import { selectItem } from '../selection'
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
