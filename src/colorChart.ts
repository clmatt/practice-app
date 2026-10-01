import { daysBetweenKeys, formatDateKey } from './dates'
import type { Color } from './types'

/** Geometry for the Stats colour-distribution chart (a stacked area over time). */

export interface ColorCounts {
  date: string // 'YYYY-MM-DD'
  red: number
  yellow: number
  green: number
}

/** Drawing size and the margins around the plot area, in SVG units. */
export interface ChartBox {
  width: number
  height: number
  left: number
  right: number
  top: number
  bottom: number
}

export interface ChartPoint extends ColorCounts {
  x: number
}

export interface ColorChart {
  points: ChartPoint[]
  /** Bottom to top: red, yellow, green. */
  bands: { color: Color; path: string }[]
  yMax: number
  /** Converts a count to a y position. */
  y: (value: number) => number
  xTicks: { x: number; label: string }[]
  yTicks: { y: number; label: string }[]
  /** The data point closest to a horizontal position. */
  nearest: (x: number) => ChartPoint
}

const STACK: Color[] = ['red', 'yellow', 'green']
const LONG_RANGE_DAYS = 300

export function buildColorChart(rows: ColorCounts[], box: ChartBox): ColorChart | null {
  if (rows.length === 0) return null

  const plotLeft = box.left
  const plotRight = box.width - box.right
  const plotTop = box.top
  const plotBottom = box.height - box.bottom

  const first = rows[0].date
  const span = daysBetweenKeys(first, rows[rows.length - 1].date)
  const points: ChartPoint[] = span === 0
    // A single day: show it as a flat band across the whole width.
    ? [{ ...rows[0], x: plotLeft }, { ...rows[rows.length - 1], x: plotRight }]
    : rows.map(r => ({ ...r, x: plotLeft + (daysBetweenKeys(first, r.date) / span) * (plotRight - plotLeft) }))

  const yMax = Math.max(1, ...rows.map(r => r.red + r.yellow + r.green))
  const y = (value: number) => plotBottom - (value / yMax) * (plotBottom - plotTop)

  const bands = STACK.map((color, i) => {
    const below = (p: ChartPoint) => STACK.slice(0, i).reduce((sum, c) => sum + p[c], 0)
    const top = points.map(p => `${p.x},${y(below(p) + p[color])}`)
    const bottom = [...points].reverse().map(p => `${p.x},${y(below(p))}`)
    return { color, path: `M${top.join('L')}L${bottom.join('L')}Z` }
  })

  const longRange = span > LONG_RANGE_DAYS
  const label = (date: string) => formatDateKey(date, longRange ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric' })
  const tickCount = span === 0 ? 1 : 3
  const xTicks = Array.from({ length: tickCount }, (_, i) => {
    const target = tickCount === 1 ? 0 : (i / (tickCount - 1)) * (plotRight - plotLeft)
    const p = nearestPoint(points, plotLeft + target)
    return { x: p.x, label: label(p.date) }
  }).filter((t, i, all) => all.findIndex(o => o.label === t.label) === i)

  const yTickValues = yMax >= 2 ? [0, Math.round(yMax / 2), yMax] : [0, yMax]
  const yTicks = [...new Set(yTickValues)].map(v => ({ y: y(v), label: String(v) }))

  return { points, bands, yMax, y, xTicks, yTicks, nearest: x => nearestPoint(points, x) }
}

function nearestPoint(points: ChartPoint[], x: number): ChartPoint {
  return points.reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best))
}
