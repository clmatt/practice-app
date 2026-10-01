import type { Activity, Item, Color } from './types'

export function computeRecencyWeights(
  pool: Item[],
  recencyBias: number,
  lastPracticedAt: Record<string, string>,
): number[] {
  const sorted = [...pool].sort((a, b) => {
    const la = lastPracticedAt[a.id]
    const lb = lastPracticedAt[b.id]
    if (!la && !lb) return 0
    if (!la) return -1
    if (!lb) return 1
    return la.localeCompare(lb)
  })
  const rankOf = new Map<string, number>()
  let rank = 0
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prev = lastPracticedAt[sorted[i - 1].id]
      const curr = lastPracticedAt[sorted[i].id]
      if (prev !== curr) rank++
    }
    rankOf.set(sorted[i].id, rank)
  }
  const raw = pool.map(item => Math.pow(recencyBias, rankOf.get(item.id)!))
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw.map(w => w / sum)
}

export function selectItem(
  items: Item[],
  excluded: Set<string>,
  weights: Activity['weights'],
  recencyBias: number = 1,
  lastPracticedAt: Record<string, string> = {},
): Item | null {
  const available = items.filter(i => !excluded.has(i.id))
  if (available.length === 0) return null

  const byColor: Record<Color, Item[]> = {
    red: available.filter(i => i.color === 'red'),
    yellow: available.filter(i => i.color === 'yellow'),
    green: available.filter(i => i.color === 'green'),
  }

  // Colors with nothing left, or with a 0% weight, are never drawn. The rest
  // share 100% in proportion to their weights (renormalized). If nothing
  // drawable is left, there is nothing to practice: return null.
  const colors: Color[] = ['red', 'yellow', 'green']
  const drawable = colors.filter(c => byColor[c].length > 0 && weights[c] > 0)
  if (drawable.length === 0) return null

  const total = drawable.reduce((sum, c) => sum + weights[c], 0)
  const rand = Math.random() * total
  let cumulative = 0
  let chosenColor: Color = drawable[drawable.length - 1] // only reached through floating-point rounding
  for (const c of drawable) {
    cumulative += weights[c]
    if (rand < cumulative) {
      chosenColor = c
      break
    }
  }

  const pool = byColor[chosenColor]
  const recencyWeights = computeRecencyWeights(pool, recencyBias, lastPracticedAt)
  const r2 = Math.random()
  let cum = 0
  for (let i = 0; i < pool.length; i++) {
    cum += recencyWeights[i]
    if (r2 < cum) return pool[i]
  }
  return pool[pool.length - 1]
}
