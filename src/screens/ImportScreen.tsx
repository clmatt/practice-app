import {
  getActivities, getItems, getLogs, getPracticeCountByItem,
  saveActivity, saveItem, appendLog, deleteActivity, deleteItemWithLogs,
} from '../storage'
import { generateId } from '../utils'
import type { Activity, Item, PracticeLog, Color } from '../types'

export interface ImportPayload {
  exportedAt: string
  activities: Activity[]
  items: Item[]
  logs: PracticeLog[]
}

export type ActivityResolution = 'keep-existing' | 'replace' | 'keep-both' | 'combine'
export type ItemResolution = 'keep-existing' | 'keep-imported' | 'keep-both'

export interface ImportStats {
  activitiesAdded: number
  itemsAdded: number
  logsAdded: number
  skipped: number
}

export interface ItemConflict {
  importedItem: Item
  existingItem: Item
}

export function validateImportPayload(raw: unknown): ImportPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.activities) || !Array.isArray(r.items) || !Array.isArray(r.logs)) return null
  return raw as ImportPayload
}

export function findActivityConflicts(imported: Activity[], existing: Activity[]): Activity[] {
  const existingNames = new Set(existing.map(a => a.name))
  return imported.filter(a => existingNames.has(a.name))
}

export function findItemConflicts(
  importedActivity: Activity,
  _existingActivity: Activity,
  importedItems: Item[],
  existingItems: Item[],
): ItemConflict[] {
  const existingByName = new Map(existingItems.map(i => [i.name, i]))
  return importedItems
    .filter(i => i.activityId === importedActivity.id && existingByName.has(i.name))
    .map(i => ({ importedItem: i, existingItem: existingByName.get(i.name)! }))
}

export function executeImport(
  payload: ImportPayload,
  actResolutions: Map<string, ActivityResolution>,
  itemResolutions: Map<string, ItemResolution>,
): ImportStats {
  const stats: ImportStats = { activitiesAdded: 0, itemsAdded: 0, logsAdded: 0, skipped: 0 }
  const existingActByName = new Map(getActivities().map(a => [a.name, a]))

  for (const impAct of payload.activities) {
    const resolution = actResolutions.get(impAct.id)
    const existingAct = existingActByName.get(impAct.name)

    if (resolution === 'keep-existing') {
      stats.skipped++
      continue
    }

    if (resolution === 'combine' && existingAct) {
      const impItems = payload.items.filter(i => i.activityId === impAct.id)
      const existingItems = getItems(existingAct.id)
      const existingByName = new Map(existingItems.map(i => [i.name, i]))
      const idMap = new Map<string, string>()

      for (const impItem of impItems) {
        const existingItem = existingByName.get(impItem.name)
        const itemRes = itemResolutions.get(impItem.id)

        if (existingItem && itemRes === 'keep-existing') {
          stats.skipped++
          continue
        }
        if (existingItem && itemRes === 'keep-imported') {
          deleteItemWithLogs(existingItem.id)
        }

        const newId = generateId()
        idMap.set(impItem.id, newId)
        saveItem({ ...impItem, id: newId, activityId: existingAct.id })
        stats.itemsAdded++
      }

      for (const log of payload.logs.filter(l => idMap.has(l.itemId))) {
        appendLog({ ...log, id: generateId(), itemId: idMap.get(log.itemId)! })
        stats.logsAdded++
      }
      continue
    }

    if (resolution === 'replace' && existingAct) {
      deleteActivity(existingAct.id)
    }

    const newActId = generateId()
    const actName = resolution === 'keep-both' ? `${impAct.name} (imported)` : impAct.name
    saveActivity({ ...impAct, id: newActId, name: actName })
    stats.activitiesAdded++

    const impItems = payload.items.filter(i => i.activityId === impAct.id)
    const idMap = new Map<string, string>()
    for (const impItem of impItems) {
      const newId = generateId()
      idMap.set(impItem.id, newId)
      saveItem({ ...impItem, id: newId, activityId: newActId })
      stats.itemsAdded++
    }
    for (const log of payload.logs.filter(l => idMap.has(l.itemId))) {
      appendLog({ ...log, id: generateId(), itemId: idMap.get(log.itemId)! })
      stats.logsAdded++
    }
  }

  return stats
}

export default function ImportScreen() {
  return null
}
