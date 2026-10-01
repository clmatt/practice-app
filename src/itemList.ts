import type { Color, Item } from './types'
import { compareNatural, sortTags } from './sorting'

/** Search, filter and sort for the Items list. */

export type ItemSort =
  | 'name-asc' | 'name-desc'
  | 'practiced-recent' | 'practiced-oldest'
  | 'date-newest' | 'date-oldest'
  | 'color'

export const ITEM_SORT_LABELS: Record<ItemSort, string> = {
  'name-asc': 'Name (A–Z)',
  'name-desc': 'Name (Z–A)',
  'practiced-recent': 'Last practiced (recent)',
  'practiced-oldest': 'Last practiced (oldest)',
  'date-newest': 'Date added (newest)',
  'date-oldest': 'Date added (oldest)',
  color: 'Color',
}

export interface ItemListFilter {
  query: string
  /** Keep items of any of these colors (all colors when empty). */
  colors: Set<Color>
  /** Keep items having any of these tags (all items when empty). */
  tags: Set<string>
}

/** Everything that shapes the list: kept in the URL so coming back to the list restores it. */
export interface ItemListView extends ItemListFilter {
  sort: ItemSort
}

const COLORS: Color[] = ['red', 'yellow', 'green']

/** Reads the list view from the URL query, e.g. `?q=mills&sort=name-desc&color=red,green&tag=hard`. */
export function readListView(params: URLSearchParams): ItemListView {
  const sort = params.get('sort')
  return {
    query: params.get('q') ?? '',
    sort: sort && sort in ITEM_SORT_LABELS ? sort as ItemSort : 'name-asc',
    colors: new Set((params.get('color') ?? '').split(',').filter((c): c is Color => COLORS.includes(c as Color))),
    tags: new Set(params.getAll('tag')),
  }
}

export function writeListView(view: ItemListView): URLSearchParams {
  const params = new URLSearchParams()
  if (view.query !== '') params.set('q', view.query)
  if (view.sort !== 'name-asc') params.set('sort', view.sort)
  if (view.colors.size > 0) params.set('color', COLORS.filter(c => view.colors.has(c)).join(','))
  for (const tag of sortTags(view.tags)) params.append('tag', tag)
  return params
}

const COLOR_ORDER: Record<Color, number> = { red: 0, yellow: 1, green: 2 }

/** Compares last-practiced times; never-practiced items go last when newest-first, first when oldest-first. */
function byLastPracticed(a: string | undefined, b: string | undefined, newestFirst: boolean): number {
  if (!a && !b) return 0
  if (!a) return newestFirst ? 1 : -1
  if (!b) return newestFirst ? -1 : 1
  return newestFirst ? b.localeCompare(a) : a.localeCompare(b)
}

export function filterAndSortItems(
  items: Item[],
  filter: ItemListFilter,
  sort: ItemSort,
  lastPracticedAt: Record<string, string>,
): Item[] {
  const query = filter.query.trim().toLowerCase()
  const kept = items.filter(item =>
    (query === '' || item.name.toLowerCase().includes(query)) &&
    (filter.colors.size === 0 || filter.colors.has(item.color)) &&
    (filter.tags.size === 0 || (item.tags ?? []).some(t => filter.tags.has(t))))

  return kept.sort((a, b) => {
    switch (sort) {
      case 'name-asc': return compareNatural(a.name, b.name)
      case 'name-desc': return compareNatural(b.name, a.name)
      case 'practiced-recent': return byLastPracticed(lastPracticedAt[a.id], lastPracticedAt[b.id], true)
      case 'practiced-oldest': return byLastPracticed(lastPracticedAt[a.id], lastPracticedAt[b.id], false)
      case 'date-newest': return b.createdAt.localeCompare(a.createdAt)
      case 'date-oldest': return a.createdAt.localeCompare(b.createdAt)
      case 'color': return COLOR_ORDER[a.color] - COLOR_ORDER[b.color]
    }
  })
}
