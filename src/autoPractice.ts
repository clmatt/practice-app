import { getTodayPracticedItemIds, getLastPracticedByItem } from './storage'
import { selectItem } from './selection'
import { parseFilter, evaluateFilter } from './filterParser'
import type { Activity, Item } from './types'

/** Decision logic for Auto Practice: which items are in play and what to draw next. */

/** Items matching the advanced filter if one is set, otherwise any of the active tags (all items if none). */
export function buildFilteredPool(items: Item[], activeTags: Set<string>, advancedFilter: string | null): Item[] {
  if (advancedFilter) {
    const ast = parseFilter(advancedFilter)
    return typeof ast === 'string' ? [] : items.filter(i => evaluateFilter(ast, i.tags ?? []))
  }
  return activeTags.size === 0
    ? items
    : items.filter(i => (i.tags ?? []).some(t => activeTags.has(t)))
}

export type DrawResult =
  | { kind: 'item'; item: Item }
  | { kind: 'filter-exhausted' }
  | { kind: 'all-done' }

/**
 * Picks the next item, skipping anything practiced today or skipped this
 * session. 'filter-exhausted' means the filter has nothing left but other
 * items do; 'all-done' means nothing is left at all.
 */
export function drawFrom(
  activity: Activity,
  items: Item[],
  activeTags: Set<string>,
  advancedFilter: string | null,
  skipped: Set<string>,
): DrawResult {
  const excluded = new Set([...getTodayPracticedItemIds(activity.id), ...skipped])
  const lastPracticedAt = getLastPracticedByItem(activity.id)
  const recencyBias = activity.recencyBias ?? 0.9
  const pool = buildFilteredPool(items, activeTags, advancedFilter)
  const next = selectItem(pool, excluded, activity.weights, recencyBias, lastPracticedAt)
  if (next) return { kind: 'item', item: next }
  const filtering = activeTags.size > 0 || advancedFilter !== null
  if (filtering && selectItem(items, excluded, activity.weights, recencyBias, lastPracticedAt)) {
    return { kind: 'filter-exhausted' }
  }
  return { kind: 'all-done' }
}

export function tagsOf(items: Item[]): string[] {
  return [...new Set(items.flatMap(i => i.tags ?? []))].sort()
}
