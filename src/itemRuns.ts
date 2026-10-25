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

/**
 * How many reps it took an item to first turn green, counting from its first
 * rep. Null if it hasn't turned green yet, or was already green at its first rep.
 */
export function repsToGreen(logs: PracticeLog[]): number | null {
  const reps = logs.filter(isRep).sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
  if (reps.length === 0 || reps[0].colorBefore === 'green') return null
  const index = reps.findIndex(l => l.colorAfter === 'green')
  return index === -1 ? null : index + 1
}
