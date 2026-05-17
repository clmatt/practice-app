import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getActivities, getItems, getLogs } from '../storage'
import type { Color, PracticeLog } from '../types'

interface Run {
  color: Color
  count: number
  startDate: string
  endDate: string
}

export function buildRuns(logs: PracticeLog[]): Run[] {
  const sorted = [...logs].sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
  const runs: Run[] = []
  for (const log of sorted) {
    const date = log.practicedAt.slice(0, 10)
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

export default function ItemProgressScreen() {
  return null
}
