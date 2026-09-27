import { describe, it, expect } from 'vitest'
import { localDateKey, daysBetweenKeys, formatDateKey } from '../dates'

describe('test environment', () => {
  it('runs in America/Los_Angeles', () => {
    // 01:00Z on May 16 is 6pm PDT on May 15
    expect(new Date('2026-05-16T01:00:00.000Z').getHours()).toBe(18)
  })
})

describe('localDateKey', () => {
  it('uses the local date, not the UTC date', () => {
    expect(localDateKey('2026-05-16T01:00:00.000Z')).toBe('2026-05-15')
  })

  it('accepts a Date', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('pads month and day', () => {
    expect(localDateKey(new Date(2026, 2, 7, 12))).toBe('2026-03-07')
  })
})

describe('daysBetweenKeys', () => {
  it('counts calendar days', () => {
    expect(daysBetweenKeys('2026-05-15', '2026-05-15')).toBe(0)
    expect(daysBetweenKeys('2026-05-15', '2026-05-16')).toBe(1)
    expect(daysBetweenKeys('2026-02-27', '2026-03-02')).toBe(3)
  })

  it('is not thrown off by daylight saving changes', () => {
    // US DST starts 2026-03-08
    expect(daysBetweenKeys('2026-03-07', '2026-03-09')).toBe(2)
  })
})

describe('formatDateKey', () => {
  it('formats a key without shifting the day', () => {
    expect(formatDateKey('2026-05-15', { month: 'long', day: 'numeric', year: 'numeric' })).toBe('May 15, 2026')
  })
})
