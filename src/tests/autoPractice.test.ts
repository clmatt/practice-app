import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildFilteredPool, describeFilter, drawFrom, practiceWeights, tagsOf, type PracticeFilter } from '../autoPractice'
import { saveItem, appendLog } from '../storage'
import type { Activity, Color, Item } from '../types'

const activity: Activity = {
  id: 'act-1', name: 'Juggling', itemLabel: 'trick',
  weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z',
}

const makeItem = (id: string, tags: string[] = []): Item => ({
  id, activityId: 'act-1', name: id, color: 'red', tags, createdAt: '2026-01-01T00:00:00.000Z',
})

const filter = (o: { tags?: string[]; colors?: Color[]; advanced?: string } = {}): PracticeFilter => ({
  tags: new Set(o.tags), colors: new Set(o.colors), advanced: o.advanced ?? null,
})

function practiceToday(itemId: string) {
  appendLog({ id: `log-${itemId}`, itemId, practicedAt: new Date().toISOString(), colorBefore: 'red', colorAfter: 'red' })
}

describe('buildFilteredPool', () => {
  const items = [makeItem('a', ['hard']), makeItem('b', ['easy']), makeItem('c')]

  it('returns everything with no tags or filter', () => {
    expect(buildFilteredPool(items, filter())).toEqual(items)
  })

  it('keeps items having any active tag', () => {
    expect(buildFilteredPool(items, filter({ tags: ['hard', 'easy'] })).map(i => i.id)).toEqual(['a', 'b'])
  })

  it('uses the advanced filter instead of tags when set', () => {
    expect(buildFilteredPool(items, filter({ tags: ['easy'], advanced: '!"easy"' })).map(i => i.id)).toEqual(['a', 'c'])
  })

  it('keeps only items of the chosen colors', () => {
    const colored = [makeItem('a'), { ...makeItem('b'), color: 'green' as const }, { ...makeItem('c'), color: 'yellow' as const }]
    expect(buildFilteredPool(colored, filter({ colors: ['green', 'yellow'] })).map(i => i.id)).toEqual(['b', 'c'])
  })

  it('applies the colors together with the tags or the advanced filter', () => {
    const colored = [makeItem('a', ['hard']), { ...makeItem('b', ['hard']), color: 'green' as const }, { ...makeItem('c'), color: 'green' as const }]
    expect(buildFilteredPool(colored, filter({ colors: ['green'], tags: ['hard'] })).map(i => i.id)).toEqual(['b'])
    expect(buildFilteredPool(colored, filter({ colors: ['green'], advanced: '!"hard"' })).map(i => i.id)).toEqual(['c'])
  })

  it('returns nothing for an invalid advanced filter', () => {
    expect(buildFilteredPool(items, filter({ advanced: '"unclosed' }))).toEqual([])
  })
})

describe('drawFrom', () => {
  it('draws an item not yet practiced today', () => {
    const items = [makeItem('a'), makeItem('b')]
    items.forEach(saveItem)
    practiceToday('a')
    expect(drawFrom(activity, items, filter(), new Set())).toEqual({ kind: 'item', item: items[1] })
  })

  it('never draws a skipped item', () => {
    const items = [makeItem('a'), makeItem('b')]
    items.forEach(saveItem)
    expect(drawFrom(activity, items, filter(), new Set(['a']))).toEqual({ kind: 'item', item: items[1] })
  })

  it('reports filter-exhausted when the filter is used up but other items remain', () => {
    const items = [makeItem('a', ['hard']), makeItem('b')]
    items.forEach(saveItem)
    practiceToday('a')
    expect(drawFrom(activity, items, filter({ tags: ['hard'] }), new Set())).toEqual({ kind: 'filter-exhausted' })
    expect(drawFrom(activity, items, filter({ advanced: '"hard"' }), new Set())).toEqual({ kind: 'filter-exhausted' })
  })

  it('reports all-done when everything has been practiced or skipped', () => {
    const items = [makeItem('a', ['hard']), makeItem('b')]
    items.forEach(saveItem)
    practiceToday('a')
    expect(drawFrom(activity, items, filter(), new Set(['b']))).toEqual({ kind: 'all-done' })
    expect(drawFrom(activity, items, filter({ tags: ['hard'] }), new Set(['b']))).toEqual({ kind: 'all-done' })
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
    expect(drawFrom(redOnly, items, filter(), new Set())).toEqual({ kind: 'all-done' })
  })

  it('reports filter-exhausted only if something drawable remains outside the filter', () => {
    const items = [makeItem('a', ['V3']), { ...makeItem('b', ['V4']), color: 'yellow' as const }, makeItem('c', ['V4'])]
    items.forEach(saveItem)
    practiceToday('a')
    expect(drawFrom(redOnly, items, filter({ tags: ['V3'] }), new Set())).toEqual({ kind: 'filter-exhausted' })
    practiceToday('c')
    expect(drawFrom(redOnly, items, filter({ tags: ['V3'] }), new Set())).toEqual({ kind: 'all-done' })
  })
})

describe('practiceWeights', () => {
  const weights = { red: 0.6, yellow: 0.3, green: 0 }

  it('keeps the weights when no colors are chosen', () => {
    expect(practiceWeights(weights, new Set())).toEqual(weights)
  })

  it('leaves out colors that were not chosen and keeps the weights of the chosen ones', () => {
    expect(practiceWeights(weights, new Set(['red', 'yellow']))).toEqual({ red: 0.6, yellow: 0.3, green: 0 })
    expect(practiceWeights(weights, new Set(['yellow']))).toEqual({ red: 0, yellow: 0.3, green: 0 })
  })

  it('draws chosen colors equally when any of them is at 0%', () => {
    expect(practiceWeights(weights, new Set(['green']))).toEqual({ red: 0, yellow: 0, green: 1 })
    expect(practiceWeights(weights, new Set(['yellow', 'green']))).toEqual({ red: 0, yellow: 1, green: 1 })
  })
})

describe('drawFrom with a color filter', () => {
  const redOnly: Activity = { ...activity, weights: { red: 1, yellow: 0, green: 0 } }

  it('draws a chosen 0% color', () => {
    const items = [makeItem('a'), { ...makeItem('b'), color: 'green' as const }]
    items.forEach(saveItem)
    expect(drawFrom(redOnly, items, filter({ colors: ['green'] }), new Set())).toEqual({ kind: 'item', item: items[1] })
  })

  it('reports filter-exhausted when the chosen colors are used up but other items remain', () => {
    const items = [makeItem('a'), { ...makeItem('b'), color: 'green' as const }]
    items.forEach(saveItem)
    practiceToday('b')
    expect(drawFrom(activity, items, filter({ colors: ['green'] }), new Set())).toEqual({ kind: 'filter-exhausted' })
  })
})

describe('describeFilter', () => {
  it('lists the colors in rating order, then the tags or the advanced filter', () => {
    expect(describeFilter(filter())).toBe('all items')
    expect(describeFilter(filter({ colors: ['green', 'red'] }))).toBe('Red, Green')
    expect(describeFilter(filter({ colors: ['green'], tags: ['V4', 'V3'] }))).toBe('Green · V3, V4')
    expect(describeFilter(filter({ tags: ['V3'], advanced: '"slab"' }))).toBe('⚡ "slab"')
  })
})

describe('drawFrom favours items that need more work', () => {
  afterEach(() => { vi.restoreAllMocks() })

  // Two green items last practiced at the same moment: "settled" was always green,
  // "fresh" only just turned green after being red.
  function seedGreens() {
    saveItem({ ...makeItem('settled'), color: 'green' })
    saveItem({ ...makeItem('fresh'), color: 'green' })
    appendLog({ id: 's1', itemId: 'settled', practicedAt: '2026-01-02T18:00:00.000Z', colorBefore: 'green', colorAfter: 'green' })
    appendLog({ id: 'f1', itemId: 'fresh', practicedAt: '2026-01-01T18:00:00.000Z', colorBefore: 'red', colorAfter: 'red' })
    appendLog({ id: 'f2', itemId: 'fresh', practicedAt: '2026-01-02T18:00:00.000Z', colorBefore: 'red', colorAfter: 'green' })
  }
  const items = () => [{ ...makeItem('settled'), color: 'green' as const }, { ...makeItem('fresh'), color: 'green' as const }]
  const draw = (a: Activity) => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4)
    const result = drawFrom(a, items(), filter(), new Set())
    return result.kind === 'item' ? result.item.id : result.kind
  }

  it('does by default', () => {
    seedGreens()
    expect(draw(activity)).toBe('fresh')
  })

  it('does not when the work bias is off', () => {
    seedGreens()
    expect(draw({ ...activity, workBias: 0 })).toBe('settled')
  })

  it('uses the rating memory: a long memory still remembers the red', () => {
    seedGreens()
    // Strength 0.5: a 1-rep memory halves the red (1.25 vs 1), a 10-rep memory barely fades it (≈1.47 vs 1).
    vi.spyOn(Math, 'random').mockReturnValue(0.42)
    const short = drawFrom({ ...activity, workBias: 0.5, ratingMemory: 1 }, items(), filter(), new Set())
    vi.restoreAllMocks()
    vi.spyOn(Math, 'random').mockReturnValue(0.42)
    const long = drawFrom({ ...activity, workBias: 0.5, ratingMemory: 10 }, items(), filter(), new Set())
    expect(short.kind === 'item' && short.item.id).toBe('settled')
    expect(long.kind === 'item' && long.item.id).toBe('fresh')
  })
})
