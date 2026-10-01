export type Color = 'red' | 'yellow' | 'green'

export interface Activity {
  id: string
  name: string
  itemLabel: string
  weights: { red: number; yellow: number; green: number }
  recencyBias?: number
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
  createdAt: string
}

export interface PracticeLog {
  id: string
  itemId: string
  practicedAt: string
  colorBefore: Color
  colorAfter: Color
  note?: string
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
