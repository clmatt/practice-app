import { getActivities, getAllItems, getLogs } from './storage'

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function exportData(): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    activities: getActivities(),
    items: getAllItems(),
    logs: getLogs(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `practice-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
