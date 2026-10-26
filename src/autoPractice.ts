import { getTodayPracticedItemIds, getLastPracticedByItem, getLogs } from './storage'
import { selectItem } from './selection'
import { parseFilter, evaluateFilter } from './filterParser'
import type { Activity, Color, Item } from './types'
import { sortTags } from './sorting'
import { workScoresByItem } from './workScore'
import { DEFAULT_RATING_MEMORY, DEFAULT_RECENCY_BIAS, DEFAULT_WORK_BIAS } from './drawSettings'
import { RATING_ORDER, ratingName } from './palette'

/** Decision logic for Auto Practice: which items are in play and what to draw next. */

/** What Auto Practice draws from: the colors apply together with the tags or the advanced filter. */
export interface PracticeFilter {
  /** Keep items having any of these tags (all items when empty). Ignored while an advanced filter is set. */
  tags: Set<string>
  /** Keep items of any of these colors (all colors when empty). */
  colors: Set<Color>
  advanced: string | null
}

export function isFiltering(filter: PracticeFilter): boolean {
  return filter.tags.size > 0 || filter.colors.size > 0 || filter.advanced !== null
}

/** One-line summary, e.g. "Green · V3, slab" or "all items". */
export function describeFilter(filter: PracticeFilter): string {
  const colors = RATING_ORDER.filter(c => filter.colors.has(c)).map(ratingName).join(', ')
  const rest = filter.advanced ? `⚡ ${filter.advanced}` : sortTags(filter.tags).join(', ')
  return [colors, rest].filter(Boolean).join(' · ') || 'all items'
}

/** Items matching the chosen colors and the advanced filter if one is set, otherwise any of the active tags. */
export function buildFilteredPool(items: Item[], filter: PracticeFilter): Item[] {
  const { tags, colors, advanced } = filter
  const ofColor = colors.size === 0 ? items : items.filter(i => colors.has(i.color))
  if (advanced) {
    const ast = parseFilter(advanced)
    return typeof ast === 'string' ? [] : ofColor.filter(i => evaluateFilter(ast, i.tags ?? []))
  }
  return tags.size === 0
    ? ofColor
    : ofColor.filter(i => (i.tags ?? []).some(t => tags.has(t)))
}

/**
 * The color weights for a draw. Colors that weren't chosen are left out.
 * Chosen colors keep their weights, unless one of them is at 0%: choosing a
 * color means practising it, so then the chosen colors come up equally.
 */
export function practiceWeights(weights: Activity['weights'], colors: Set<Color>): Activity['weights'] {
  if (colors.size === 0) return weights
  const chosen = [...colors]
  const equal = chosen.some(c => weights[c] === 0)
  const result = { red: 0, yellow: 0, green: 0 }
  for (const c of chosen) result[c] = equal ? 1 : weights[c]
  return result
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
  filter: PracticeFilter,
  skipped: Set<string>,
): DrawResult {
  const excluded = new Set([...getTodayPracticedItemIds(activity.id), ...skipped])
  const lastPracticedAt = getLastPracticedByItem(activity.id)
  const recencyBias = activity.recencyBias ?? DEFAULT_RECENCY_BIAS
  const workBias = activity.workBias ?? DEFAULT_WORK_BIAS
  const work = {
    workBias,
    workScores: workBias > 0 ? workScoresByItem(items, getLogs(), activity.ratingMemory ?? DEFAULT_RATING_MEMORY) : {},
  }
  const pool = buildFilteredPool(items, filter)
  const weights = practiceWeights(activity.weights, filter.colors)
  const next = selectItem(pool, excluded, weights, recencyBias, lastPracticedAt, work)
  if (next) return { kind: 'item', item: next }
  if (isFiltering(filter) && selectItem(items, excluded, activity.weights, recencyBias, lastPracticedAt)) {
    return { kind: 'filter-exhausted' }
  }
  return { kind: 'all-done' }
}

export function tagsOf(items: Item[]): string[] {
  return sortTags(items.flatMap(i => i.tags ?? []))
}
