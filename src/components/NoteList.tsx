import { formatLongDate } from '../dates'

interface Props {
  notes: { practicedAt: string; note: string }[]
  /** Small, scrolling list for the practice screens; roomy cards on the item page. */
  compact?: boolean
}

/** An item's past notes, newest first. Renders nothing when there are none. */
export default function NoteList({ notes, compact = false }: Props) {
  if (notes.length === 0) return null
  return (
    <div className={compact ? 'w-full max-h-36 overflow-y-auto flex flex-col gap-1.5' : 'flex flex-col gap-3'}>
      {notes.map(n => (
        <div key={n.practicedAt} className={compact ? 'bg-slate-800 rounded-lg px-3 py-2' : 'bg-slate-800 rounded-xl px-4 py-3'}>
          <p className={`text-xs text-slate-500 ${compact ? 'mb-0.5' : 'mb-1'}`}>{formatLongDate(n.practicedAt)}</p>
          <p className={`text-sm ${compact ? 'text-slate-300' : 'text-slate-200'}`}>{n.note}</p>
        </div>
      ))}
    </div>
  )
}
