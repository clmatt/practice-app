import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getActivities, saveActivity, deleteActivity, getLastPracticedByItem, getLastBackupAt } from '../storage'
import { localDateKey, daysBetweenKeys } from '../dates'
import { generateId } from '../utils'
import { exportData, describeLastBackup } from '../backup'
import type { Activity } from '../types'

function lastPracticedLabel(activityId: string): string {
  const last = getLastPracticedByItem(activityId)
  const dates = Object.values(last)
  if (dates.length === 0) return 'Never practiced'
  const mostRecent = dates.reduce((a, b) => (a > b ? a : b))
  const diffDays = daysBetweenKeys(localDateKey(mostRecent), localDateKey(new Date()))
  if (diffDays === 0) return 'Practiced today'
  if (diffDays === 1) return 'Practiced yesterday'
  return `Practiced ${diffDays} days ago`
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const [activities, setActivities] = useState<Activity[]>(() => getActivities())
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [itemLabel, setItemLabel] = useState('')
  const [lastBackupAt, setLastBackupAt] = useState(() => getLastBackupAt())

  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExport() {
    setExportError(null)
    try {
      if (await exportData()) setLastBackupAt(getLastBackupAt())
    } catch (error) {
      console.error('Export failed', error)
      setExportError(`Couldn't export: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const backup = describeLastBackup(lastBackupAt)

  function handleAdd() {
    if (!name.trim()) return
    const a: Activity = {
      id: generateId(),
      name: name.trim(),
      itemLabel: itemLabel.trim() || 'item',
      weights: { red: 0.6, yellow: 0.3, green: 0.1 },
      createdAt: new Date().toISOString(),
    }
    saveActivity(a)
    setActivities(getActivities())
    setName('')
    setItemLabel('')
    setAdding(false)
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}" and all its items? This cannot be undone.`)) return
    deleteActivity(id)
    setActivities(getActivities())
  }

  return (
    <div className="h-full overflow-hidden flex flex-col bg-slate-950 text-slate-100">
      <div className="shrink-0 px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold">Practice App</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {activities.length === 0 && !adding && (
          <p className="text-slate-400 text-sm mb-4">No activities yet. Add one to get started.</p>
        )}

        <div className="flex flex-col gap-3 mb-6">
          {activities.map(a => (
            <div key={a.id} className="flex items-center bg-slate-800 rounded-xl px-4 py-3">
              <button className="flex-1 text-left" onClick={() => navigate(`/activity/${a.id}`)}>
                <div className="font-semibold">{a.name}</div>
                <div className="text-xs text-slate-400 capitalize">{a.itemLabel}s</div>
                <div className="text-xs text-slate-500 mt-0.5">{lastPracticedLabel(a.id)}</div>
              </button>
              <button
                onClick={() => handleDelete(a.id, a.name)}
                className="text-slate-500 hover:text-red-400 text-sm ml-4"
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        {adding ? (
          <div className="bg-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <input
              autoFocus
              className="bg-slate-700 rounded-lg px-3 py-2 text-sm w-full outline-none"
              placeholder="Activity name (e.g. Juggling)"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <input
              className="bg-slate-700 rounded-lg px-3 py-2 text-sm w-full outline-none"
              placeholder="Item label, singular (e.g. trick, route)"
              value={itemLabel}
              onChange={e => setItemLabel(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 bg-violet-600 hover:bg-violet-500 rounded-lg py-2 text-sm font-semibold"
              >
                Add
              </button>
              <button
                onClick={() => { setAdding(false); setName(''); setItemLabel('') }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold"
          >
            + Add Activity
          </button>
        )}

        <button
          onClick={() => void handleExport()}
          className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 text-center mt-2"
        >
          Export data
        </button>
        {activities.length > 0 && (
          <p className={`text-xs text-center -mt-1 mb-1 ${backup.stale ? 'text-amber-400' : 'text-slate-600'}`}>
            {backup.text}
          </p>
        )}
        {exportError && <p className="text-xs text-center text-red-400 mb-1">{exportError}</p>}
        <button
          onClick={() => navigate('/import')}
          className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 text-center"
        >
          Import data
        </button>
      </div>
    </div>
  )
}
