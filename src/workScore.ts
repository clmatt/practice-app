import type { Color, Item, PracticeLog } from './types'

/**
 * How much work an item needs, from 0 (its recent ratings were green) to 1
 * (red): a decaying average of its ratings where each rating counts half as
 * much after `halfLife` more reps. Starts at the item's original color and
 * includes hand edits. Counted in reps, never time.
 */
const WORK: Record<Color, number> = { red: 1, yellow: 0.5, green: 0 }

export function workScore(start: Color, ratings: Color[], halfLife: number): number {
  const step = 1 - Math.pow(0.5, 1 / halfLife)
  let score = WORK[start]
  for (const color of ratings) score += step * (WORK[color] - score)
  return score
}

/** Work scores for items from their logs (any order; edits included). */
export function workScoresByItem(items: Item[], logs: PracticeLog[], halfLife: number): Record<string, number> {
  const byItem = new Map<string, PracticeLog[]>()
  for (const log of logs) {
    const list = byItem.get(log.itemId)
    if (list) list.push(log)
    else byItem.set(log.itemId, [log])
  }
  const scores: Record<string, number> = {}
  for (const item of items) {
    const history = (byItem.get(item.id) ?? []).sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
    const start = history.length > 0 ? history[0].colorBefore : item.color
    scores[item.id] = workScore(start, history.map(l => l.colorAfter), halfLife)
  }
  return scores
}
