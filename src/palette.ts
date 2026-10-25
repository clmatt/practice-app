import type { Color } from './types'

/**
 * The rating colors, used everywhere a rating is shown: dots, the rating
 * buttons, history bars and the chart. Green is emerald rather than a pure
 * green so it stays distinguishable from red and yellow for red-green
 * colour-blind readers (checked with a CVD palette validator against the
 * slate-950 background). Yellow stays a true yellow because it means "okay".
 */
export const RATING_COLORS: Record<Color, string> = {
  red: '#ef4444',
  yellow: '#eab308',
  green: '#059669',
}

export interface Rating {
  color: Color
  /** "Red", for legends and filters. */
  name: string
  /** What the rating means when you give it. */
  label: string
}

/** The ratings in order, worst first. Use this instead of listing the colors by hand. */
export const RATINGS: Rating[] = [
  { color: 'red', name: 'Red', label: 'Struggled' },
  { color: 'yellow', name: 'Yellow', label: 'Okay' },
  { color: 'green', name: 'Green', label: 'Solid' },
]

export const RATING_ORDER: Color[] = RATINGS.map(r => r.color)

export function isColor(value: unknown): value is Color {
  return RATING_ORDER.includes(value as Color)
}

export function ratingName(color: Color): string {
  return RATINGS.find(r => r.color === color)!.name
}
