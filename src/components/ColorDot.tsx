import type { Color } from '../types'

const BG: Record<Color, string> = {
  red: 'bg-red-500',
  yellow: 'bg-yellow-400',
  green: 'bg-green-500',
}

export default function ColorDot({ color, size = 'md' }: { color: Color; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
  return <span className={`inline-block rounded-full flex-shrink-0 ${BG[color]} ${sizeClass}`} />
}
