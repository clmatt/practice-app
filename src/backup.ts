import {
  getSnapshot, importRecords, recordBackup, getActivities, getItems, getSavedFilters,
} from './storage'
import { CURRENT_SCHEMA_VERSION, migrateSnapshot } from './migrations'
import { localDateKey, daysBetweenKeys } from './dates'
import { generateId } from './utils'
import type { Activity, Item, PracticeLog, SavedFilter } from './types'

/*
 * Backup files: what Export writes and Import reads.
 * Files carry schemaVersion so old backups can be migrated on import
 * (see migrations.ts). Files from before versioning have no schemaVersion
 * and no savedFilters; treat them as version 1.
 */

export interface BackupFile {
  app: 'practice-app'
  schemaVersion: number
  exportedAt: string
  activities: Activity[]
  items: Item[]
  logs: PracticeLog[]
  savedFilters: SavedFilter[]
}

export interface ImportPayload {
  exportedAt: string
  activities: Activity[]
  items: Item[]
  logs: PracticeLog[]
  savedFilters?: SavedFilter[]
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

export const BACKUP_STALE_DAYS = 30

// --- Export ---

export function buildBackup(now: Date = new Date()): BackupFile {
  return {
    app: 'practice-app',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    ...getSnapshot(),
  }
}

export function backupFileName(now: Date = new Date()): string {
  return `practice-backup-${localDateKey(now)}.json`
}

function download(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  // Revoking immediately can abort the download in Safari; give it a moment.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Saves a backup file. Where the browser can share files (iPhone), opens the
 * share sheet so the user can "Save to Files"; otherwise downloads it.
 * Resolves false if the user cancelled the share sheet.
 */
export async function exportData(): Promise<boolean> {
  const now = new Date()
  const file = new File([JSON.stringify(buildBackup(now), null, 2)], backupFileName(now), { type: 'application/json' })

  let shared = false
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Practice App backup' })
      shared = true
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false
      // Any other failure: fall back to a plain download below.
    }
  }
  if (!shared) download(file)

  recordBackup(now.toISOString())
  return true
}

export function describeLastBackup(lastBackupAt: string | null, now: Date = new Date()): { text: string; stale: boolean } {
  if (!lastBackupAt) return { text: 'Never backed up', stale: true }
  const days = daysBetweenKeys(localDateKey(lastBackupAt), localDateKey(now))
  const text = days <= 0 ? 'Last backup: today'
    : days === 1 ? 'Last backup: yesterday'
    : `Last backup: ${days} days ago`
  return { text, stale: days >= BACKUP_STALE_DAYS }
}

// --- Import ---

/**
 * Returns the payload (migrated to the current schema) or null if it isn't a
 * backup file. Throws NewerSchemaError for backups from a newer app version.
 */
export function validateImportPayload(raw: unknown): ImportPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.activities) || !Array.isArray(r.items) || !Array.isArray(r.logs)) return null
  if (r.savedFilters !== undefined && !Array.isArray(r.savedFilters)) return null
  const fromVersion = typeof r.schemaVersion === 'number' ? r.schemaVersion : 1
  const migrated = migrateSnapshot({
    activities: r.activities as Activity[],
    items: r.items as Item[],
    logs: r.logs as PracticeLog[],
    savedFilters: (r.savedFilters ?? []) as SavedFilter[],
  }, fromVersion)
  return { exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : '', ...migrated }
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
  const newActivities: Activity[] = []
  const newItems: Item[] = []
  const newLogs: PracticeLog[] = []
  const newFilters: SavedFilter[] = []
  // Removals are saved together with the additions in one atomic write at the end.
  const removeActivityIds: string[] = []
  const removeItemIds: string[] = []
  const importedFilters = payload.savedFilters ?? []

  function addItemsAndLogs(impItems: Item[], targetActivityId: string) {
    const idMap = new Map<string, string>()
    for (const impItem of impItems) {
      const newId = generateId()
      idMap.set(impItem.id, newId)
      newItems.push({ ...impItem, id: newId, activityId: targetActivityId })
      stats.itemsAdded++
    }
    for (const log of payload.logs) {
      const newItemId = idMap.get(log.itemId)
      if (!newItemId) continue
      newLogs.push({ ...log, id: generateId(), itemId: newItemId })
      stats.logsAdded++
    }
  }

  function addFilters(impActivityId: string, targetActivityId: string, skipNames: Set<string>) {
    for (const f of importedFilters) {
      if (f.activityId !== impActivityId || skipNames.has(f.name)) continue
      newFilters.push({ ...f, id: generateId(), activityId: targetActivityId })
    }
  }

  for (const impAct of payload.activities) {
    const resolution = actResolutions.get(impAct.id)
    const existingAct = existingActByName.get(impAct.name)
    const impItems = payload.items.filter(i => i.activityId === impAct.id)

    if (resolution === 'keep-existing') {
      stats.skipped++
      continue
    }

    if (resolution === 'combine' && existingAct) {
      const existingByName = new Map(getItems(existingAct.id).map(i => [i.name, i]))
      const toAdd: Item[] = []
      for (const impItem of impItems) {
        const existingItem = existingByName.get(impItem.name)
        const itemRes = itemResolutions.get(impItem.id)
        if (existingItem && itemRes === 'keep-existing') {
          stats.skipped++
          continue
        }
        if (existingItem && itemRes === 'keep-imported') removeItemIds.push(existingItem.id)
        toAdd.push(impItem)
      }
      addItemsAndLogs(toAdd, existingAct.id)
      addFilters(impAct.id, existingAct.id, new Set(getSavedFilters(existingAct.id).map(f => f.name)))
      continue
    }

    if (resolution === 'replace' && existingAct) removeActivityIds.push(existingAct.id)

    const newActId = generateId()
    const actName = resolution === 'keep-both' ? `${impAct.name} (imported)` : impAct.name
    newActivities.push({ ...impAct, id: newActId, name: actName })
    stats.activitiesAdded++
    addItemsAndLogs(impItems, newActId)
    addFilters(impAct.id, newActId, new Set())
  }

  importRecords(
    { activities: newActivities, items: newItems, logs: newLogs, savedFilters: newFilters },
    { activityIds: removeActivityIds, itemIds: removeItemIds },
  )
  return stats
}
