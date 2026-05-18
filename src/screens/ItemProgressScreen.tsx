import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getActivities, getItems, getLogs } from '../storage'
import type { Color, PracticeLog } from '../types'

interface Run {
  color: Color
  count: number
  startDate: string
  endDate: string
}

export function buildRuns(logs: PracticeLog[]): Run[] {
  const sorted = [...logs].sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
  const runs: Run[] = []
  for (const log of sorted) {
    const date = log.practicedAt.slice(0, 10)
    const last = runs[runs.length - 1]
    if (last && last.color === log.colorAfter) {
      last.count++
      last.endDate = date
    } else {
      runs.push({ color: log.colorAfter, count: 1, startDate: date, endDate: date })
    }
  }
  return runs
}

const BAR_COLOR: Record<Color, string> = {
  red: '#dc2626',
  yellow: '#eab308',
  green: '#22c55e',
}

const TEXT_CLASS: Record<Color, string> = {
  red: 'text-red-400',
  yellow: 'text-yellow-400',
  green: 'text-green-400',
}

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}

export default function ItemProgressScreen() {
  const { activityId, itemId } = useParams<{ activityId: string; itemId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const backTo = location.state?.from === 'history'
    ? `/activity/${activityId}/stats?tab=items`
    : `/activity/${activityId}/manage`

  const activity = getActivities().find(a => a.id === activityId)
  const item = activity ? getItems(activityId!).find(i => i.id === itemId) : undefined

  useEffect(() => {
    if (!activity || !item) navigate('/')
  }, [activity, item, navigate])

  if (!activity || !item) return null

  const logs = getLogs().filter(l => l.itemId === itemId)
  const runs = buildRuns(logs)
  const totalSessions = logs.length

  return (
    <div className="p-4 bg-slate-950 text-slate-100 min-h-screen">
      <Link to={backTo} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>

      <h1 className="text-xl font-bold mb-1">{item.name}</h1>
      <p className="text-slate-400 text-sm mb-6">
        <span style={{ color: BAR_COLOR[item.color] }}>●</span>{' '}
        Currently {item.color}
        {totalSessions > 0 && ` · ${totalSessions} session${totalSessions === 1 ? '' : 's'} total`}
      </p>

      {runs.length === 0 ? (
        <p className="text-slate-400 text-sm">No practice sessions recorded yet.</p>
      ) : (
        <div className="flex gap-4">
          {/* Vertical color bar */}
          <div className="flex flex-col w-3 rounded-full overflow-hidden flex-shrink-0">
            {runs.map((run, i) => (
              <div
                key={i}
                style={{
                  height: `${run.count * 48}px`,
                  backgroundColor: BAR_COLOR[run.color],
                  boxShadow: i === runs.length - 1 ? `0 0 8px ${BAR_COLOR[run.color]}88` : undefined,
                }}
              />
            ))}
          </div>

          {/* Run labels */}
          <div className="flex flex-col flex-1">
            {runs.map((run, i) => {
              const isCurrent = i === runs.length - 1
              return (
                <div
                  key={i}
                  className="flex flex-col justify-center"
                  style={{ height: `${run.count * 48}px` }}
                >
                  <span className={`text-sm font-semibold ${TEXT_CLASS[run.color]}`}>
                    {run.color.charAt(0).toUpperCase() + run.color.slice(1)}
                    {isCurrent && <span className="text-slate-500 font-normal"> · current</span>}
                  </span>
                  <span className="text-xs text-slate-500">
                    {run.count} session{run.count === 1 ? '' : 's'} · {formatDateRange(run.startDate, run.endDate)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
