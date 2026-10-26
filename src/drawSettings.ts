/**
 * How Auto Practice picks an item, and each setting in plain words.
 *
 * 1. A color is drawn by the activity's color weights (latest ratings only).
 * 2. Within that color, an item's chance is its recency weight × its work boost:
 *    - recency: items are ranked by the order they were last practiced (not by
 *      dates); each step back multiplies the chance by 1 / recencyBias;
 *    - work: 1 + workBias × the item's work score (src/workScore.ts), so items
 *      whose recent ratings were worse come up more within their color.
 * Nothing depends on dates or time passing (see the philosophy in CLAUDE.md).
 */

export const DEFAULT_RECENCY_BIAS = 0.9
/** Up to 1 + 4 = 5× within a color; over many sessions recency evens this out to roughly 1.4–2×. */
export const DEFAULT_WORK_BIAS = 4
/** Half-life of a rating, in reps: about as many greens as a typical item took reds to turn green. */
export const DEFAULT_RATING_MEMORY = 3

export const WORK_BIAS_MAX = 10
export const RATING_MEMORY_MAX = 10

const times = (ratio: number) => (Number.isInteger(ratio) ? `${ratio}×` : `${ratio.toFixed(1)}×`)

export function describeRecencyBias(bias: number, poolSize: number = 10): string {
  if (bias >= 1) return 'All items of a color are equally likely to be picked, however recently you practiced them.'
  if (bias <= 0) return 'Only the item you practiced longest ago is picked (within each color).'
  const ratio = Math.pow(bias, -(poolSize - 1))
  const amount = ratio > 1000 ? 'over 1,000×' : ratio < 10 ? `about ${ratio.toFixed(1)}×` : `about ${Math.round(ratio)}×`
  return `Of ${poolSize} items of a color, the one you practiced longest ago is ${amount} as likely to be picked as the one you practiced most recently.`
}

export function describeWorkBias(strength: number): string {
  if (strength <= 0) return 'Off: within a color, items are picked by recency alone.'
  return `Within a color, items whose recent ratings were red are up to ${times(1 + strength)} as likely to be picked as items whose recent ratings were all green, if practiced equally recently.`
}

export function describeRatingMemory(halfLife: number): string {
  const reps = (n: number) => `${n} rep${n === 1 ? '' : 's'}`
  return `A rating from ${reps(halfLife)} ago counts half as much as your latest one; from ${reps(2 * halfLife)} ago, a quarter.`
}
