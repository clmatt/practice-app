import { describe, it, expect } from 'vitest'
import { filterAndSortItems, readListView, writeListView, type ItemListFilter } from '../itemList'
import type { Item } from '../types'

const item = (id: string, o: Partial<Item> = {}): Item => ({
  id, activityId: 'act-1', name: id, color: 'red', createdAt: '2026-01-01T00:00:00.000Z', ...o,
})

const noFilter: ItemListFilter = { query: '', colors: new Set(), tags: new Set() }

const items = [
  item('Box', { color: 'green', tags: ['3-ball'], createdAt: '2026-03-01T00:00:00.000Z' }),
  item('Mills Mess', { color: 'red', tags: ['3-ball', 'hard'], createdAt: '2026-01-01T00:00:00.000Z' }),
  item('Shower', { color: 'yellow', tags: [], createdAt: '2026-02-01T00:00:00.000Z' }),
]
const lastPracticed = { Box: '2026-09-20T18:00:00.000Z', 'Mills Mess': '2026-09-25T18:00:00.000Z' }
const names = (list: Item[]) => list.map(i => i.name)

describe('filterAndSortItems', () => {
  it('searches names case-insensitively, ignoring surrounding spaces', () => {
    expect(names(filterAndSortItems(items, { ...noFilter, query: '  mILLs ' }, 'name-asc', lastPracticed))).toEqual(['Mills Mess'])
  })

  it('keeps items of any selected color', () => {
    expect(names(filterAndSortItems(items, { ...noFilter, colors: new Set(['red', 'green']) }, 'name-asc', lastPracticed)))
      .toEqual(['Box', 'Mills Mess'])
  })

  it('keeps items having any selected tag', () => {
    expect(names(filterAndSortItems(items, { ...noFilter, tags: new Set(['hard']) }, 'name-asc', lastPracticed))).toEqual(['Mills Mess'])
  })

  it('combines search, colors and tags', () => {
    const filter = { query: 'o', colors: new Set(['green' as const]), tags: new Set(['3-ball']) }
    expect(names(filterAndSortItems(items, filter, 'name-asc', lastPracticed))).toEqual(['Box'])
  })

  it('sorts by name both ways', () => {
    expect(names(filterAndSortItems(items, noFilter, 'name-asc', lastPracticed))).toEqual(['Box', 'Mills Mess', 'Shower'])
    expect(names(filterAndSortItems(items, noFilter, 'name-desc', lastPracticed))).toEqual(['Shower', 'Mills Mess', 'Box'])
  })

  it('sorts by last practiced, never-practiced last for recent and first for oldest', () => {
    expect(names(filterAndSortItems(items, noFilter, 'practiced-recent', lastPracticed))).toEqual(['Mills Mess', 'Box', 'Shower'])
    expect(names(filterAndSortItems(items, noFilter, 'practiced-oldest', lastPracticed))).toEqual(['Shower', 'Box', 'Mills Mess'])
  })

  it('sorts by date added and by color', () => {
    expect(names(filterAndSortItems(items, noFilter, 'date-newest', lastPracticed))).toEqual(['Box', 'Shower', 'Mills Mess'])
    expect(names(filterAndSortItems(items, noFilter, 'date-oldest', lastPracticed))).toEqual(['Mills Mess', 'Shower', 'Box'])
    expect(names(filterAndSortItems(items, noFilter, 'color', lastPracticed))).toEqual(['Mills Mess', 'Shower', 'Box'])
  })

  it('does not reorder the input array', () => {
    const input = [...items]
    filterAndSortItems(input, noFilter, 'name-desc', lastPracticed)
    expect(input).toEqual(items)
  })
})

describe('list view in the URL', () => {
  it('round-trips search, sort, colors and tags', () => {
    const view = { query: 'mills', sort: 'practiced-recent' as const, colors: new Set(['green', 'red'] as const), tags: new Set(['hard', '3-ball']) }
    const params = writeListView(view)
    expect(params.toString()).toBe('q=mills&sort=practiced-recent&color=red%2Cgreen&tag=3-ball&tag=hard')
    expect(readListView(params)).toEqual(view)
  })

  it('defaults cleanly and ignores junk', () => {
    expect(writeListView(readListView(new URLSearchParams())).toString()).toBe('')
    const junk = readListView(new URLSearchParams('sort=bogus&color=purple,red'))
    expect(junk.sort).toBe('name-asc')
    expect([...junk.colors]).toEqual(['red'])
  })
})
