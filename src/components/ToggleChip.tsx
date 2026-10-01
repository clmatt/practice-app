import type { ReactNode } from 'react'

interface Props {
  selected: boolean
  onClick: () => void
  /** 'md' for the main choice on a screen (Auto Practice setup), 'sm' for filters. */
  size?: 'sm' | 'md'
  children: ReactNode
}

/** A pill-shaped on/off button, used for picking tags and colors. */
export default function ToggleChip({ selected, onClick, size = 'sm', children }: Props) {
  const sizing = size === 'md' ? 'px-4 py-2 text-sm' : 'px-3 py-1 text-xs'
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full font-medium transition-colors ${sizing} ${
        selected ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}
