/**
 * Recency bias in plain words. Within a color, items are ranked by the order
 * they were last practiced (not by dates); each step back in that order
 * multiplies an item's chance by 1 / bias (see computeRecencyWeights).
 */
export function describeRecencyBias(bias: number, poolSize: number = 10): string {
  if (bias >= 1) return 'All items of a color come up equally often, however recently you practiced them.'
  if (bias <= 0) return 'Only the item you practiced longest ago comes up (within each color).'
  const ratio = Math.pow(bias, -(poolSize - 1))
  const times = ratio > 1000 ? 'over 1,000×' : ratio < 10 ? `about ${ratio.toFixed(1)}×` : `about ${Math.round(ratio)}×`
  return `Of ${poolSize} items of a color, the one you practiced longest ago comes up ${times} as often as the one you practiced most recently.`
}
