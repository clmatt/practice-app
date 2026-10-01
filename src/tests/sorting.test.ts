import { describe, it, expect } from 'vitest'
import { compareNatural, sortTags } from '../sorting'
import { tagsOf } from '../autoPractice'
import { filterAndSortItems } from '../itemList'
import type { Item } from '../types'

describe('natural sorting', () => {
  it('orders numbers inside text by value', () => {
    expect(['V10', 'V2', 'V1', 'V11', 'V3'].sort(compareNatural)).toEqual(['V1', 'V2', 'V3', 'V10', 'V11'])
  })

  it('sortTags removes duplicates and sorts naturally', () => {
    expect(sortTags(['V10', 'slab', 'V2', 'V2', 'crimpy'])).toEqual(['crimpy', 'slab', 'V2', 'V10'])
  })

  it('is used for Auto Practice tag chips and the Items list', () => {
    const item = (id: string, tags: string[]): Item => ({ id, activityId: 'a', name: id, color: 'red', tags, createdAt: '2026-01-01T00:00:00.000Z' })
    const items = [item('Problem 10', ['V10']), item('Problem 2', ['V2']), item('Problem 1', ['V1'])]
    expect(tagsOf(items)).toEqual(['V1', 'V2', 'V10'])
    const sorted = filterAndSortItems(items, { query: '', colors: new Set(), tags: new Set() }, 'name-asc', {})
    expect(sorted.map(i => i.name)).toEqual(['Problem 1', 'Problem 2', 'Problem 10'])
  })
})
