import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getActivities, getItems, saveActivity, deleteActivity } from '../storage'
import type { Activity, Item } from '../types'
import ColorDot from '../components/ColorDot'
import TabBar from '../components/TabBar'

export default function ActivityDashboardScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const [activity, setActivity] = useState<Activity | null>(() => getActivities().find(a => a.id === activityId) ?? null)
  const [items] = useState<Item[]>(() => (activityId ? getItems(activityId) : []))
  const [editingSettings, setEditingSettings] = useState(false)
  const [draftName, setDraftName] = useState(() => activity?.name ?? '')
  const [draftLabel, setDraftLabel] = useState(() => activity?.itemLabel ?? '')
  const [draftWeights, setDraftWeights] = useState(() => ({
    red: Math.round((activity?.weights.red ?? 0.6) * 100),
    yellow: Math.round((activity?.weights.yellow ?? 0.3) * 100),
    green: Math.round((activity?.weights.green ?? 0.1) * 100),
  }))
  const [draftRecencyBias, setDraftRecencyBias] = useState(() => activity?.recencyBias ?? 0.9)
  const [draftChooseFilter, setDraftChooseFilter] = useState(() => activity?.chooseFilterEachItem ?? false)

  useEffect(() => {
    if (!activity) navigate('/')
  }, [activity, navigate])

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
      chooseFilterEachItem: draftChooseFilter,
    }
    saveActivity(updated)
    setActivity(updated)
    setEditingSettings(false)
  }

  function handleDeleteActivity() {
    if (!activity) return
    if (!window.confirm(`Delete "${activity.name}" and all its ${activity.itemLabel}s and practice history? This cannot be undone.`)) return
    deleteActivity(activity.id)
    navigate('/', { replace: true })
  }

  if (!activity) return null

  const counts = {
    red: items.filter(i => i.color === 'red').length,
    yellow: items.filter(i => i.color === 'yellow').length,
    green: items.filter(i => i.color === 'green').length,
  }

  if (editingSettings) {
    return (
      <div className="p-4 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
        <button onClick={() => setEditingSettings(false)} className="text-slate-400 text-sm mb-4 block shrink-0">
          ← Cancel
        </button>
        <h2 className="text-xl font-bold mb-4 shrink-0">Activity Settings</h2>
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
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
                    onChange={e => setDraftWeights(w => ({ ...w, [color]: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) }))}
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
            type="button"
            role="switch"
            aria-checked={draftChooseFilter}
            onClick={() => setDraftChooseFilter(v => !v)}
            className="flex items-center gap-3 w-full bg-slate-800 rounded-xl px-4 py-3 text-left"
          >
            <span className="flex-1">
              <span className="block text-sm">Choose filter before each item</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Auto Practice asks which tags to draw from after every rating (e.g. raising the grade as you go)
              </span>
            </span>
            <span className={`w-10 h-6 rounded-full p-0.5 shrink-0 transition-colors ${draftChooseFilter ? 'bg-violet-600' : 'bg-slate-600'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${draftChooseFilter ? 'translate-x-4' : ''}`} />
            </span>
          </button>
          <button
            onClick={handleSaveSettings}
            className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold"
          >
            Save Settings
          </button>
          <button
            onClick={handleDeleteActivity}
            className="mt-6 mb-2 text-red-400 text-sm font-medium py-2 w-full text-center"
          >
            Delete activity
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="px-4 pt-4 flex flex-col flex-1 min-h-0">
        <div className="flex items-start justify-between mb-1 shrink-0">
          <h1 className="text-2xl font-bold">{activity.name}</h1>
          <button
            onClick={() => setEditingSettings(true)}
            className="text-xs text-slate-500 hover:text-slate-300 mt-1"
          >
            Settings
          </button>
        </div>
        <p className="text-slate-400 text-sm mb-6 capitalize shrink-0">{activity.itemLabel}s</p>

        <div className="flex gap-3 shrink-0 mb-4">
          {(['red', 'yellow', 'green'] as const).map(color => (
            <Link
              key={color}
              to={`/activity/${activityId}/manage?color=${color}`}
              className="flex-1 bg-slate-800 rounded-xl p-3 text-center"
            >
              <ColorDot color={color} />
              <div className="text-2xl font-bold mt-1">{counts[color]}</div>
              <div className="text-xs text-slate-400 capitalize mt-0.5">{color}</div>
            </Link>
          ))}
        </div>

        <div className="flex-1 min-h-0" />
      </div>

      <TabBar activityId={activityId!} activityName={activity.name} />
    </div>
  )
}
