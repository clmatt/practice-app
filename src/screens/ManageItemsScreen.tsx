import { useState } from 'react'
import { useActivity } from '../useActivity'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ColorDot from '../components/ColorDot'
import TabBar from '../components/TabBar'
import { getItems, getLastPracticedByItem, getPracticeCountByItem } from '../storage'
import { filterAndSortItems, readListView, writeListView, ITEM_SORT_LABELS, type ItemListView, type ItemSort } from '../itemList'
import { formatDateKey, localDateKey } from '../dates'
import type { Item } from '../types'
import { sortTags } from '../sorting'
import ToggleChip from '../components/ToggleChip'
import TagList from '../components/TagList'
import { RATING_ORDER } from '../palette'
import { toggled } from '../utils'
import { pluralLabel } from '../labels'

function practiceSummary(lastPracticed: string | undefined, count: number): string {
  if (!lastPracticed) return 'Never practiced'
  const date = formatDateKey(localDateKey(lastPracticed), { month: 'long', day: 'numeric' })
  return `Last practiced ${date} · ${count} rep${count === 1 ? '' : 's'}`
}

export default function ManageItemsScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activity] = useActivity()
  const [items] = useState<Item[]>(() => (activityId ? getItems(activityId) : []))
  const [lastPracticedAt] = useState(() => (activityId ? getLastPracticedByItem(activityId) : {}))
  const [practiceCounts] = useState(() => (activityId ? getPracticeCountByItem(activityId) : {}))
  const [showFilters, setShowFilters] = useState(false)
  // Search, sort and filters live in the URL (the dashboard links here with ?color=red),
  // so coming back from an item restores the list exactly as it was.
  const view = readListView(searchParams)
  const { query, sort, colors, tags, archived } = view
  function update(changes: Partial<ItemListView>) {
    setSearchParams(writeListView({ ...view, ...changes }), { replace: true })
  }

  if (!activity) return null

  const label = activity.itemLabel
  const plural = pluralLabel(activity)
  // The items this view draws from: archived ones only in the Archived view, otherwise the rest.
  const pool = items.filter(i => Boolean(i.archivedAt) === archived)
  const allTags = sortTags(pool.flatMap(i => i.tags ?? []))
  const activeFilterCount = colors.size + tags.size + (archived ? 1 : 0)
  const shown = filterAndSortItems(items, { query, colors, tags, archived }, sort, lastPracticedAt)

  return (
    <div className="h-full overflow-hidden flex flex-col bg-slate-950 text-slate-100">
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold capitalize">{plural}</h1>
          <button
            onClick={() => navigate(`/activity/${activityId}/manage/add`)}
            className="bg-violet-600 hover:bg-violet-500 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            + Add {label}
          </button>
        </div>

        <input
          type="text"
          placeholder={`Search ${plural}`}
          value={query}
          onChange={e => update({ query: e.target.value })}
          className="bg-slate-800 rounded-xl px-4 py-3 outline-hidden text-sm w-full mb-3"
        />

        <div className="flex items-center gap-2 mb-3">
          <label htmlFor="item-sort" className="text-xs text-slate-400 shrink-0">Sort by</label>
          <select
            id="item-sort"
            value={sort}
            onChange={e => update({ sort: e.target.value as ItemSort })}
            className="flex-1 min-w-0 bg-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 outline-hidden"
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
              {RATING_ORDER.map(color => (
                <ToggleChip key={color} selected={colors.has(color)} onClick={() => update({ colors: toggled(colors, color) })}>
                  <ColorDot color={color} size="sm" decorative />
                  <span className="capitalize">{color}</span>
                </ToggleChip>
              ))}
              <ToggleChip selected={archived} onClick={() => update({ archived: !archived })}>
                Archived
              </ToggleChip>
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
                onClick={() => update({ colors: new Set(), tags: new Set(), archived: false })}
                className="self-start text-xs text-violet-400"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {(activeFilterCount > 0 || query.trim() !== '') && items.length > 0 && (
          <p className="text-slate-500 text-xs mb-3">Showing {shown.length} of {pool.length} {archived ? `archived ${plural}` : plural}</p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8">
        {items.length === 0 ? (
          <p className="text-slate-400 text-sm">No {plural} yet</p>
        ) : shown.length === 0 ? (
          <p className="text-slate-400 text-sm">No {plural} match your search or filters.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map(item => (
              <li key={item.id}>
                <Link
                  to={`/activity/${activityId}/manage/${item.id}`}
                  className={`bg-slate-800 rounded-xl px-4 py-3 flex flex-col gap-2 ${item.archivedAt ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <ColorDot color={item.color} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        {item.name}
                        {item.archivedAt && <span className="text-xs text-slate-500 ml-2">Archived</span>}
                      </div>
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
