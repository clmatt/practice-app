import {
  getSnapshot, importRecords, recordBackup, getActivities, getItems, getSavedFilters,
} from './storage'
import { CURRENT_SCHEMA_VERSION, migrateSnapshot, type DataSnapshot } from './migrations'
import { localDateKey, daysBetweenKeys } from './dates'
import { generateId } from './utils'
import { isRep } from './logs'
import { isColor } from './palette'
import { RATING_MEMORY_MAX, WORK_BIAS_MAX } from './drawSettings'
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
  /** Records in the file that were damaged and left out. */
  invalidRecords?: number
}

export type ActivityResolution = 'keep-existing' | 'replace' | 'keep-both' | 'combine'
export type ItemResolution = 'keep-existing' | 'keep-imported' | 'keep-both'

export interface ImportStats {
  activitiesAdded: number
  itemsAdded: number
  /** Practice reps added (colour-edit records come along but aren't counted). */
  logsAdded: number
  skipped: number
  /** Damaged records in the file that were left out. */
  invalid: number
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

const isStr = (v: unknown): v is string => typeof v === 'string'
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isWeight = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const optional = (v: unknown, check: (v: unknown) => boolean) => v === undefined || check(v)

function isValidActivity(v: unknown): v is Activity {
  if (!isRecord(v) || !isRecord(v.weights)) return false
  const w = v.weights
  return isStr(v.id) && isStr(v.name) && isStr(v.itemLabel) && isStr(v.createdAt) &&
    isWeight(w.red) && isWeight(w.yellow) && isWeight(w.green) &&
    optional(v.recencyBias, b => typeof b === 'number' && b >= 0 && b <= 1) &&
    optional(v.chooseFilterEachItem, b => typeof b === 'boolean') &&
    optional(v.itemLabelPlural, isStr) &&
    optional(v.workBias, b => typeof b === 'number' && b >= 0 && b <= WORK_BIAS_MAX) &&
    optional(v.ratingMemory, m => typeof m === 'number' && m >= 1 && m <= RATING_MEMORY_MAX)
}

function isValidItem(v: unknown): v is Item {
  return isRecord(v) && isStr(v.id) && isStr(v.activityId) && isStr(v.name) && isStr(v.createdAt) && isColor(v.color) &&
    optional(v.tags, t => Array.isArray(t) && t.every(isStr)) && optional(v.archivedAt, isStr)
}

function isValidLog(v: unknown): v is PracticeLog {
  return isRecord(v) && isStr(v.id) && isStr(v.itemId) && isStr(v.practicedAt) && !Number.isNaN(Date.parse(v.practicedAt)) &&
    isColor(v.colorBefore) && isColor(v.colorAfter) && optional(v.note, isStr) && optional(v.source, s => s === 'edit')
}

function isValidFilter(v: unknown): v is SavedFilter {
  return isRecord(v) && isStr(v.id) && isStr(v.activityId) && isStr(v.name) && isStr(v.expression)
}

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
  // Leave out damaged records rather than letting one break the app later.
  const activities = migrated.activities.filter(isValidActivity)
  if (migrated.activities.length > 0 && activities.length === 0) return null
  const items = migrated.items.filter(isValidItem)
  const logs = migrated.logs.filter(isValidLog)
  const savedFilters = migrated.savedFilters.filter(isValidFilter)
  const invalidRecords = migrated.activities.length - activities.length + migrated.items.length - items.length +
    migrated.logs.length - logs.length + migrated.savedFilters.length - savedFilters.length
  return { exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : '', activities, items, logs, savedFilters, invalidRecords }
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

/** What an import will do: records to add, existing activities/items to remove, and the resulting stats. */
export interface ImportPlan {
  records: DataSnapshot
  remove: { activityIds: string[]; itemIds: string[] }
  stats: ImportStats
}

/** Works out an import without saving anything (so the user can be asked first if it removes data). */
export function planImport(
  payload: ImportPayload,
  actResolutions: Map<string, ActivityResolution>,
  itemResolutions: Map<string, ItemResolution>,
): ImportPlan {
  const stats: ImportStats = { activitiesAdded: 0, itemsAdded: 0, logsAdded: 0, skipped: 0, invalid: payload.invalidRecords ?? 0 }
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
      if (isRep(log)) stats.logsAdded++
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

  return {
    records: { activities: newActivities, items: newItems, logs: newLogs, savedFilters: newFilters },
    remove: { activityIds: removeActivityIds, itemIds: removeItemIds },
    stats,
  }
}

/** Saves a planned import (one atomic write). */
export function applyImport(plan: ImportPlan): ImportStats {
  importRecords(plan.records, plan.remove)
  return plan.stats
}

export function executeImport(
  payload: ImportPayload,
  actResolutions: Map<string, ActivityResolution>,
  itemResolutions: Map<string, ItemResolution>,
): ImportStats {
  return applyImport(planImport(payload, actResolutions, itemResolutions))
}

/** What a plan would permanently remove from this phone: activity names, and items and reps in total. */
export function removalSummary(plan: ImportPlan): { activities: string[]; items: number; reps: number } {
  const { activities, items, logs } = getSnapshot()
  const actIds = new Set(plan.remove.activityIds)
  const itemIds = new Set(plan.remove.itemIds)
  for (const item of items) if (actIds.has(item.activityId)) itemIds.add(item.id)
  return {
    activities: activities.filter(a => actIds.has(a.id)).map(a => a.name),
    items: itemIds.size,
    reps: logs.filter(l => itemIds.has(l.itemId) && isRep(l)).length,
  }
}
