export type Color = 'red' | 'yellow' | 'green'

export interface Activity {
  id: string
  name: string
  itemLabel: string
  /** Plural of itemLabel when the automatic one is wrong (e.g. "cacti"). */
  itemLabelPlural?: string
  weights: { red: number; yellow: number; green: number }
  recencyBias?: number
  /** Within a color, favor items whose recent ratings were worse: 0 (off) to 10; default DEFAULT_WORK_BIAS. */
  workBias?: number
  /** Half-life of a rating in reps, for the work score; default DEFAULT_RATING_MEMORY. */
  ratingMemory?: number
  /** Auto Practice: after each rating, show the filter step before drawing the next item. */
  chooseFilterEachItem?: boolean
  createdAt: string
}

export interface Item {
  id: string
  activityId: string
  name: string
  color: Color
  tags?: string[]
  /** Set when the item is archived: kept with its history, but out of practice and the lists. */
  archivedAt?: string
  createdAt: string
}

export interface PracticeLog {
  id: string
  itemId: string
  practicedAt: string
  colorBefore: Color
  colorAfter: Color
  note?: string
  /** 'edit': the colour was changed by hand, not practised. Absent on practice reps. */
  source?: 'edit'
}

export interface SavedFilter {
  id: string
  activityId: string
  name: string
  expression: string
  createdAt: string
}

export interface SessionSummary {
  date: string
  itemCount: number
  changes: { itemName: string; colorBefore: Color; colorAfter: Color }[]
  allPracticed: { itemName: string; colorBefore: Color; colorAfter: Color }[]
}
