import { describe, it, expect } from 'vitest'
import { buildColorChart, type ChartBox } from '../colorChart'

const box: ChartBox = { width: 300, height: 200, left: 30, right: 10, top: 10, bottom: 20 }
// Plot area: x 30..290 (260 wide), y 10..180 (170 tall)

const row = (date: string, red: number, yellow: number, green: number) => ({ date, red, yellow, green })

describe('buildColorChart', () => {
  it('returns null with no data', () => {
    expect(buildColorChart([], box)).toBeNull()
  })

  it('spaces days by real time, not by practice day', () => {
    const chart = buildColorChart([row('2026-09-01', 1, 0, 0), row('2026-09-02', 1, 0, 0), row('2026-09-11', 1, 0, 0)], box)!
    expect(chart.points.map(p => Math.round(p.x))).toEqual([30, 56, 290])
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
    // Each band's path runs along its top edge left→right, then back along its bottom edge.
    expect(chart.bands[0].path).toBe(`M30,${y(2)}L290,${y(2)}L290,${y(0)}L30,${y(0)}Z`)
    expect(chart.bands[1].path).toBe(`M30,${y(3)}L290,${y(3)}L290,${y(2)}L30,${y(2)}Z`)
    expect(chart.bands[2].path).toBe(`M30,${y(4)}L290,${y(4)}L290,${y(3)}L30,${y(3)}Z`)
  })

  it('stretches a single day across the full width', () => {
    const chart = buildColorChart([row('2026-09-01', 1, 2, 3)], box)!
    expect(chart.points.map(p => p.x)).toEqual([30, 290])
    expect(chart.points.map(p => p.date)).toEqual(['2026-09-01', '2026-09-01'])
  })

  it('labels the x axis with short dates, including the year when the range is long', () => {
    const short = buildColorChart([row('2026-08-20', 1, 0, 0), row('2026-09-28', 1, 0, 0)], box)!
    expect(short.xTicks[0].label).toBe('Aug 20')
    expect(short.xTicks.at(-1)!.label).toBe('Sep 28')
    const long = buildColorChart([row('2025-01-10', 1, 0, 0), row('2026-09-28', 1, 0, 0)], box)!
    expect(long.xTicks[0].label).toBe('Jan 2025')
    expect(long.xTicks.at(-1)!.label).toBe('Sep 2026')
  })

  it('finds the nearest day to a horizontal position', () => {
    const chart = buildColorChart([row('2026-09-01', 1, 0, 0), row('2026-09-02', 2, 0, 0), row('2026-09-11', 3, 0, 0)], box)!
    expect(chart.nearest(0).date).toBe('2026-09-01')
    expect(chart.nearest(60).date).toBe('2026-09-02')
    expect(chart.nearest(200).date).toBe('2026-09-11')
  })
})
