import { describe, it, expect } from 'vitest'
import { RATINGS, RATING_ORDER, isColor, ratingName } from '../palette'

describe('ratings', () => {
  it('lists the ratings worst first with their names and labels', () => {
    expect(RATING_ORDER).toEqual(['red', 'yellow', 'green'])
    expect(RATINGS.map(r => r.label)).toEqual(['Struggled', 'Okay', 'Solid'])
    expect(ratingName('yellow')).toBe('Yellow')
  })

  it('recognises rating colours', () => {
    expect(isColor('green')).toBe(true)
    expect(isColor('blue')).toBe(false)
    expect(isColor(undefined)).toBe(false)
  })
})
