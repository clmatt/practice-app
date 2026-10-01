import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { buildColorChart, type ChartBox, type ChartPoint, type ColorCounts } from '../colorChart'
import { formatDateKey } from '../dates'
import { RATING_COLORS, SURFACE } from '../palette'
import type { Color } from '../types'

const BOX: ChartBox = { width: 340, height: 220, left: 28, right: 8, top: 8, bottom: 24 }
const NAMES: Record<Color, string> = { red: 'Red', yellow: 'Yellow', green: 'Green' }
const LEGEND_ORDER: Color[] = ['red', 'yellow', 'green']
const TOOLTIP_ORDER: Color[] = ['green', 'yellow', 'red'] // top to bottom, as stacked
const MIN_LABEL_BAND = 14 // SVG units: only write a count inside a band this tall

const shortDate = (date: string) => formatDateKey(date, { month: 'short', day: 'numeric' })

/** How many items were red / yellow / green at the end of each practice day, as a stacked area. */
export default function ColorDistributionChart({ rows }: { rows: ColorCounts[] }) {
  const chart = useMemo(() => buildColorChart(rows, BOX), [rows])
  const svgRef = useRef<SVGSVGElement>(null)
  const [active, setActive] = useState<ChartPoint | null>(null)
  const plotRef = useRef<HTMLDivElement>(null)

  // On a phone the summary stays after you lift your finger; tapping anywhere outside the chart closes it.
  useEffect(() => {
    if (!active) return
    function closeIfOutside(e: globalThis.PointerEvent) {
      if (!plotRef.current?.contains(e.target as Node)) setActive(null)
    }
    document.addEventListener('pointerdown', closeIfOutside)
    return () => document.removeEventListener('pointerdown', closeIfOutside)
  }, [active])

  if (!chart) return null

  const latest = rows[rows.length - 1]
  const description = `Ratings over time. Latest, ${shortDate(latest.date)}: ${latest.red} red, ${latest.yellow} yellow, ${latest.green} green.`
  const last = chart.points[chart.points.length - 1]

  function track(e: PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect()
    if (rect.width === 0) return
    setActive(chart!.nearest(((e.clientX - rect.left) / rect.width) * BOX.width))
  }

  return (
    <div>
      <ul aria-label="Legend" className="flex gap-4 mb-2 text-xs text-slate-300">
        {LEGEND_ORDER.map(color => (
          <li key={color} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: RATING_COLORS[color] }} />
            {NAMES[color]}
          </li>
        ))}
      </ul>

      <div ref={plotRef} className="relative">
        <svg
          ref={svgRef}
          role="img"
          aria-label={description}
          viewBox={`0 0 ${BOX.width} ${BOX.height}`}
          className="w-full h-auto select-none"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={track}
          onPointerMove={track}
          onPointerLeave={e => { if (e.pointerType === 'mouse') setActive(null) }}
        >
          {chart.yTicks.map(t => (
            <g key={t.label}>
              <line x1={BOX.left} x2={BOX.width - BOX.right} y1={t.y} y2={t.y} stroke="#1e293b" strokeWidth={1} />
              <text x={BOX.left - 6} y={t.y} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#64748b">{t.label}</text>
            </g>
          ))}

          {/* The surface-coloured stroke is the thin gap that separates neighbouring bands. */}
          {chart.bands.map(b => (
            <path key={b.color} d={b.path} fill={RATING_COLORS[b.color]} stroke={SURFACE} strokeWidth={1.25} strokeLinejoin="round" />
          ))}

          {LEGEND_ORDER.map((color, i) => {
            const below = LEGEND_ORDER.slice(0, i).reduce((sum, c) => sum + last[c], 0)
            const height = chart.y(below) - chart.y(below + last[color])
            if (last[color] === 0 || height < MIN_LABEL_BAND) return null
            return (
              <text key={color} x={last.x - 6} y={chart.y(below + last[color] / 2)} textAnchor="end" dominantBaseline="middle"
                fontSize={11} fontWeight={600} fill="#020617">
                {last[color]}
              </text>
            )
          })}

          {chart.xTicks.map((t, i) => (
            <text key={t.label} x={t.x} y={BOX.height - 6} fontSize={11} fill="#64748b"
              textAnchor={i === 0 ? 'start' : i === chart.xTicks.length - 1 ? 'end' : 'middle'}>
              {t.label}
            </text>
          ))}

          {active && (
            <line x1={active.x} x2={active.x} y1={BOX.top} y2={BOX.height - BOX.bottom} stroke="#e2e8f0" strokeWidth={1} />
          )}
        </svg>

        {active && (
          <div
            role="status"
            className="absolute top-2 pointer-events-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-lg"
            style={active.x < BOX.width / 2
              ? { left: `calc(${(active.x / BOX.width) * 100}% + 8px)` }
              : { right: `calc(${((BOX.width - active.x) / BOX.width) * 100}% + 8px)` }}
          >
            <div className="text-slate-400 mb-1">{shortDate(active.date)}</div>
            {TOOLTIP_ORDER.map(color => (
              <div key={color} className="flex items-center gap-2">
                <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: RATING_COLORS[color] }} />
                <span className="font-semibold text-slate-100 tabular-nums w-5 text-right">{active[color]}</span>
                <span className="text-slate-400">{NAMES[color]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="mt-3 text-sm">
        <summary className="text-slate-500 text-xs cursor-pointer">Show as table</summary>
        <table className="w-full mt-2 text-xs text-slate-300">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left font-normal py-1">Day</th>
              {LEGEND_ORDER.map(c => <th key={c} className="text-right font-normal py-1">{NAMES[c]}</th>)}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map(r => (
              <tr key={r.date} className="border-t border-slate-800">
                <td className="py-1">{shortDate(r.date)}</td>
                {LEGEND_ORDER.map(c => <td key={c} className="text-right tabular-nums py-1">{r[c]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
