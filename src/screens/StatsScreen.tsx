import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  getActivities, getItems, getSessionHistory, getColorDistributionByDay, getPracticeCountByItem,
} from '../storage'
import { formatDateKey } from '../dates'
import ColorDot from '../components/ColorDot'
import TabBar from '../components/TabBar'

function formatDate(dateKey: string): string {
  return formatDateKey(dateKey, { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function StatsScreen() {
  const { activityId = '' } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get('tab')
  const tab = tabParam === 'sessions' ? 'sessions' : 'general'

  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const activity = useMemo(() => getActivities().find(a => a.id === activityId), [activityId])

  useEffect(() => {
    if (!activity) navigate('/')
  }, [activity, navigate])

  // Stats never change while this screen is open, so compute once per activity.
  const data = useMemo(() => {
    const allItems = getItems(activityId)
    const practiceCounts = getPracticeCountByItem(activityId)
    return {
      allItems,
      sessions: getSessionHistory(activityId),
      chartData: getColorDistributionByDay(activityId),
      practiceCounts,
      totalReps: Object.values(practiceCounts).reduce((sum, n) => sum + n, 0),
    }
  }, [activityId])

  if (!activity) return null

  const { allItems, sessions, chartData, totalReps } = data

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="px-4 pt-4 flex flex-col flex-1 min-h-0 overflow-hidden">
      <h1 className="text-lg font-bold mb-4 shrink-0">{activity.name} Stats</h1>

      {/* Tab bar */}
      <div className="flex border-b border-slate-800 -mx-4 px-4 shrink-0">
        <button
          onClick={() => setSearchParams({})}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'general' ? 'text-violet-400 border-violet-400' : 'text-slate-400 border-transparent'
          }`}
        >
          General
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'sessions' })}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'sessions' ? 'text-violet-400 border-violet-400' : 'text-slate-400 border-transparent'
          }`}
        >
          By session
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-4">

        {/* General */}
        {tab === 'general' && (
          <div className="flex flex-col gap-6">
            <div className="flex gap-3">
              <div className="flex-1 bg-slate-800 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{sessions.length}</div>
                <div className="text-xs text-slate-400 mt-0.5">Sessions</div>
              </div>
              <div className="flex-1 bg-slate-800 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{totalReps}</div>
                <div className="text-xs text-slate-400 mt-0.5">Total reps</div>
              </div>
              <div className="flex-1 bg-slate-800 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{allItems.length}</div>
                <div className="text-xs text-slate-400 mt-0.5">Total {activity.itemLabel}s</div>
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3">Color Distribution</h2>
              {chartData.length === 0 ? (
                <p className="text-slate-400 text-sm">No practice data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <CartesianGrid stroke="#334155" />
                    <XAxis dataKey="date" tickFormatter={(val: string) => val.slice(5)} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="red" stackId="a" stroke="#ef4444" fill="#ef4444" />
                    <Area type="monotone" dataKey="yellow" stackId="a" stroke="#eab308" fill="#eab308" />
                    <Area type="monotone" dataKey="green" stackId="a" stroke="#22c55e" fill="#22c55e" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* By session */}
        {tab === 'sessions' && (
          sessions.length === 0 ? (
            <p className="text-slate-400 text-sm">No sessions recorded yet — start practicing!</p>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map(session => {
                const expanded = expandedSessions.has(session.date)
                return (
                  <button
                    key={session.date}
                    onClick={() => setExpandedSessions(prev => {
                      const next = new Set(prev)
                      if (next.has(session.date)) next.delete(session.date)
                      else next.add(session.date)
                      return next
                    })}
                    className="bg-slate-800 rounded-xl p-4 text-left w-full"
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-semibold text-slate-100">{formatDate(session.date)}</span>
                      <span className="text-slate-400 text-xs">
                        {session.itemCount} {session.itemCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    {expanded ? (
                      <div className="flex flex-col gap-1.5 mt-2">
                        {session.allPracticed.map((p) => (
                          <div key={p.itemName} className="flex items-center gap-2 text-sm text-slate-200">
                            <span className="flex-1">{p.itemName}</span>
                            {p.colorBefore !== p.colorAfter ? (
                              <>
                                <ColorDot color={p.colorBefore} size="sm" />
                                <span className="text-slate-400">→</span>
                                <ColorDot color={p.colorAfter} size="sm" />
                              </>
                            ) : (
                              <ColorDot color={p.colorAfter} size="sm" />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      session.changes.length > 0 ? (
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
                      )
                    )}
                  </button>
                )
              })}
            </div>
          )
        )}

      </div>
      </div>

      <TabBar activityId={activityId} activityName={activity.name} />
    </div>
  )
}
