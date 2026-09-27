import type { Activity, Item, PracticeLog, SavedFilter } from './types'

/**
 * Version of the stored data shape.
 *
 * When a change to types.ts means data saved by an older version of the app
 * needs converting, bump this and add a step to MIGRATIONS that converts from
 * the previous version. Migrations run on startup (stored data) and on import
 * (backup files).
 */
export const CURRENT_SCHEMA_VERSION = 1

export interface DataSnapshot {
  activities: Activity[]
  items: Item[]
  logs: PracticeLog[]
  savedFilters: SavedFilter[]
}

export type Migration = (data: DataSnapshot) => DataSnapshot

/** MIGRATIONS[n] converts data from version n to version n + 1. */
export const MIGRATIONS: Record<number, Migration> = {}

export class NewerSchemaError extends Error {
  readonly found: number
  readonly supported: number

  constructor(found: number, supported: number) {
    super(
      `This data was saved by a newer version of the app (data version ${found}; ` +
      `this version understands up to ${supported}). Reload the app to update it.`,
    )
    this.name = 'NewerSchemaError'
    this.found = found
    this.supported = supported
  }
}

export function migrateSnapshot(
  data: DataSnapshot,
  fromVersion: number,
  migrations: Record<number, Migration> = MIGRATIONS,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
): DataSnapshot {
  if (fromVersion > targetVersion) throw new NewerSchemaError(fromVersion, targetVersion)
  let result = data
  for (let v = fromVersion; v < targetVersion; v++) {
    const step = migrations[v]
    if (!step) throw new Error(`No migration from data version ${v} to ${v + 1}`)
    result = step(result)
  }
  return result
}
