import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ColorDot from '../components/ColorDot'
import { getActivities, getItems, deleteItem, getLastPracticedByItem } from '../storage'
import type { Activity, Item, Color } from '../types'

type SortKey = 'date-oldest' | 'date-newest' | 'name-asc' | 'name-desc' | 'practiced-recent' | 'practiced-oldest' | 'color'

const COLOR_ORDER: Record<Color, number> = { red: 0, yellow: 1, green: 2 }

export default function ManageItemsScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [activity, setActivity] = useState<Activity | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('date-oldest')
  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(new Set())
  const [activeColorFilters, setActiveColorFilters] = useState<Set<Color>>(() => {
    const color = searchParams.get('color') as Color | null
    return color ? new Set([color]) : new Set()
  })

  useEffect(() => {
    const found = getActivities().find(a => a.id === activityId)
    if (!found) {
      navigate('/')
      return
    }
    setActivity(found)
    setItems(getItems(activityId!))
  }, [activityId, navigate])

  function handleDelete(itemId: string, itemName: string) {
    if (!window.confirm(`Delete "${itemName}"? This cannot be undone.`)) return
    deleteItem(itemId)
    setItems(getItems(activityId!))
  }

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

  if (!activity) return null

  const label = activity.itemLabel
  const allTags = [...new Set(items.flatMap(i => i.tags ?? []))].sort()
  const filtersActive = searchQuery.trim().length > 0 || activeTagFilters.size > 0 || activeColorFilters.size > 0
  const lastPracticedAt = getLastPracticedByItem(activityId!)

  const filteredItems = items.filter(item => {
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

  return (
    <div className="p-4 bg-slate-950 text-slate-100 min-h-screen">
      <Link to={`/activity/${activityId}`} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>

      <h1 className="text-xl font-bold mb-4">
        Manage {label}s
      </h1>

      {/* Search */}
      <input
        type="text"
        placeholder={`Search ${label}s`}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="bg-slate-800 rounded-xl px-4 py-3 outline-none text-sm w-full mb-3"
      />

      {/* Sort */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-slate-400 shrink-0">Sort by</span>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortKey)}
          className="flex-1 bg-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none"
        >
          <option value="date-oldest">Date added (oldest)</option>
          <option value="date-newest">Date added (newest)</option>
          <option value="name-asc">Name (A–Z)</option>
          <option value="name-desc">Name (Z–A)</option>
          <option value="practiced-recent">Last practiced (recent)</option>
          <option value="practiced-oldest">Last practiced (oldest)</option>
          <option value="color">Color</option>
        </select>
      </div>

      {/* Color filter chips — always shown */}
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

      {/* Tag filter chips — only shown if any items have tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
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

      {/* Count label when filters are active */}
      {filtersActive && items.length > 0 && (
        <p className="text-slate-500 text-xs mb-3">
          Showing {sortedItems.length} of {items.length} {label}{items.length === 1 ? '' : 's'}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-slate-400 text-sm mb-6">No {label}s yet</p>
      ) : sortedItems.length === 0 ? (
        <p className="text-slate-400 text-sm mb-6">No {label}s match the current filters.</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-6">
          {sortedItems.map(item => (
            <li key={item.id} className="bg-slate-800 rounded-xl px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <ColorDot color={item.color} size="md" />
                <span className="flex-1 text-sm">{item.name}</span>
                <Link
                  to={`/activity/${activityId}/manage/${item.id}/edit`}
                  className="text-violet-400 text-sm hover:text-violet-300"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(item.id, item.name)}
                  className="text-red-400 text-sm hover:text-red-300"
                >
                  Delete
                </button>
              </div>
              {(item.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(item.tags ?? []).map(tag => (
                    <span key={tag} className="bg-slate-700 rounded-full px-2 py-0.5 text-xs text-slate-300">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => navigate(`/activity/${activityId}/manage/add`)}
        className="bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold w-full"
      >
        Add {label}
      </button>
    </div>
  )
}
