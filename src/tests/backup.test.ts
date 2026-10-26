import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  validateImportPayload,
  findActivityConflicts,
  findItemConflicts,
  executeImport,
  planImport,
  applyImport,
  removalSummary,
  buildBackup,
  backupFileName,
  exportData,
  describeLastBackup,
  type ImportPayload,
} from '../backup'
import {
  getActivities, getItems, getLogs, saveActivity, saveItem, appendLog,
  getSavedFilters, upsertSavedFilter, getLastBackupAt,
} from '../storage'
import { NewerSchemaError } from '../migrations'
import type { Activity, Item, PracticeLog, SavedFilter } from '../types'

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'act-1',
  name: 'Juggling',
  itemLabel: 'trick',
  weights: { red: 0.6, yellow: 0.3, green: 0.1 },
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'item-1',
  activityId: 'act-1',
  name: 'Mills Mess',
  color: 'red',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makeLog = (overrides: Partial<PracticeLog> = {}): PracticeLog => ({
  id: 'log-1',
  itemId: 'item-1',
  practicedAt: '2026-01-01T10:00:00.000Z',
  colorBefore: 'red',
  colorAfter: 'yellow',
  ...overrides,
})

const makePayload = (overrides: Partial<ImportPayload> = {}): ImportPayload => ({
  exportedAt: '2026-01-01T00:00:00.000Z',
  activities: [],
  items: [],
  logs: [],
  ...overrides,
})

describe('validateImportPayload', () => {
  it('returns null for null input', () => {
    expect(validateImportPayload(null)).toBeNull()
  })

  it('returns null for a non-object', () => {
    expect(validateImportPayload('string')).toBeNull()
  })

  it('returns null if activities is missing', () => {
    expect(validateImportPayload({ items: [], logs: [] })).toBeNull()
  })

  it('returns null if activities is not an array', () => {
    expect(validateImportPayload({ activities: 'x', items: [], logs: [] })).toBeNull()
  })

  it('returns the payload when all arrays are present', () => {
    const payload = { exportedAt: '2026-01-01', activities: [], items: [], logs: [] }
    expect(validateImportPayload(payload)).toEqual({ ...payload, savedFilters: [], invalidRecords: 0 })
  })
})

describe('findActivityConflicts', () => {
  it('returns empty array when no name matches', () => {
    const imported = [makeActivity({ name: 'Juggling' })]
    const existing = [makeActivity({ id: 'e1', name: 'Piano' })]
    expect(findActivityConflicts(imported, existing)).toEqual([])
  })

  it('returns the imported activity when its name matches an existing one', () => {
    const imported = [makeActivity({ name: 'Juggling' })]
    const existing = [makeActivity({ id: 'e1', name: 'Juggling' })]
    expect(findActivityConflicts(imported, existing)).toEqual([imported[0]])
  })

  it('returns only the matching imported activities, not all', () => {
    const imported = [
      makeActivity({ id: 'i1', name: 'Juggling' }),
      makeActivity({ id: 'i2', name: 'Piano' }),
    ]
    const existing = [makeActivity({ id: 'e1', name: 'Juggling' })]
    const conflicts = findActivityConflicts(imported, existing)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].id).toBe('i1')
  })

  it('returns empty array when existing list is empty', () => {
    const imported = [makeActivity({ name: 'Juggling' })]
    expect(findActivityConflicts(imported, [])).toEqual([])
  })
})

describe('findItemConflicts', () => {
  it('returns empty array when no item names match', () => {
    const impAct = makeActivity({ id: 'imp-act' })
    const existAct = makeActivity({ id: 'exist-act' })
    const impItems = [makeItem({ id: 'i1', activityId: 'imp-act', name: 'Mills Mess' })]
    const existItems = [makeItem({ id: 'e1', activityId: 'exist-act', name: 'Shower' })]
    expect(findItemConflicts(impAct, existAct, impItems, existItems)).toEqual([])
  })

  it('returns conflict pairs when item names match', () => {
    const impAct = makeActivity({ id: 'imp-act' })
    const existAct = makeActivity({ id: 'exist-act' })
    const impItem = makeItem({ id: 'i1', activityId: 'imp-act', name: 'Mills Mess' })
    const existItem = makeItem({ id: 'e1', activityId: 'exist-act', name: 'Mills Mess' })
    const conflicts = findItemConflicts(impAct, existAct, [impItem], [existItem])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].importedItem).toEqual(impItem)
    expect(conflicts[0].existingItem).toEqual(existItem)
  })

  it('ignores imported items not belonging to the imported activity', () => {
    const impAct = makeActivity({ id: 'imp-act' })
    const existAct = makeActivity({ id: 'exist-act' })
    const wrongActItem = makeItem({ id: 'i1', activityId: 'other-act', name: 'Mills Mess' })
    const existItem = makeItem({ id: 'e1', activityId: 'exist-act', name: 'Mills Mess' })
    expect(findItemConflicts(impAct, existAct, [wrongActItem], [existItem])).toEqual([])
  })
})

describe('executeImport', () => {
  it('imports activity, items, and logs with fresh IDs', () => {
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act' })],
      logs: [makeLog({ id: 'imp-log', itemId: 'imp-item' })],
    })
    executeImport(payload, new Map(), new Map())
    const acts = getActivities()
    expect(acts).toHaveLength(1)
    expect(acts[0].name).toBe('Juggling')
    expect(acts[0].id).not.toBe('imp-act')
    const items = getItems(acts[0].id)
    expect(items).toHaveLength(1)
    expect(items[0].id).not.toBe('imp-item')
    const logs = getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].itemId).toBe(items[0].id)
  })

  it('keep-existing skips the activity and its items entirely', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act' })],
    })
    const stats = executeImport(payload, new Map([['imp-act', 'keep-existing']]), new Map())
    expect(getActivities()).toHaveLength(1)
    expect(getActivities()[0].id).toBe('exist-act')
    expect(stats.skipped).toBe(1)
  })

  it('replace deletes existing activity and imports fresh', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Shower' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess' })],
    })
    executeImport(payload, new Map([['imp-act', 'replace']]), new Map())
    const acts = getActivities()
    expect(acts).toHaveLength(1)
    expect(acts[0].id).not.toBe('exist-act')
    const items = getItems(acts[0].id)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Mills Mess')
  })

  it('keep-both imports with "(imported)" name suffix', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
    })
    executeImport(payload, new Map([['imp-act', 'keep-both']]), new Map())
    const acts = getActivities()
    expect(acts).toHaveLength(2)
    const imported = acts.find(a => a.id !== 'exist-act')!
    expect(imported.name).toBe('Juggling (imported)')
  })

  it('combine merges non-conflicting items into the existing activity without creating a new one', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Shower' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess' })],
    })
    executeImport(payload, new Map([['imp-act', 'combine']]), new Map())
    expect(getActivities()).toHaveLength(1)
    const items = getItems('exist-act')
    expect(items).toHaveLength(2)
    expect(items.map(i => i.name).sort()).toEqual(['Mills Mess', 'Shower'])
  })

  it('combine + item keep-existing discards the imported item and its logs', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Mills Mess' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess' })],
      logs: [makeLog({ id: 'imp-log', itemId: 'imp-item' })],
    })
    const stats = executeImport(
      payload,
      new Map([['imp-act', 'combine']]),
      new Map([['imp-item', 'keep-existing']]),
    )
    expect(getItems('exist-act')).toHaveLength(1)
    expect(getItems('exist-act')[0].id).toBe('exist-item')
    expect(getLogs()).toHaveLength(0)
    expect(stats.skipped).toBe(1)
  })

  it('combine + item keep-imported replaces existing item and its logs', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Mills Mess', color: 'red' }))
    appendLog(makeLog({ id: 'exist-log', itemId: 'exist-item' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess', color: 'green' })],
      logs: [makeLog({ id: 'imp-log', itemId: 'imp-item', colorAfter: 'green' })],
    })
    executeImport(
      payload,
      new Map([['imp-act', 'combine']]),
      new Map([['imp-item', 'keep-imported']]),
    )
    const items = getItems('exist-act')
    expect(items).toHaveLength(1)
    expect(items[0].color).toBe('green')
    expect(items[0].id).not.toBe('exist-item')
    const logs = getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].colorAfter).toBe('green')
  })

  it('combine + item keep-both adds imported alongside existing', () => {
    saveActivity(makeActivity({ id: 'exist-act', name: 'Juggling' }))
    saveItem(makeItem({ id: 'exist-item', activityId: 'exist-act', name: 'Mills Mess', color: 'red' }))
    const payload = makePayload({
      activities: [makeActivity({ id: 'imp-act', name: 'Juggling' })],
      items: [makeItem({ id: 'imp-item', activityId: 'imp-act', name: 'Mills Mess', color: 'green' })],
    })
    executeImport(
      payload,
      new Map([['imp-act', 'combine']]),
      new Map([['imp-item', 'keep-both']]),
    )
    const items = getItems('exist-act')
    expect(items).toHaveLength(2)
    expect(items.every(i => i.name === 'Mills Mess')).toBe(true)
    expect(items.map(i => i.color).sort()).toEqual(['green', 'red'])
  })

  it('returns zero stats for an empty payload', () => {
    const stats = executeImport(makePayload(), new Map(), new Map())
    expect(stats).toEqual({ activitiesAdded: 0, itemsAdded: 0, logsAdded: 0, skipped: 0, invalid: 0 })
  })
})

const makeFilter = (overrides: Partial<SavedFilter> = {}): SavedFilter => ({
  id: 'sf-1',
  activityId: 'act-1',
  name: 'Hard ones',
  expression: '"hard"',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('buildBackup', () => {
  it('includes app id, schema version, all collections and saved filters', () => {
    saveActivity(makeActivity())
    saveItem(makeItem())
    appendLog(makeLog())
    upsertSavedFilter(makeFilter())
    const backup = buildBackup(new Date('2026-05-16T01:00:00.000Z'))
    expect(backup.app).toBe('practice-app')
    expect(backup.schemaVersion).toBe(1)
    expect(backup.exportedAt).toBe('2026-05-16T01:00:00.000Z')
    expect(backup.activities).toHaveLength(1)
    expect(backup.items).toHaveLength(1)
    expect(backup.logs).toHaveLength(1)
    expect(backup.savedFilters).toEqual([makeFilter()])
  })

  it('names the file with the local date', () => {
    // 6pm PDT on May 15
    expect(backupFileName(new Date('2026-05-16T01:00:00.000Z'))).toBe('practice-backup-2026-05-15.json')
  })
})

describe('exportData', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function stubDownload() {
    const blobs: Blob[] = []
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => { blobs.push(blob); return 'blob:mock-url' },
      revokeObjectURL: vi.fn(),
    })
    const clicks: string[] = []
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag)
      if (tag === 'a') vi.spyOn(el, 'click').mockImplementation(() => { clicks.push((el as HTMLAnchorElement).download) })
      return el
    })
    return { blobs, clicks }
  }

  it('downloads the backup when sharing files is unavailable, and records the backup', async () => {
    const { blobs, clicks } = stubDownload()
    saveActivity(makeActivity())
    expect(await exportData()).toBe(true)
    expect(clicks[0]).toMatch(/^practice-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const parsed = JSON.parse(await blobs[0].text())
    expect(parsed.activities).toHaveLength(1)
    expect(parsed.schemaVersion).toBe(1)
    expect(getLastBackupAt()).not.toBeNull()
  })

  it('uses the share sheet when files can be shared', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    expect(await exportData()).toBe(true)
    expect(share).toHaveBeenCalledTimes(1)
    const file = share.mock.calls[0][0].files[0] as File
    expect(file.name).toMatch(/^practice-backup-.*\.json$/)
    expect(getLastBackupAt()).not.toBeNull()
  })

  it('returns false and records nothing when the share sheet is cancelled', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    expect(await exportData()).toBe(false)
    expect(getLastBackupAt()).toBeNull()
  })

  it('falls back to download when sharing fails for another reason', async () => {
    const { clicks } = stubDownload()
    const share = vi.fn().mockRejectedValue(new DOMException('nope', 'NotAllowedError'))
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    expect(await exportData()).toBe(true)
    expect(clicks).toHaveLength(1)
  })
})

describe('describeLastBackup', () => {
  const now = new Date('2026-09-27T19:00:00.000Z') // noon PDT Sep 27

  it('never backed up is stale', () => {
    expect(describeLastBackup(null, now)).toEqual({ text: 'Never backed up', stale: true })
  })

  it('today / yesterday / N days ago', () => {
    expect(describeLastBackup('2026-09-27T16:00:00.000Z', now)).toEqual({ text: 'Last backup: today', stale: false })
    expect(describeLastBackup('2026-09-26T16:00:00.000Z', now)).toEqual({ text: 'Last backup: yesterday', stale: false })
    expect(describeLastBackup('2026-09-17T16:00:00.000Z', now)).toEqual({ text: 'Last backup: 10 days ago', stale: false })
  })

  it('30 or more days is stale', () => {
    expect(describeLastBackup('2026-08-28T16:00:00.000Z', now).stale).toBe(true)
  })
})

describe('import: versions and saved filters', () => {
  it('accepts backups from before schemaVersion and savedFilters existed', () => {
    const old = { exportedAt: '2026-01-01T00:00:00.000Z', activities: [], items: [], logs: [] }
    expect(validateImportPayload(old)).toEqual({ ...old, savedFilters: [], invalidRecords: 0 })
  })

  it('rejects backups from a newer app version', () => {
    const newer = { app: 'practice-app', schemaVersion: 99, exportedAt: '', activities: [], items: [], logs: [], savedFilters: [] }
    expect(() => validateImportPayload(newer)).toThrow(NewerSchemaError)
  })

  it('imports saved filters with the new activity id', () => {
    const payload = makePayload({ activities: [makeActivity()], savedFilters: [makeFilter()] })
    executeImport(payload, new Map(), new Map())
    const act = getActivities()[0]
    expect(getSavedFilters(act.id).map(f => f.name)).toEqual(['Hard ones'])
    expect(getSavedFilters(act.id)[0].id).not.toBe('sf-1')
  })

  it('combine adds only saved filters whose name is new to the existing activity', () => {
    saveActivity(makeActivity({ id: 'existing' }))
    upsertSavedFilter(makeFilter({ id: 'mine', activityId: 'existing', name: 'Hard ones' }))
    const payload = makePayload({
      activities: [makeActivity()],
      savedFilters: [makeFilter(), makeFilter({ id: 'sf-2', name: 'Easy ones', expression: '"easy"' })],
    })
    executeImport(payload, new Map([['act-1', 'combine']]), new Map())
    expect(getSavedFilters('existing').map(f => f.name).sort()).toEqual(['Easy ones', 'Hard ones'])
  })

  it('keep-existing skips saved filters too', () => {
    saveActivity(makeActivity({ id: 'existing' }))
    executeImport(makePayload({ activities: [makeActivity()], savedFilters: [makeFilter()] }), new Map([['act-1', 'keep-existing']]), new Map())
    expect(getSavedFilters('existing')).toEqual([])
  })
})

describe('import: colour-edit records', () => {
  it('come along with their item but are not counted as reps', () => {
    const stats = executeImport(makePayload({
      activities: [makeActivity()],
      items: [makeItem()],
      logs: [makeLog({ id: 'l1' }), makeLog({ id: 'l2', source: 'edit' })],
    }), new Map(), new Map())
    expect(stats.logsAdded).toBe(1)
    expect(getLogs()).toHaveLength(2)
  })
})

describe('validateImportPayload: damaged records', () => {
  const file = (o: Record<string, unknown> = {}) => ({
    app: 'practice-app', schemaVersion: 1, exportedAt: '2026-10-01T00:00:00.000Z',
    activities: [makeActivity()], items: [makeItem()], logs: [makeLog()], savedFilters: [], ...o,
  })

  it('keeps valid records from an old backup', () => {
    const p = validateImportPayload({ activities: [makeActivity()], items: [makeItem()], logs: [makeLog()] })!
    expect(p.items).toHaveLength(1)
    expect(p.invalidRecords).toBe(0)
  })

  it('drops records with missing ids, unknown colours or bad dates, and counts them', () => {
    const p = validateImportPayload(file({
      items: [makeItem(), makeItem({ id: 'i2', color: 'blue' as never }), { name: 'no id' }],
      logs: [makeLog(), makeLog({ id: 'l2', practicedAt: 'yesterday' }), makeLog({ id: 'l3', colorAfter: 'purple' as never })],
      savedFilters: [{ id: 'f1', activityId: 'a', name: 'x' }],
    }))!
    expect(p.items).toHaveLength(1)
    expect(p.logs).toHaveLength(1)
    expect(p.savedFilters).toEqual([])
    expect(p.invalidRecords).toBe(5)
  })

  it('drops activities with bad weights or optional fields of the wrong type', () => {
    const p = validateImportPayload(file({
      activities: [makeActivity(), makeActivity({ id: 'a2', weights: { red: -1, yellow: 0, green: 0 } }), makeActivity({ id: 'a3', recencyBias: 'high' as never })],
    }))!
    expect(p.activities).toHaveLength(1)
    expect(p.invalidRecords).toBe(2)
  })

  it('rejects a file whose activities are all damaged', () => {
    expect(validateImportPayload(file({ activities: [{ id: 1 }] }))).toBeNull()
  })

  it('accepts a backup of an empty app', () => {
    expect(validateImportPayload(file({ activities: [], items: [], logs: [] }))).not.toBeNull()
  })

  it('reports skipped damaged records in the import stats', () => {
    const p = validateImportPayload(file({ logs: [makeLog(), { id: 'l2' }] }))!
    expect(executeImport(p, new Map(), new Map()).invalid).toBe(1)
  })
})

describe('planImport', () => {
  it('works out the import without saving anything', () => {
    saveActivity(makeActivity({ id: 'old', name: 'Juggling' }))
    const payload = validateImportPayload({ activities: [makeActivity({ id: 'new', name: 'Juggling' })], items: [], logs: [] })!
    const plan = planImport(payload, new Map([['new', 'replace']]), new Map())
    expect(plan.remove.activityIds).toEqual(['old'])
    expect(getActivities().map(a => a.id)).toEqual(['old'])
    applyImport(plan)
    expect(getActivities().map(a => a.name)).toEqual(['Juggling'])
    expect(getActivities()[0].id).not.toBe('old')
  })

  it('summarises what would be removed, counting reps only', () => {
    saveActivity(makeActivity({ id: 'old', name: 'Juggling' }))
    saveItem(makeItem({ id: 'i1', activityId: 'old', color: 'red' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1' }))
    saveItem(makeItem({ id: 'i1', activityId: 'old', color: 'green' })) // an edit, not a rep
    const payload = validateImportPayload({ activities: [makeActivity({ id: 'new', name: 'Juggling' })], items: [], logs: [] })!
    expect(removalSummary(planImport(payload, new Map([['new', 'replace']]), new Map())))
      .toEqual({ activities: ['Juggling'], items: 1, reps: 1 })
  })

  it('counts items replaced by "keep imported" in a combine', () => {
    saveActivity(makeActivity({ id: 'old', name: 'Juggling' }))
    saveItem(makeItem({ id: 'i1', activityId: 'old', name: 'Box' }))
    appendLog(makeLog({ id: 'l1', itemId: 'i1' }))
    const payload = validateImportPayload({
      activities: [makeActivity({ id: 'new', name: 'Juggling' })],
      items: [makeItem({ id: 'i9', activityId: 'new', name: 'Box' })],
      logs: [],
    })!
    const plan = planImport(payload, new Map([['new', 'combine']]), new Map([['i9', 'keep-imported']]))
    expect(removalSummary(plan)).toEqual({ activities: [], items: 1, reps: 1 })
  })
})

describe('validateImportPayload: draw settings', () => {
  it('keeps activities with valid work bias and rating memory, drops ones with nonsense values', () => {
    const p = validateImportPayload({
      activities: [
        makeActivity({ id: 'a1', workBias: 4, ratingMemory: 3 }),
        makeActivity({ id: 'a2', workBias: -1 }),
        makeActivity({ id: 'a3', ratingMemory: 0 }),
        makeActivity({ id: 'a4', workBias: 'lots' as never }),
      ],
      items: [], logs: [],
    })!
    expect(p.activities.map(a => a.id)).toEqual(['a1'])
    expect(p.invalidRecords).toBe(3)
  })
})
