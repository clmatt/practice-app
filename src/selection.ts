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

  const colors: Color[] = ['red', 'yellow', 'green']
  const nonEmpty = colors.filter(c => byColor[c].length > 0)

  const emptyWeight = colors
    .filter(c => byColor[c].length === 0)
    .reduce((sum, c) => sum + weights[c], 0)
  const totalNonEmptyWeight = nonEmpty.reduce((sum, c) => sum + weights[c], 0)

  const effective: Record<Color, number> = { red: 0, yellow: 0, green: 0 }
  for (const c of nonEmpty) {
    effective[c] = weights[c] + emptyWeight * (weights[c] / totalNonEmptyWeight)
  }

  const rand = Math.random()
  let cumulative = 0
  let chosenColor: Color = nonEmpty[0]
  for (const c of nonEmpty) {
    cumulative += effective[c]
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
