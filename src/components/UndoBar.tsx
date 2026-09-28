import { useEffect } from 'react'

const UNDO_WINDOW_MS = 6000

interface Props {
  message: string
  onUndo: () => void
  /** Called when the undo window closes without Undo being tapped. */
  onExpire: () => void
}

/** Briefly offers to undo the last action. Remount it (via `key`) to restart the timer. */
export default function UndoBar({ message, onUndo, onExpire }: Props) {
  useEffect(() => {
    const timer = setTimeout(onExpire, UNDO_WINDOW_MS)
    return () => clearTimeout(timer)
  }, [onExpire])

  return (
    <div role="status" className="shrink-0 flex items-center justify-between gap-3 bg-slate-800 rounded-xl px-4 py-2 mb-3">
      <span className="text-sm text-slate-300 truncate">{message}</span>
      <button onClick={onUndo} className="text-sm font-semibold text-violet-400 shrink-0">
        Undo
      </button>
    </div>
  )
}
