import type { Color } from '../types'

const OPTIONS: { color: Color; label: string; classes: string }[] = [
  { color: 'red',    label: 'Struggled', classes: 'bg-red-500 hover:bg-red-400' },
  { color: 'yellow', label: 'Okay',      classes: 'bg-yellow-500 hover:bg-yellow-400' },
  { color: 'green',  label: 'Solid',     classes: 'bg-green-600 hover:bg-green-500' },
]

export default function ColorPicker({
  value,
  onChange,
}: {
  value: Color | null
  onChange: (c: Color) => void
}) {
  return (
    <div className="flex gap-3">
      {OPTIONS.map(({ color, label, classes }) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`flex-1 py-4 rounded-xl font-semibold text-white text-sm transition-opacity ${classes} ${
            value && value !== color ? 'opacity-40' : 'opacity-100'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
