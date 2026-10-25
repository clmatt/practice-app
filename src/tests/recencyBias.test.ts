import { describe, it, expect } from 'vitest'
import { describeRecencyBias } from '../recencyBias'

describe('describeRecencyBias', () => {
  it('says how much likelier the longest-ago item is, out of 10', () => {
    expect(describeRecencyBias(0.9)).toBe('Of 10 items of a color, the one you practiced longest ago comes up about 2.6× as often as the one you practiced most recently.')
    expect(describeRecencyBias(0.5)).toBe('Of 10 items of a color, the one you practiced longest ago comes up about 512× as often as the one you practiced most recently.')
  })

  it('caps huge ratios', () => {
    expect(describeRecencyBias(0.2)).toMatch(/over 1,000× as often/)
  })

  it('describes the two ends plainly', () => {
    expect(describeRecencyBias(1)).toBe('All items of a color come up equally often, however recently you practiced them.')
    expect(describeRecencyBias(0)).toBe('Only the item you practiced longest ago comes up (within each color).')
  })

  it('rounds near-uniform values sensibly', () => {
    expect(describeRecencyBias(0.99)).toMatch(/about 1.1× as often/)
  })
})
