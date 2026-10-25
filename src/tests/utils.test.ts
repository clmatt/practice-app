import { describe, it, expect } from 'vitest'
import { generateId, toggled } from '../utils'

describe('generateId', () => {
  it('returns unique UUIDs', () => {
    const a = generateId()
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
    expect(generateId()).not.toBe(a)
  })
})

describe('toggled', () => {
  it('adds a missing value and removes a present one without mutating', () => {
    const s = new Set(['a'])
    expect([...toggled(s, 'b')]).toEqual(['a', 'b'])
    expect([...toggled(s, 'a')]).toEqual([])
    expect([...s]).toEqual(['a'])
  })
})
