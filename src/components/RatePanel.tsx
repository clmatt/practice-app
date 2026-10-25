import type { Color } from '../types'
import ColorPicker from './ColorPicker'

interface Props {
  value: Color | null
  onChange: (color: Color) => void
  note: string
  onNoteChange: (note: string) => void
  onSave: () => void
  onBack: () => void
}

/** Rating buttons, an optional note, Save and Back — the bottom of both practice screens. */
export default function RatePanel({ value, onChange, note, onNoteChange, onSave, onBack }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <ColorPicker value={value} onChange={onChange} />
      <textarea
        value={note}
        onChange={e => onNoteChange(e.target.value)}
        placeholder="Add a note (optional)"
        rows={2}
        className="bg-slate-800 rounded-xl px-4 py-3 text-sm w-full outline-none resize-none text-slate-100 placeholder:text-slate-500"
      />
      <button
        onClick={onSave}
        disabled={value === null}
        className="bg-violet-600 hover:bg-violet-500 rounded-xl py-4 font-bold text-lg w-full disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Save
      </button>
      <button onClick={onBack} className="bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold w-full">
        Back
      </button>
    </div>
  )
}
