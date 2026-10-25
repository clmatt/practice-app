import { describe, it, expect } from 'vitest'
import { pluralize, pluralLabel, capitalize } from '../labels'

describe('pluralize', () => {
  it.each([
    ['trick', 'tricks'], ['route', 'routes'], ['category', 'categories'], ['day', 'days'],
    ['box', 'boxes'], ['class', 'classes'], ['match', 'matches'], ['dish', 'dishes'], ['waltz', 'waltzes'],
    ['Problem', 'Problems'], ['KEY', 'KEYS'], ['PARTY', 'PARTIES'],
  ])('%s → %s', (word, plural) => {
    expect(pluralize(word)).toBe(plural)
  })
})

describe('pluralLabel', () => {
  it('uses the override when set, else the automatic plural', () => {
    expect(pluralLabel({ itemLabel: 'piece' })).toBe('pieces')
    expect(pluralLabel({ itemLabel: 'cactus', itemLabelPlural: 'cacti' })).toBe('cacti')
    expect(pluralLabel({ itemLabel: 'trick', itemLabelPlural: '  ' })).toBe('tricks')
  })
})

describe('capitalize', () => {
  it('upper-cases the first letter', () => {
    expect(capitalize('tricks')).toBe('Tricks')
    expect(capitalize('')).toBe('')
  })
})
