import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ColorDot from '../components/ColorDot'
import TabBar from '../components/TabBar'
import { getActivities, getItems, getLastPracticedByItem, getPracticeCountByItem } from '../storage'
import { filterAndSortItems, readListView, writeListView, ITEM_SORT_LABELS, type ItemListView, type ItemSort } from '../itemList'
import { formatDateKey, localDateKey } from '../dates'
import type { Activity, Color, Item } from '../types'
import { sortTags } from '../sorting'
import ToggleChip from '../components/ToggleChip'
import TagList from '../components/TagList'

const COLORS: Color[] = ['red', 'yellow', 'green']

function practiceSummary(lastPracticed: string | undefined, count: number): string {
  if (!lastPracticed) return 'Never practiced'
  const date = formatDateKey(localDateKey(lastPracticed), { month: 'long', day: 'numeric' })
  return `Last practiced ${date} · ${count} session${count === 1 ? '' : 's'}`
}

function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export default function ManageItemsScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activity] = useState<Activity | null>(() => getActivities().find(a => a.id === activityId) ?? null)
  const [items] = useState<Item[]>(() => (activityId ? getItems(activityId) : []))
  const [lastPracticedAt] = useState(() => (activityId ? getLastPracticedByItem(activityId) : {}))
  const [practiceCounts] = useState(() => (activityId ? getPracticeCountByItem(activityId) : {}))
  const [showFilters, setShowFilters] = useState(false)
  // Search, sort and filters live in the URL (the dashboard links here with ?color=red),
  // so coming back from an item restores the list exactly as it was.
  const view = readListView(searchParams)
  const { query, sort, colors, tags } = view
  function update(changes: Partial<ItemListView>) {
    setSearchParams(writeListView({ ...view, ...changes }), { replace: true })
  }

  useEffect(() => {
    if (!activity) navigate('/')
  }, [activity, navigate])

  if (!activity) return null

  const label = activity.itemLabel
  const allTags = sortTags(items.flatMap(i => i.tags ?? []))
  const activeFilterCount = colors.size + tags.size
  const shown = filterAndSortItems(items, { query, colors, tags }, sort, lastPracticedAt)

  return (
    <div className="h-full overflow-hidden flex flex-col bg-slate-950 text-slate-100">
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold capitalize">{label}s</h1>
          <button
            onClick={() => navigate(`/activity/${activityId}/manage/add`)}
            className="bg-violet-600 hover:bg-violet-500 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            + Add {label}
          </button>
        </div>

        <input
          type="text"
          placeholder={`Search ${label}s`}
          value={query}
          onChange={e => update({ query: e.target.value })}
          className="bg-slate-800 rounded-xl px-4 py-3 outline-none text-sm w-full mb-3"
        />

        <div className="flex items-center gap-2 mb-3">
          <label htmlFor="item-sort" className="text-xs text-slate-400 shrink-0">Sort by</label>
          <select
            id="item-sort"
            value={sort}
            onChange={e => update({ sort: e.target.value as ItemSort })}
            className="flex-1 min-w-0 bg-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none"
          >
            {(Object.keys(ITEM_SORT_LABELS) as ItemSort[]).map(key => (
              <option key={key} value={key}>{ITEM_SORT_LABELS[key]}</option>
            ))}
          </select>
          <button
            onClick={() => setShowFilters(v => !v)}
            aria-expanded={showFilters}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm ${
              activeFilterCount > 0 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex gap-2">
              {COLORS.map(color => (
                <ToggleChip key={color} selected={colors.has(color)} onClick={() => update({ colors: toggled(colors, color) })}>
                  <ColorDot color={color} size="sm" />
                  <span className="capitalize">{color}</span>
                </ToggleChip>
              ))}
            </div>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <ToggleChip key={tag} selected={tags.has(tag)} onClick={() => update({ tags: toggled(tags, tag) })}>
                    {tag}
                  </ToggleChip>
                ))}
              </div>
            )}
            {activeFilterCount > 0 && (
              <button
                onClick={() => update({ colors: new Set(), tags: new Set() })}
                className="self-start text-xs text-violet-400"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {(activeFilterCount > 0 || query.trim() !== '') && items.length > 0 && (
          <p className="text-slate-500 text-xs mb-3">Showing {shown.length} of {items.length} {label}s</p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8">
        {items.length === 0 ? (
          <p className="text-slate-400 text-sm">No {label}s yet</p>
        ) : shown.length === 0 ? (
          <p className="text-slate-400 text-sm">No {label}s match your search or filters.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map(item => (
              <li key={item.id}>
                <Link
                  to={`/activity/${activityId}/manage/${item.id}`}
                  className="bg-slate-800 rounded-xl px-4 py-3 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-3">
                    <ColorDot color={item.color} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{item.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {practiceSummary(lastPracticedAt[item.id], practiceCounts[item.id] ?? 0)}
                      </div>
                    </div>
                    <span className="text-violet-400 text-sm">›</span>
                  </div>
                  <TagList tags={item.tags} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TabBar activityId={activityId!} activityName={activity.name} />
    </div>
  )
}
