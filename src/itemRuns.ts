import type { Color, PracticeLog } from './types'
import { localDateKey } from './dates'

export interface Run {
  color: Color
  count: number
  startDate: string
  endDate: string
}

export function buildRuns(logs: PracticeLog[]): Run[] {
  const sorted = [...logs].sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
  const runs: Run[] = []
  for (const log of sorted) {
    const date = localDateKey(log.practicedAt)
    const last = runs[runs.length - 1]
    if (last && last.color === log.colorAfter) {
      last.count++
      last.endDate = date
    } else {
      runs.push({ color: log.colorAfter, count: 1, startDate: date, endDate: date })
    }
  }
  return runs
}
