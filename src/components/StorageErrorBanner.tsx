import { useEffect, useState } from 'react'
import { onStorageError } from '../storage'
import { exportData } from '../backup'

function isQuotaError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'QuotaExceededError'
}

/** Shown when a background save fails, so changes are never lost silently. */
export default function StorageErrorBanner() {
  const [failure, setFailure] = useState<{ quota: boolean } | null>(null)

  useEffect(() => onStorageError(error => setFailure({ quota: isQuotaError(error) })), [])

  if (!failure) return null

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-50 max-w-md mx-auto bg-red-950 border-b border-red-800 px-4 pb-3 flex flex-col gap-2"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <p className="text-sm text-red-100">
        {failure.quota
          ? "Couldn't save your latest changes: this device's storage is full."
          : "Couldn't save your latest changes."}{' '}
        They'll be lost when the app closes. Export a backup now to keep them.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => void exportData()}
          className="flex-1 bg-red-700 hover:bg-red-600 rounded-lg py-2 text-sm font-semibold"
        >
          Export data
        </button>
        <button
          onClick={() => setFailure(null)}
          className="flex-1 bg-slate-800 hover:bg-slate-700 rounded-lg py-2 text-sm"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
