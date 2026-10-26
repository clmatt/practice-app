import type { Color } from '../types'
import { RATING_COLORS, ratingName } from '../palette'

/**
 * A rating color as a dot. Named for screen readers ("Red") so color isn't the
 * only signal; pass `decorative` when the color is already written next to it.
 */
export default function ColorDot({ color, size = 'md', decorative = false }: { color: Color; size?: 'sm' | 'md'; decorative?: boolean }) {
  const sizeClass = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
  return (
    <span
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': ratingName(color) })}
      className={`inline-block rounded-full shrink-0 ${sizeClass}`}
      style={{ backgroundColor: RATING_COLORS[color] }}
    />
  )
}
