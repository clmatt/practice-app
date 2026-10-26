import type { Color } from '../types'
import ColorPicker from './ColorPicker'

interface Props {
  note: string
  onNoteChange: (note: string) => void
  /** Tapping a color rates the item straight away (Undo is offered afterwards). */
  onRate: (color: Color) => void
  /** False for a moment after a new item appears (see useTapGuard). */
  ready: boolean
}

/** An optional note and the three rating buttons — one tap saves. Used by both practice screens. */
export default function RatePanel({ note, onNoteChange, onRate, ready }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={note}
        onChange={e => onNoteChange(e.target.value)}
        placeholder="Add a note (optional)"
        rows={2}
        className="bg-slate-800 rounded-xl px-4 py-3 text-sm w-full outline-hidden resize-none text-slate-100 placeholder:text-slate-500"
      />
      <ColorPicker onChange={onRate} disabled={!ready} />
    </div>
  )
}
