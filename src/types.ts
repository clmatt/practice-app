export type Color = 'red' | 'yellow' | 'green'

export interface Activity {
  id: string
  name: string
  itemLabel: string
  weights: { red: number; yellow: number; green: number }
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
}
