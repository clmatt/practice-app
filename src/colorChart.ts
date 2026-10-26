import type { Color } from './types'
import { RATING_ORDER } from './palette'

/**
 * Geometry for the Stats colour-distribution chart: a stacked area over
 * practice sessions (session 1, 2, 3, …), not calendar time — a break doesn't
 * stretch the chart. Each session keeps its date for the tooltip.
 */

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
  /** 1 for the first practice session, 2 for the next, … */
  session: number
  x: number
}

export interface ColorChart {
  /** One per practice session: what the pointer snaps to and the tooltip reports. */
  points: ChartPoint[]
  /** The points the bands are drawn through (every Nth session for long histories). */
  drawn: ChartPoint[]
  /** True when the bands are drawn through every Nth session rather than all of them. */
  smoothed: boolean
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

const STACK: Color[] = RATING_ORDER
/** Beyond this many sessions, session-to-session changes are too dense to draw: draw about this many points. */
const DRAWN_LIMIT = 30

export function buildColorChart(rows: ColorCounts[], box: ChartBox): ColorChart | null {
  if (rows.length === 0) return null

  const plotLeft = box.left
  const plotRight = box.width - box.right
  const plotTop = box.top
  const plotBottom = box.height - box.bottom

  // Every session gets the same width, however far apart the dates are.
  const points: ChartPoint[] = rows.length === 1
    // A single session: show it as a flat band across the whole width.
    ? [{ ...rows[0], session: 1, x: plotLeft }, { ...rows[0], session: 1, x: plotRight }]
    : rows.map((r, i) => ({ ...r, session: i + 1, x: plotLeft + (i / (rows.length - 1)) * (plotRight - plotLeft) }))

  // For long histories draw a smooth trend through every Nth session (and the last);
  // every session keeps its position, so tapping still finds exact sessions.
  const smoothed = rows.length > DRAWN_LIMIT
  const step = Math.ceil(rows.length / DRAWN_LIMIT)
  const drawn = smoothed ? points.filter((_, i) => i % step === 0 || i === points.length - 1) : points

  const yMax = Math.max(1, ...rows.map(r => r.red + r.yellow + r.green))
  const y = (value: number) => plotBottom - (value / yMax) * (plotBottom - plotTop)

  const bands = STACK.map((color, i) => {
    const below = (p: ChartPoint) => STACK.slice(0, i).reduce((sum, c) => sum + p[c], 0)
    const top: Pt[] = drawn.map(p => [p.x, y(below(p) + p[color])])
    const bottom: Pt[] = drawn.map(p => [p.x, y(below(p))])
    // Along the top edge left→right, then back along the bottom edge right→left, both smoothed.
    const forward = monotoneSegments(top).map(s => `C${xy(s.c1)} ${xy(s.c2)} ${xy(s.to)}`).join('')
    const backward = monotoneSegments(bottom).reverse().map(s => `C${xy(s.c2)} ${xy(s.c1)} ${xy(s.from)}`).join('')
    return { color, path: `M${xy(top[0])}${forward}L${xy(bottom[bottom.length - 1])}${backward}Z` }
  })

  const tickCount = rows.length === 1 ? 1 : 3
  const xTicks = Array.from({ length: tickCount }, (_, i) => {
    const target = tickCount === 1 ? 0 : (i / (tickCount - 1)) * (plotRight - plotLeft)
    const p = nearestPoint(points, plotLeft + target)
    return { x: p.x, label: `Session ${p.session}` }
  }).filter((t, i, all) => all.findIndex(o => o.label === t.label) === i)

  const yTickValues = yMax >= 2 ? [0, Math.round(yMax / 2), yMax] : [0, yMax]
  const yTicks = [...new Set(yTickValues)].map(v => ({ y: y(v), label: String(v) }))

  return { points, drawn, smoothed, bands, yMax, y, xTicks, yTicks, nearest: x => nearestPoint(points, x) }
}

type Pt = [number, number]
const xy = (p: Pt) => `${p[0]},${p[1]}`

export interface CurveSegment {
  from: Pt
  c1: Pt
  c2: Pt
  to: Pt
}

/**
 * Cubic Bézier segments for a smooth curve through `pts` (x increasing) that
 * never overshoots the data: between two points it stays within their values,
 * and it is flat at peaks, troughs and plateaus. This is the "monotone X"
 * curve (Fritsch–Carlson / Steffen tangents) that d3 and Recharts use.
 */
export function monotoneSegments(pts: Pt[]): CurveSegment[] {
  const n = pts.length
  if (n < 2) return []
  const h: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    h[i] = pts[i + 1][0] - pts[i][0]
    slope[i] = h[i] ? (pts[i + 1][1] - pts[i][1]) / h[i] : 0
  }

  // Tangent at each point.
  const t: number[] = []
  if (n === 2) {
    t[0] = t[1] = slope[0] // two points: a straight line
  } else {
    for (let i = 1; i < n - 1; i++) {
      const [s0, s1, h0, h1] = [slope[i - 1], slope[i], h[i - 1], h[i]]
      const p = (s0 * h1 + s1 * h0) / (h0 + h1)
      // Zero where the direction changes (a peak or trough), otherwise limited so the curve can't overshoot.
      t[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
    }
    t[0] = (3 * slope[0] - t[1]) / 2
    t[n - 1] = (3 * slope[n - 2] - t[n - 2]) / 2
  }

  return pts.slice(0, -1).map((from, i) => {
    const to = pts[i + 1]
    const third = h[i] / 3
    return { from, to, c1: [from[0] + third, from[1] + t[i] * third], c2: [to[0] - third, to[1] - t[i + 1] * third] }
  })
}

function nearestPoint(points: ChartPoint[], x: number): ChartPoint {
  return points.reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best))
}
