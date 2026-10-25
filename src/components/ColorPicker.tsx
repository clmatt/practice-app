import type { Color } from '../types'
import { RATING_COLORS, RATINGS } from '../palette'

/**
 * The three rating buttons. With `value` (Add/Edit) they're a choice that shows
 * what's selected; without it (practice) each tap is a rating.
 */
export default function ColorPicker({
  value,
  onChange,
  disabled = false,
}: {
  value?: Color | null
  onChange: (c: Color) => void
  disabled?: boolean
}) {
  return (
    <div className="flex gap-3">
      {RATINGS.map(({ color, label }) => (
        <button
          key={color}
          type="button"
          aria-pressed={value === undefined ? undefined : value === color}
          disabled={disabled}
          onClick={() => onChange(color)}
          style={{ backgroundColor: RATING_COLORS[color] }}
          className={`flex-1 py-4 rounded-xl font-semibold text-slate-950 text-sm transition-opacity hover:brightness-110 ${
            value && value !== color ? 'opacity-40' : 'opacity-100'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
