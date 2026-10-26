import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RECENCY_BIAS, DEFAULT_WORK_BIAS, DEFAULT_RATING_MEMORY,
  describeRecencyBias, describeWorkBias, describeRatingMemory,
} from '../drawSettings'

describe('defaults', () => {
  it('are recency 0.9, work bias 4 and a rating memory of 3 reps', () => {
    expect([DEFAULT_RECENCY_BIAS, DEFAULT_WORK_BIAS, DEFAULT_RATING_MEMORY]).toEqual([0.9, 4, 3])
  })
})

describe('describeRecencyBias', () => {
  it('compares the longest-ago and most recent of 10 items at a single draw', () => {
    expect(describeRecencyBias(0.9)).toBe('Of 10 items of a color, the one you practiced longest ago is about 2.6× as likely to be picked as the one you practiced most recently.')
    expect(describeRecencyBias(0.5)).toMatch(/about 512× as likely/)
    expect(describeRecencyBias(0.2)).toMatch(/over 1,000× as likely/)
    expect(describeRecencyBias(0.99)).toMatch(/about 1\.1× as likely/)
  })

  it('describes the two ends plainly', () => {
    expect(describeRecencyBias(1)).toBe('All items of a color are equally likely to be picked, however recently you practiced them.')
    expect(describeRecencyBias(0)).toBe('Only the item you practiced longest ago is picked (within each color).')
  })
})

describe('describeWorkBias', () => {
  it('compares items needing the most and least work, practiced equally recently', () => {
    expect(describeWorkBias(4)).toBe('Within a color, items whose recent ratings were red are up to 5× as likely to be picked as items whose recent ratings were all green, if practiced equally recently.')
    expect(describeWorkBias(2.5)).toMatch(/up to 3\.5× as likely/)
  })

  it('says when it is off', () => {
    expect(describeWorkBias(0)).toBe('Off: within a color, items are picked by recency alone.')
  })
})

describe('describeRatingMemory', () => {
  it('says how fast old ratings fade, in reps', () => {
    expect(describeRatingMemory(3)).toBe('A rating from 3 reps ago counts half as much as your latest one; from 6 reps ago, a quarter.')
    expect(describeRatingMemory(1)).toBe('A rating from 1 rep ago counts half as much as your latest one; from 2 reps ago, a quarter.')
  })
})
