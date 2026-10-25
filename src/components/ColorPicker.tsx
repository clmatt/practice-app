import type { Color } from '../types'
import { RATING_COLORS, RATINGS } from '../palette'

export default function ColorPicker({
  value,
  onChange,
}: {
  value: Color | null
  onChange: (c: Color) => void
}) {
  return (
    <div className="flex gap-3">
      {RATINGS.map(({ color, label }) => (
        <button
          key={color}
          type="button"
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
