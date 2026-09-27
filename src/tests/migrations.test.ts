import { describe, it, expect } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION, migrateSnapshot, NewerSchemaError,
  type DataSnapshot, type Migration,
} from '../migrations'

const snapshot = (): DataSnapshot => ({
  activities: [{ id: 'a1', name: 'Juggling', itemLabel: 'trick', weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z' }],
  items: [{ id: 'i1', activityId: 'a1', name: 'Mills Mess', color: 'red', createdAt: '2026-01-01T00:00:00.000Z' }],
  logs: [],
  savedFilters: [],
})

describe('migrateSnapshot', () => {
  it('current schema version is 1', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1)
  })

  it('returns data unchanged when already at the target version', () => {
    const data = snapshot()
    expect(migrateSnapshot(data, CURRENT_SCHEMA_VERSION)).toEqual(data)
  })

  it('applies each migration step in order', () => {
    const migrations: Record<number, Migration> = {
      1: d => ({ ...d, items: d.items.map(i => ({ ...i, tags: ['v2'] })) }),
      2: d => ({ ...d, items: d.items.map(i => ({ ...i, tags: [...(i.tags ?? []), 'v3'] })) }),
    }
    const result = migrateSnapshot(snapshot(), 1, migrations, 3)
    expect(result.items[0].tags).toEqual(['v2', 'v3'])
  })

  it('starts from the given version, skipping earlier steps', () => {
    const migrations: Record<number, Migration> = {
      1: () => { throw new Error('should not run') },
      2: d => ({ ...d, logs: [] }),
    }
    expect(() => migrateSnapshot(snapshot(), 2, migrations, 3)).not.toThrow()
  })

  it('throws NewerSchemaError when data is newer than the app', () => {
    expect(() => migrateSnapshot(snapshot(), 5, {}, 1)).toThrow(NewerSchemaError)
    try {
      migrateSnapshot(snapshot(), 5, {}, 1)
    } catch (e) {
      expect((e as NewerSchemaError).found).toBe(5)
      expect((e as NewerSchemaError).supported).toBe(1)
    }
  })

  it('throws when a migration step is missing', () => {
    expect(() => migrateSnapshot(snapshot(), 1, {}, 2)).toThrow('No migration from data version 1 to 2')
  })
})
