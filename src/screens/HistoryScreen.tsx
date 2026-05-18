import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { getActivities, getItems, getSessionHistory, getLastPracticedByItem, getPracticeCountByItem } from '../storage'
import ColorDot from '../components/ColorDot'
import type { Color } from '../types'

type SortKey = 'name-asc' | 'name-desc' | 'date-oldest' | 'date-newest' | 'practiced-recent' | 'practiced-oldest' | 'color'

const COLOR_ORDER: Record<Color, number> = { red: 0, yellow: 1, green: 2 }

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

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('name-asc')
  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(new Set())
  const [activeColorFilters, setActiveColorFilters] = useState<Set<Color>>(() => {
    const color = searchParams.get('color') as Color | null
    return color ? new Set([color]) : new Set()
  })

  const activity = getActivities().find(a => a.id === activityId)

  useEffect(() => {
    if (!activity) navigate('/')
  }, [activity, navigate])

  if (!activity) return null

  const sessions = getSessionHistory(activityId)
  const allItems = getItems(activityId)
  const lastPracticedAt = getLastPracticedByItem(activityId)
  const practiceCounts = getPracticeCountByItem(activityId)
  const allTags = [...new Set(allItems.flatMap(i => i.tags ?? []))].sort()

  const filteredItems = allItems.filter(item => {
    const searchMatch = searchQuery.trim() === '' || item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    const tagMatch = activeTagFilters.size === 0 || (item.tags ?? []).some(t => activeTagFilters.has(t))
    const colorMatch = activeColorFilters.size === 0 || activeColorFilters.has(item.color)
    return searchMatch && tagMatch && colorMatch
  })

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'name-asc': return a.name.localeCompare(b.name)
      case 'name-desc': return b.name.localeCompare(a.name)
      case 'date-newest': return b.createdAt.localeCompare(a.createdAt)
      case 'date-oldest': return a.createdAt.localeCompare(b.createdAt)
      case 'practiced-recent': {
        const la = lastPracticedAt[a.id] ?? ''
        const lb = lastPracticedAt[b.id] ?? ''
        if (!la && !lb) return 0
        if (!la) return 1
        if (!lb) return -1
        return lb.localeCompare(la)
      }
      case 'practiced-oldest': {
        const la = lastPracticedAt[a.id] ?? ''
        const lb = lastPracticedAt[b.id] ?? ''
        if (!la && !lb) return 0
        if (!la) return -1
        if (!lb) return 1
        return la.localeCompare(lb)
      }
      case 'color': return COLOR_ORDER[a.color] - COLOR_ORDER[b.color]
      default: return 0
    }
  })

  const filtersActive = searchQuery.trim().length > 0 || activeTagFilters.size > 0 || activeColorFilters.size > 0

  function toggleTagFilter(tag: string) {
    setActiveTagFilters(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function toggleColorFilter(color: Color) {
    setActiveColorFilters(prev => {
      const next = new Set(prev)
      if (next.has(color)) next.delete(color)
      else next.add(color)
      return next
    })
  }

  return (
    <div className="p-4 flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Link to={`/activity/${activityId}`} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>

      <h1 className="text-lg font-bold mb-4">{activity.name} History</h1>

      {/* Tab bar */}
      <div className="flex border-b border-slate-800 -mx-4 px-4">
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

      {/* Scrollable tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-4">

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
        allItems.length === 0 ? (
          <p className="text-slate-400 text-sm">No {activity.itemLabel}s yet — start adding some!</p>
        ) : (
          <>
            <input
              type="text"
              placeholder={`Search ${activity.itemLabel}s`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-slate-800 rounded-xl px-4 py-3 outline-none text-sm w-full mb-3"
            />

            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-slate-400 shrink-0">Sort by</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortKey)}
                className="flex-1 bg-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none"
              >
                <option value="name-asc">Name (A–Z)</option>
                <option value="name-desc">Name (Z–A)</option>
                <option value="practiced-recent">Last practiced (recent)</option>
                <option value="practiced-oldest">Last practiced (oldest)</option>
                <option value="date-newest">Date added (newest)</option>
                <option value="date-oldest">Date added (oldest)</option>
                <option value="color">Color</option>
              </select>
            </div>

            <div className="flex gap-2 mb-3">
              {(['red', 'yellow', 'green'] as const).map(color => (
                <button
                  key={color}
                  onClick={() => toggleColorFilter(color)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    activeColorFilters.has(color)
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  <ColorDot color={color} size="sm" />
                  <span className="capitalize">{color}</span>
                </button>
              ))}
            </div>

            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTagFilter(tag)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activeTagFilters.has(tag)
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {filtersActive && (
              <p className="text-slate-500 text-xs mb-3">
                Showing {sortedItems.length} of {allItems.length} {activity.itemLabel}{allItems.length === 1 ? '' : 's'}
              </p>
            )}

            {sortedItems.length === 0 ? (
              <p className="text-slate-400 text-sm">No {activity.itemLabel}s match the current filters.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {sortedItems.map(item => {
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
            )}
          </>
        )
      )}
      </div> {/* end scrollable content */}
    </div>
  )
}
