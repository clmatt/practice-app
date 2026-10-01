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

/** The page background (Tailwind slate-950); used for the gaps between chart bands. */
export const SURFACE = '#020617'
