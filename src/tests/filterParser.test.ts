import { describe, it, expect } from 'vitest'
import { parseFilter, evaluateFilter } from '../filterParser'
import type { FilterNode } from '../filterParser'

describe('parseFilter', () => {
  it('parses a single quoted tag', () => {
    const result = parseFilter('"good"')
    expect(result).toEqual({ type: 'tag', value: 'good' })
  })

  it('parses AND of two tags', () => {
    const result = parseFilter('"good" && "V2"')
    expect(result).toEqual({
      type: 'and',
      left: { type: 'tag', value: 'good' },
      right: { type: 'tag', value: 'V2' },
    })
  })

  it('parses OR of two tags', () => {
    const result = parseFilter('"V2" || "V3"')
    expect(result).toEqual({
      type: 'or',
      left: { type: 'tag', value: 'V2' },
      right: { type: 'tag', value: 'V3' },
    })
  })

  it('parses NOT of a tag', () => {
    const result = parseFilter('!"bad"')
    expect(result).toEqual({
      type: 'not',
      operand: { type: 'tag', value: 'bad' },
    })
  })

  it('parses complex grouped expression', () => {
    const result = parseFilter('"good" && ("V2" || "V3" || "V4")')
    expect(typeof result).not.toBe('string')
    expect((result as FilterNode).type).toBe('and')
  })

  it('returns error string for empty expression', () => {
    expect(typeof parseFilter('')).toBe('string')
    expect(typeof parseFilter('   ')).toBe('string')
  })

  it('returns error string for unterminated string literal', () => {
    expect(typeof parseFilter('"good')).toBe('string')
  })

  it('returns error string for unexpected character', () => {
    expect(typeof parseFilter('"good" & "V2"')).toBe('string')
  })

  it('returns error string for unmatched open paren', () => {
    expect(typeof parseFilter('("good" && "V2"')).toBe('string')
  })

  it('returns error string for trailing content', () => {
    expect(typeof parseFilter('"good" "V2"')).toBe('string')
  })
})

describe('evaluateFilter', () => {
  it('matches a single tag present in the list', () => {
    const ast = parseFilter('"good"') as FilterNode
    expect(evaluateFilter(ast, ['good', 'V2'])).toBe(true)
    expect(evaluateFilter(ast, ['V2'])).toBe(false)
    expect(evaluateFilter(ast, [])).toBe(false)
  })

  it('AND requires both tags present', () => {
    const ast = parseFilter('"good" && "V2"') as FilterNode
    expect(evaluateFilter(ast, ['good', 'V2'])).toBe(true)
    expect(evaluateFilter(ast, ['good'])).toBe(false)
    expect(evaluateFilter(ast, ['V2'])).toBe(false)
  })

  it('OR requires at least one tag present', () => {
    const ast = parseFilter('"V2" || "V3"') as FilterNode
    expect(evaluateFilter(ast, ['V2'])).toBe(true)
    expect(evaluateFilter(ast, ['V3'])).toBe(true)
    expect(evaluateFilter(ast, ['V2', 'V3'])).toBe(true)
    expect(evaluateFilter(ast, ['V4'])).toBe(false)
  })

  it('NOT inverts the match', () => {
    const ast = parseFilter('!"bad"') as FilterNode
    expect(evaluateFilter(ast, ['good'])).toBe(true)
    expect(evaluateFilter(ast, ['bad'])).toBe(false)
    expect(evaluateFilter(ast, [])).toBe(true)
  })

  it('complex: "good" && ("V2" || "V3" || "V4")', () => {
    const ast = parseFilter('"good" && ("V2" || "V3" || "V4")') as FilterNode
    expect(evaluateFilter(ast, ['good', 'V2'])).toBe(true)
    expect(evaluateFilter(ast, ['good', 'V3'])).toBe(true)
    expect(evaluateFilter(ast, ['good', 'V4'])).toBe(true)
    expect(evaluateFilter(ast, ['good', 'V5'])).toBe(false)
    expect(evaluateFilter(ast, ['V2'])).toBe(false)
  })

  it('tag matching is case-sensitive', () => {
    const ast = parseFilter('"Good"') as FilterNode
    expect(evaluateFilter(ast, ['Good'])).toBe(true)
    expect(evaluateFilter(ast, ['good'])).toBe(false)
  })
})
