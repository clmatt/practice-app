import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getActivities, getSessionHistory } from '../storage'
import ColorDot from '../components/ColorDot'

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function HistoryScreen() {
  const { activityId = '' } = useParams<{ activityId: string }>()
  const navigate = useNavigate()

  const activity = getActivities().find(a => a.id === activityId)

  useEffect(() => {
    if (!activity) navigate('/')
  }, [activity, navigate])

  if (!activity) return null

  const sessions = getSessionHistory(activityId)

  return (
    <div className="p-4">
      <Link to={`/activity/${activityId}`} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>

      <h1 className="text-lg font-bold mb-4">{activity.name} History</h1>

      {sessions.length === 0 ? (
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
      )}
    </div>
  )
}
