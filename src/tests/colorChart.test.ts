import { describe, it, expect } from 'vitest'
import { buildColorChart, monotoneSegments, type ChartBox } from '../colorChart'
import { localDateKey } from '../dates'

const box: ChartBox = { width: 300, height: 200, left: 30, right: 10, top: 10, bottom: 20 }
// Plot area: x 30..290 (260 wide), y 10..180 (170 tall)

const row = (date: string, red: number, yellow: number, green: number) => ({ date, red, yellow, green })

describe('buildColorChart', () => {
  it('returns null with no data', () => {
    expect(buildColorChart([], box)).toBeNull()
  })

  it('gives every practice day the same width, however far apart the dates are', () => {
    // Spacing by real time squeezed bursts of daily practice into spikes.
    const chart = buildColorChart([row('2026-09-01', 1, 0, 0), row('2026-09-02', 1, 0, 0), row('2026-09-11', 1, 0, 0)], box)!
    expect(chart.points.map(p => Math.round(p.x))).toEqual([30, 160, 290])
  })

  it('scales y to the largest total, with 0 at the bottom', () => {
    const chart = buildColorChart([row('2026-09-01', 2, 1, 1), row('2026-09-02', 1, 1, 6)], box)!
    expect(chart.yMax).toBe(8)
    expect(chart.yTicks.map(t => t.label)).toEqual(['0', '4', '8'])
    expect(chart.yTicks[0].y).toBe(180)
    expect(chart.yTicks[2].y).toBe(10)
  })

  it('stacks red at the bottom, then yellow, then green', () => {
    const chart = buildColorChart([row('2026-09-01', 2, 1, 1), row('2026-09-02', 2, 1, 1)], box)!
    expect(chart.bands.map(b => b.color)).toEqual(['red', 'yellow', 'green'])
    const y = (v: number) => 180 - (v / 4) * 170
    // Each band runs along its top edge left→right as a smooth curve, then back along its bottom edge.
    const third = 260 / 3
    const band = (top: number, bottom: number) =>
      `M30,${y(top)}C${30 + third},${y(top)} ${290 - third},${y(top)} 290,${y(top)}` +
      `L290,${y(bottom)}C${290 - third},${y(bottom)} ${30 + third},${y(bottom)} 30,${y(bottom)}Z`
    expect(chart.bands[0].path).toBe(band(2, 0))
    expect(chart.bands[1].path).toBe(band(3, 2))
    expect(chart.bands[2].path).toBe(band(4, 3))
  })

  it('stretches a single day across the full width', () => {
    const chart = buildColorChart([row('2026-09-01', 1, 2, 3)], box)!
    expect(chart.points.map(p => p.x)).toEqual([30, 290])
    expect(chart.points.map(p => p.date)).toEqual(['2026-09-01', '2026-09-01'])
  })

  it('numbers each practice session, in order', () => {
    const chart = buildColorChart([row('2025-01-10', 1, 0, 0), row('2026-09-28', 1, 0, 0)], box)!
    expect(chart.points.map(p => [p.session, p.date])).toEqual([[1, '2025-01-10'], [2, '2026-09-28']])
  })

  it('labels the x axis with session numbers, not dates', () => {
    const two = buildColorChart([row('2025-01-10', 1, 0, 0), row('2026-09-28', 1, 0, 0)], box)!
    expect(two.xTicks.map(t => t.label)).toEqual(['Session 1', 'Session 2'])
    const nine = buildColorChart(Array.from({ length: 9 }, (_, i) => row(`2026-09-0${i + 1}`, 1, 0, 0)), box)!
    expect(nine.xTicks.map(t => t.label)).toEqual(['Session 1', 'Session 5', 'Session 9'])
    const one = buildColorChart([row('2026-09-01', 1, 0, 0)], box)!
    expect(one.xTicks.map(t => t.label)).toEqual(['Session 1'])
  })

  it('finds the nearest day to a horizontal position', () => {
    const chart = buildColorChart([row('2026-09-01', 1, 0, 0), row('2026-09-02', 2, 0, 0), row('2026-09-11', 3, 0, 0)], box)!
    expect(chart.nearest(0).date).toBe('2026-09-01')
    expect(chart.nearest(140).date).toBe('2026-09-02')
    expect(chart.nearest(250).date).toBe('2026-09-11')
  })
})

describe('monotoneSegments (smooth curves)', () => {
  it('never overshoots: curve handles stay within the neighbouring values', () => {
    // A plateau, a jump, another plateau: straight lines look pointy here, and a naive spline would bulge.
    const segs = monotoneSegments([[0, 0], [1, 0], [2, 10], [3, 10]])
    for (const s of segs) {
      const lo = Math.min(s.from[1], s.to[1])
      const hi = Math.max(s.from[1], s.to[1])
      for (const c of [s.c1, s.c2]) {
        expect(c[1]).toBeGreaterThanOrEqual(lo)
        expect(c[1]).toBeLessThanOrEqual(hi)
      }
    }
  })

  it('keeps flat stretches flat and straight lines straight', () => {
    const flat = monotoneSegments([[0, 5], [10, 5], [20, 5]])
    expect(flat.every(s => s.c1[1] === 5 && s.c2[1] === 5)).toBe(true)
    const line = monotoneSegments([[0, 0], [10, 10], [20, 20]])
    expect(line[0].c1[1]).toBeCloseTo(10 / 3)
    expect(line[0].c2[1]).toBeCloseTo(20 / 3)
  })

  it('bends smoothly through a peak instead of making a point', () => {
    const [up, down] = monotoneSegments([[0, 0], [10, 10], [20, 0]])
    // At the peak the curve arrives and leaves horizontally.
    expect(up.c2[1]).toBe(10)
    expect(down.c1[1]).toBe(10)
  })
})

describe('smoothing for long histories', () => {
  // 40 practice days: every weekday from Mon 2026-08-03 to Fri 2026-09-25.
  const days: string[] = []
  for (let d = new Date(2026, 7, 3); days.length < 40; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days.push(localDateKey(d))
  }
  const rows = days.map((date, i) => row(date, i % 3, 1, i))

  it('draws every session while there are 30 or fewer', () => {
    const chart = buildColorChart(rows.slice(0, 30), box)!
    expect(chart.drawn).toHaveLength(30)
    expect(chart.smoothed).toBe(false)
  })

  it('beyond 30 sessions, draws every Nth session (and the last), with no calendar grouping', () => {
    const chart = buildColorChart(rows, box)!
    expect(chart.smoothed).toBe(true)
    // 40 sessions → every 2nd: 1, 3, …, 39, then the last.
    expect(chart.drawn.map(p => p.session)).toEqual([...Array.from({ length: 20 }, (_, i) => 2 * i + 1), 40])
    // Drawn points sit exactly where those sessions sit, so the curve and the positions line up.
    for (const p of chart.drawn) expect(p.x).toBe(chart.points.find(q => q.session === p.session)!.x)
    const big = buildColorChart(Array.from({ length: 95 }, (_, i) => row(rows[i % 40].date, 1, 1, i)), box)!
    expect(big.drawn.length).toBeLessThanOrEqual(31)
  })

  it('still finds the exact day under the pointer, with that day\'s own counts', () => {
    const chart = buildColorChart(rows, box)!
    expect(chart.points).toHaveLength(40)
    const wednesday = chart.points.find(p => p.date === '2026-08-19')!
    expect(chart.nearest(wednesday.x)).toMatchObject({ date: '2026-08-19', red: 0, yellow: 1, green: 12 })
  })
})
