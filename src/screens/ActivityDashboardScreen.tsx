import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getActivities, getItems, saveActivity } from '../storage'
import type { Activity, Item } from '../types'
import ColorDot from '../components/ColorDot'

export default function ActivityDashboardScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [editingSettings, setEditingSettings] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftLabel, setDraftLabel] = useState('')
  const [draftWeights, setDraftWeights] = useState({ red: 60, yellow: 30, green: 10 })
  const [draftRecencyBias, setDraftRecencyBias] = useState(0.9)

  useEffect(() => {
    if (!activityId) { navigate('/'); return }
    const a = getActivities().find(a => a.id === activityId)
    if (!a) { navigate('/'); return }
    setActivity(a)
    setItems(getItems(activityId))
    setDraftName(a.name)
    setDraftLabel(a.itemLabel)
    setDraftWeights({
      red: Math.round(a.weights.red * 100),
      yellow: Math.round(a.weights.yellow * 100),
      green: Math.round(a.weights.green * 100),
    })
    setDraftRecencyBias(a.recencyBias ?? 0.9)
  }, [activityId, navigate])

  function handleSaveSettings() {
    if (!activity) return
    const total = draftWeights.red + draftWeights.yellow + draftWeights.green
    if (total === 0) return
    const updated: Activity = {
      ...activity,
      name: draftName.trim() || activity.name,
      itemLabel: draftLabel.trim() || activity.itemLabel,
      weights: {
        red: draftWeights.red / total,
        yellow: draftWeights.yellow / total,
        green: draftWeights.green / total,
      },
      recencyBias: draftRecencyBias,
    }
    saveActivity(updated)
    setActivity(updated)
    setEditingSettings(false)
  }

  if (!activity) return null

  const counts = {
    red: items.filter(i => i.color === 'red').length,
    yellow: items.filter(i => i.color === 'yellow').length,
    green: items.filter(i => i.color === 'green').length,
  }

  if (editingSettings) {
    return (
      <div className="p-4">
        <button onClick={() => setEditingSettings(false)} className="text-slate-400 text-sm mb-4 block">
          ← Cancel
        </button>
        <h2 className="text-xl font-bold mb-4">Activity Settings</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Name</label>
            <input
              className="w-full bg-slate-800 rounded-xl px-4 py-3 outline-none text-sm"
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Item label</label>
            <input
              className="w-full bg-slate-800 rounded-xl px-4 py-3 outline-none text-sm"
              placeholder="e.g. trick, route, exercise"
              value={draftLabel}
              onChange={e => setDraftLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide mb-2 block">
              Selection weights (must add to 100)
            </label>
            <div className="flex flex-col gap-2">
              {(['red', 'yellow', 'green'] as const).map(color => (
                <div key={color} className="flex items-center gap-3">
                  <ColorDot color={color} />
                  <span className="text-sm capitalize w-14">{color}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="bg-slate-800 rounded-lg px-3 py-2 text-sm w-20 outline-none"
                    value={draftWeights[color]}
                    onChange={e => setDraftWeights(w => ({ ...w, [color]: Number(e.target.value) }))}
                  />
                  <span className="text-slate-400 text-sm">%</span>
                </div>
              ))}
              <p className="text-xs text-slate-500">
                Total: {draftWeights.red + draftWeights.yellow + draftWeights.green}% (auto-normalised on save)
              </p>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide mb-2 block">
              Recency bias
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={draftRecencyBias}
                onChange={e => setDraftRecencyBias(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-slate-300 w-12 text-right">
                {draftRecencyBias.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              1 = uniform, lower = prefer items practiced longest ago
            </p>
          </div>
          <button
            onClick={handleSaveSettings}
            className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold"
          >
            Save Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <button onClick={() => navigate('/')} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </button>

      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold">{activity.name}</h1>
        <button
          onClick={() => setEditingSettings(true)}
          className="text-xs text-slate-500 hover:text-slate-300 mt-1"
        >
          Settings
        </button>
      </div>
      <p className="text-slate-400 text-sm mb-6 capitalize">{activity.itemLabel}s</p>

      <div className="flex gap-3 mb-8">
        {(['red', 'yellow', 'green'] as const).map(color => (
          <Link
            key={color}
            to={`/activity/${activityId}/history?tab=items&color=${color}`}
            className="flex-1 bg-slate-800 rounded-xl p-3 text-center"
          >
            <ColorDot color={color} />
            <div className="text-2xl font-bold mt-1">{counts[color]}</div>
            <div className="text-xs text-slate-400 capitalize mt-0.5">{color}</div>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => navigate(`/activity/${activityId}/practice`)}
          className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-4 font-bold text-lg"
          disabled={items.length === 0}
        >
          Start Practice
        </button>
        {items.length === 0 && (
          <p className="text-center text-xs text-slate-500">Add some {activity.itemLabel}s first</p>
        )}
        <button
          onClick={() => navigate(`/activity/${activityId}/stats`)}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold"
        >
          Stats
        </button>
        <button
          onClick={() => navigate(`/activity/${activityId}/history`)}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold"
        >
          History
        </button>
        <button
          onClick={() => navigate(`/activity/${activityId}/manage`)}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold capitalize"
        >
          Manage {activity.itemLabel}s
        </button>
      </div>
    </div>
  )
}
