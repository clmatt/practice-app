import type { PracticeLog } from './types'

/** Whether a log is a practice rep (rather than a record of a colour edited by hand). */
export function isRep(log: PracticeLog): boolean {
  return log.source !== 'edit'
}
