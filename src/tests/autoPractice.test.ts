import { describe, it, expect } from 'vitest'
import { buildFilteredPool, drawFrom, tagsOf } from '../autoPractice'
import { saveItem, appendLog } from '../storage'
import type { Activity, Item } from '../types'

const activity: Activity = {
  id: 'act-1', name: 'Juggling', itemLabel: 'trick',
  weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z',
}

const makeItem = (id: string, tags: string[] = []): Item => ({
  id, activityId: 'act-1', name: id, color: 'red', tags, createdAt: '2026-01-01T00:00:00.000Z',
})

function practiceToday(itemId: string) {
  appendLog({ id: `log-${itemId}`, itemId, practicedAt: new Date().toISOString(), colorBefore: 'red', colorAfter: 'red' })
}

describe('buildFilteredPool', () => {
  const items = [makeItem('a', ['hard']), makeItem('b', ['easy']), makeItem('c')]

  it('returns everything with no tags or filter', () => {
    expect(buildFilteredPool(items, new Set(), null)).toEqual(items)
  })

  it('keeps items having any active tag', () => {
    expect(buildFilteredPool(items, new Set(['hard', 'easy']), null).map(i => i.id)).toEqual(['a', 'b'])
  })

  it('uses the advanced filter instead of tags when set', () => {
    expect(buildFilteredPool(items, new Set(['easy']), '!"easy"').map(i => i.id)).toEqual(['a', 'c'])
  })

  it('returns nothing for an invalid advanced filter', () => {
    expect(buildFilteredPool(items, new Set(), '"unclosed')).toEqual([])
  })
})

describe('drawFrom', () => {
  it('draws an item not yet practiced today', () => {
    const items = [makeItem('a'), makeItem('b')]
    items.forEach(saveItem)
    practiceToday('a')
    expect(drawFrom(activity, items, new Set(), null, new Set())).toEqual({ kind: 'item', item: items[1] })
  })

  it('never draws a skipped item', () => {
    const items = [makeItem('a'), makeItem('b')]
    items.forEach(saveItem)
    expect(drawFrom(activity, items, new Set(), null, new Set(['a']))).toEqual({ kind: 'item', item: items[1] })
  })

  it('reports filter-exhausted when the filter is used up but other items remain', () => {
    const items = [makeItem('a', ['hard']), makeItem('b')]
    items.forEach(saveItem)
    practiceToday('a')
    expect(drawFrom(activity, items, new Set(['hard']), null, new Set())).toEqual({ kind: 'filter-exhausted' })
    expect(drawFrom(activity, items, new Set(), '"hard"', new Set())).toEqual({ kind: 'filter-exhausted' })
  })

  it('reports all-done when everything has been practiced or skipped', () => {
    const items = [makeItem('a', ['hard']), makeItem('b')]
    items.forEach(saveItem)
    practiceToday('a')
    expect(drawFrom(activity, items, new Set(), null, new Set(['b']))).toEqual({ kind: 'all-done' })
    expect(drawFrom(activity, items, new Set(['hard']), null, new Set(['b']))).toEqual({ kind: 'all-done' })
  })
})

describe('tagsOf', () => {
  it('lists each tag once, sorted', () => {
    expect(tagsOf([makeItem('a', ['b', 'a']), makeItem('b', ['a']), makeItem('c')])).toEqual(['a', 'b'])
  })
})

describe('drawFrom with 0% colors', () => {
  const redOnly: Activity = { ...activity, weights: { red: 1, yellow: 0, green: 0 } }

  it('ends the session when only 0% colors are left', () => {
    const items = [makeItem('a'), { ...makeItem('b'), color: 'yellow' as const }]
    items.forEach(saveItem)
    practiceToday('a')
    expect(drawFrom(redOnly, items, new Set(), null, new Set())).toEqual({ kind: 'all-done' })
  })

  it('reports filter-exhausted only if something drawable remains outside the filter', () => {
    const items = [makeItem('a', ['V3']), { ...makeItem('b', ['V4']), color: 'yellow' as const }, makeItem('c', ['V4'])]
    items.forEach(saveItem)
    practiceToday('a')
    expect(drawFrom(redOnly, items, new Set(['V3']), null, new Set())).toEqual({ kind: 'filter-exhausted' })
    practiceToday('c')
    expect(drawFrom(redOnly, items, new Set(['V3']), null, new Set())).toEqual({ kind: 'all-done' })
  })
})
