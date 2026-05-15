import type { Activity, Item, PracticeLog, Color } from './types'

const KEYS = {
  activities: 'practice:activities',
  items: 'practice:items',
  logs: 'practice:logs',
}

function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]')
  } catch {
    return []
  }
}

function save<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data))
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
}

// --- Activities ---

export function getActivities(): Activity[] {
  return load<Activity>(KEYS.activities)
}

export function saveActivity(activity: Activity): void {
  const all = getActivities()
  const idx = all.findIndex(a => a.id === activity.id)
  if (idx >= 0) all[idx] = activity
  else all.push(activity)
  save(KEYS.activities, all)
}

export function deleteActivity(id: string): void {
  save(KEYS.activities, getActivities().filter(a => a.id !== id))
  const allItems = load<Item>(KEYS.items)
  const deletedItemIds = new Set(allItems.filter(i => i.activityId === id).map(i => i.id))
  save(KEYS.items, allItems.filter(i => !deletedItemIds.has(i.id)))
  save(KEYS.logs, load<PracticeLog>(KEYS.logs).filter(l => !deletedItemIds.has(l.itemId)))
}

// --- Items ---

export function getItems(activityId: string): Item[] {
  return load<Item>(KEYS.items).filter(i => i.activityId === activityId)
}

export function saveItem(item: Item): void {
  const all = load<Item>(KEYS.items)
  const idx = all.findIndex(i => i.id === item.id)
  if (idx >= 0) all[idx] = item
  else all.push(item)
  save(KEYS.items, all)
}

export function deleteItem(id: string): void {
  save(KEYS.items, load<Item>(KEYS.items).filter(i => i.id !== id))
}

// --- Logs ---

export function getLogs(): PracticeLog[] {
  return load<PracticeLog>(KEYS.logs)
}

export function appendLog(log: PracticeLog): void {
  const all = getLogs()
  all.push(log)
  save(KEYS.logs, all)
}

export function getTodayPracticedItemIds(activityId: string): Set<string> {
  const activityItemIds = new Set(getItems(activityId).map(i => i.id))
  return new Set(
    getLogs()
      .filter(l => activityItemIds.has(l.itemId) && isToday(l.practicedAt))
      .map(l => l.itemId)
  )
}

// --- Stats queries ---

export function getColorDistributionByDay(
  activityId: string
): Array<{ date: string; red: number; yellow: number; green: number }> {
  const items = getItems(activityId)
  const logs = getLogs().filter(l => items.some(i => i.id === l.itemId))
  const dates = [...new Set(logs.map(l => l.practicedAt.slice(0, 10)))].sort()
  if (dates.length === 0) return []

  return dates.map(date => {
    const counts = { red: 0, yellow: 0, green: 0 }
    for (const item of items) {
      if (item.createdAt.slice(0, 10) > date) continue
      const itemLogs = logs
        .filter(l => l.itemId === item.id && l.practicedAt.slice(0, 10) <= date)
        .sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
      const color: Color = itemLogs.length > 0
        ? itemLogs[itemLogs.length - 1].colorAfter
        : item.color
      counts[color]++
    }
    return { date, ...counts }
  })
}

export function getPracticeCountByItem(activityId: string): Record<string, number> {
  const itemIds = new Set(getItems(activityId).map(i => i.id))
  const counts: Record<string, number> = {}
  for (const log of getLogs()) {
    if (itemIds.has(log.itemId)) {
      counts[log.itemId] = (counts[log.itemId] ?? 0) + 1
    }
  }
  return counts
}

export function getLastPracticedByItem(activityId: string): Record<string, string> {
  const itemIds = new Set(getItems(activityId).map(i => i.id))
  const last: Record<string, string> = {}
  for (const log of getLogs()) {
    if (itemIds.has(log.itemId)) {
      if (!last[log.itemId] || log.practicedAt > last[log.itemId]) {
        last[log.itemId] = log.practicedAt
      }
    }
  }
  return last
}
