import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getActivities, saveActivity, deleteActivity } from '../storage'
import { generateId } from '../utils'
import type { Activity } from '../types'

export default function HomeScreen() {
  const navigate = useNavigate()
  const [activities, setActivities] = useState<Activity[]>([])
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [itemLabel, setItemLabel] = useState('')

  useEffect(() => { setActivities(getActivities()) }, [])

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
    setItemLabel('item')
    setAdding(false)
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}" and all its items? This cannot be undone.`)) return
    deleteActivity(id)
    setActivities(getActivities())
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Practice App</h1>

      {activities.length === 0 && !adding && (
        <p className="text-slate-400 text-sm mb-4">No activities yet. Add one to get started.</p>
      )}

      <div className="flex flex-col gap-3 mb-6">
        {activities.map(a => (
          <div key={a.id} className="flex items-center bg-slate-800 rounded-xl px-4 py-3">
            <button className="flex-1 text-left" onClick={() => navigate(`/activity/${a.id}`)}>
              <div className="font-semibold">{a.name}</div>
              <div className="text-xs text-slate-400 capitalize">{a.itemLabel}s</div>
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
            placeholder="What to call each item (e.g. trick, route)"
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
    </div>
  )
}
