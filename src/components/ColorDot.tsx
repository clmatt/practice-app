import type { Color } from '../types'
import { RATING_COLORS } from '../palette'

export default function ColorDot({ color, size = 'md' }: { color: Color; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
  return <span className={`inline-block rounded-full flex-shrink-0 ${sizeClass}`} style={{ backgroundColor: RATING_COLORS[color] }} />
}
