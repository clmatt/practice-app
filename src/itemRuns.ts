import type { Color, PracticeLog } from './types'
import { localDateKey } from './dates'
import { isRep } from './logs'

export interface Run {
  color: Color
  /** Practice reps in this run (a run started by a hand edit can have 0). */
  count: number
  startDate: string
  endDate: string
  /** The run began with a colour changed by hand rather than a rep. */
  edited: boolean
}

export function buildRuns(logs: PracticeLog[]): Run[] {
  const sorted = [...logs].sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
  const runs: Run[] = []
  for (const log of sorted) {
    const date = localDateKey(log.practicedAt)
    const rep = isRep(log)
    const last = runs[runs.length - 1]
    if (last && last.color === log.colorAfter) {
      if (rep) {
        last.count++
        last.endDate = date
      }
    } else {
      runs.push({ color: log.colorAfter, count: rep ? 1 : 0, startDate: date, endDate: date, edited: !rep })
    }
  }
  return runs
}
