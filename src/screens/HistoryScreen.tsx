import { useEffect } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { getActivities, getItems, getSessionHistory, getLastPracticedByItem, getPracticeCountByItem } from '../storage'
import ColorDot from '../components/ColorDot'

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatShortDate(iso: string): string {
  const dateStr = iso.slice(0, 10)
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export default function HistoryScreen() {
  const { activityId = '' } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = searchParams.get('tab') === 'items' ? 'items' : 'sessions'

  const activity = getActivities().find(a => a.id === activityId)

  useEffect(() => {
    if (!activity) navigate('/')
  }, [activity, navigate])

  if (!activity) return null

  const sessions = getSessionHistory(activityId)
  const items = getItems(activityId).sort((a, b) => a.name.localeCompare(b.name))
  const lastPracticedAt = getLastPracticedByItem(activityId)
  const practiceCounts = getPracticeCountByItem(activityId)

  return (
    <div className="p-4">
      <Link to={`/activity/${activityId}`} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>

      <h1 className="text-lg font-bold mb-4">{activity.name} History</h1>

      {/* Tab bar */}
      <div className="flex border-b border-slate-800 mb-4 -mx-4 px-4">
        <button
          onClick={() => setSearchParams({})}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'sessions'
              ? 'text-violet-400 border-violet-400'
              : 'text-slate-400 border-transparent'
          }`}
        >
          By session
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'items' })}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'items'
              ? 'text-violet-400 border-violet-400'
              : 'text-slate-400 border-transparent'
          }`}
        >
          By item
        </button>
      </div>

      {/* By session */}
      {tab === 'sessions' && (
        sessions.length === 0 ? (
          <p className="text-slate-400 text-sm">No sessions recorded yet — start practicing!</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map(session => (
              <div key={session.date} className="bg-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-semibold text-slate-100">{formatDate(session.date)}</span>
                  <span className="text-slate-400 text-xs">
                    {session.itemCount} {session.itemCount === 1 ? 'item' : 'items'}
                  </span>
                </div>
                {session.changes.length > 0 ? (
                  <div className="flex flex-col gap-1.5 mt-2">
                    {session.changes.map((c) => (
                      <div key={c.itemName} className="flex items-center gap-2 text-sm text-slate-200">
                        <span>{c.itemName}</span>
                        <ColorDot color={c.colorBefore} size="sm" />
                        <span className="text-slate-400">→</span>
                        <ColorDot color={c.colorAfter} size="sm" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm mt-1">No ratings changed</p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* By item */}
      {tab === 'items' && (
        items.length === 0 ? (
          <p className="text-slate-400 text-sm">No {activity.itemLabel}s yet — start adding some!</p>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map(item => {
              const lastDate = lastPracticedAt[item.id]
              const count = practiceCounts[item.id] ?? 0
              const subtitle = lastDate
                ? `Last practiced ${formatShortDate(lastDate)} · ${count} session${count === 1 ? '' : 's'}`
                : `Never practiced · 0 sessions`
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(`/activity/${activityId}/manage/${item.id}`, { state: { from: 'history' } })}
                  className="bg-slate-800 rounded-xl px-4 py-3 flex items-center gap-3 text-left w-full"
                >
                  <ColorDot color={item.color} size="md" />
                  <div className="flex-1">
                    <div className="text-sm text-slate-100">{item.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
                  </div>
                  <span className="text-violet-400 text-sm">›</span>
                </button>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
