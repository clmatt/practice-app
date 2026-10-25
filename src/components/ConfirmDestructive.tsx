import { useState } from 'react'
import { exportData } from '../backup'
import { capitalize } from '../labels'

interface Props {
  message: string
  /** The verb for the buttons, e.g. "delete" or "import". */
  action: string
  onConfirm: () => void
  onCancel: () => void
}

/** Asks before something that can't be undone, offering to export a backup first. */
export default function ConfirmDestructive({ message, action, onConfirm, onCancel }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  async function exportThenConfirm() {
    setError(null)
    setExporting(true)
    try {
      // false means the share sheet was cancelled: no backup, so don't go ahead.
      if (await exportData()) onConfirm()
    } catch (e) {
      setError(`Couldn't export: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div role="group" aria-label="Confirm" className="bg-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <p className="text-sm text-slate-200">{message} This can't be undone.</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={() => void exportThenConfirm()}
        disabled={exporting}
        className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold disabled:opacity-40"
      >
        Export backup, then {action}
      </button>
      <button onClick={onConfirm} className="w-full bg-slate-700 hover:bg-slate-600 rounded-xl py-3 text-sm text-red-300">
        {capitalize(action)} without backup
      </button>
      <button onClick={onCancel} className="w-full text-slate-400 text-sm py-2">Cancel</button>
    </div>
  )
}
