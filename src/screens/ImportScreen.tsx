import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

const DOT: Record<Color, string> = {
  red: '#dc2626',
  yellow: '#eab308',
  green: '#22c55e',
}

type WizardStep = 'select' | 'activity' | 'item' | 'summary'

export default function ImportScreen() {
  const navigate = useNavigate()
  const [step, setStep] = useState<WizardStep>('select')
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<ImportPayload | null>(null)
  const [actConflicts, setActConflicts] = useState<Activity[]>([])
  const [actIdx, setActIdx] = useState(0)
  const [actResolutions, setActResolutions] = useState<Map<string, ActivityResolution>>(new Map())
  const [selectedActRes, setSelectedActRes] = useState<ActivityResolution>('keep-existing')
  const [applyActAll, setApplyActAll] = useState(false)
  const [itemConflicts, setItemConflicts] = useState<ItemConflict[]>([])
  const [itemIdx, setItemIdx] = useState(0)
  const [itemResolutions, setItemResolutions] = useState<Map<string, ItemResolution>>(new Map())
  const [selectedItemRes, setSelectedItemRes] = useState<ItemResolution>('keep-existing')
  const [applyItemAll, setApplyItemAll] = useState(false)
  const [stats, setStats] = useState<ImportStats | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target!.result as string)
        const parsed = validateImportPayload(raw)
        if (!parsed) {
          setError("This doesn't look like a valid backup file.")
          return
        }
        setError(null)
        const conflicts = findActivityConflicts(parsed.activities, getActivities())
        if (conflicts.length === 0) {
          setStats(executeImport(parsed, new Map(), new Map()))
          setStep('summary')
          return
        }
        setPayload(parsed)
        setActConflicts(conflicts)
        setActIdx(0)
        setSelectedActRes('keep-existing')
        setApplyActAll(false)
        setStep('activity')
      } catch {
        setError("This doesn't look like a valid backup file.")
      }
    }
    reader.readAsText(file)
  }

  function finishActivityConflicts(resolutions: Map<string, ActivityResolution>) {
    const existByName = new Map(getActivities().map(a => [a.name, a]))
    const queue: ItemConflict[] = []
    for (const impAct of (payload?.activities ?? [])) {
      if (resolutions.get(impAct.id) !== 'combine') continue
      const existAct = existByName.get(impAct.name)!
      const impItems = (payload?.items ?? []).filter(i => i.activityId === impAct.id)
      queue.push(...findItemConflicts(impAct, existAct, impItems, getItems(existAct.id)))
    }
    if (queue.length === 0) {
      setStats(executeImport(payload!, resolutions, new Map()))
      setStep('summary')
    } else {
      setItemConflicts(queue)
      setItemIdx(0)
      setSelectedItemRes('keep-existing')
      setApplyItemAll(false)
      setItemResolutions(new Map())
      setStep('item')
    }
  }

  function handleActContinue() {
    const next = new Map(actResolutions)
    if (applyActAll) {
      for (let i = actIdx; i < actConflicts.length; i++) next.set(actConflicts[i].id, selectedActRes)
      setActResolutions(next)
      finishActivityConflicts(next)
    } else {
      next.set(actConflicts[actIdx].id, selectedActRes)
      setActResolutions(next)
      if (actIdx + 1 < actConflicts.length) {
        setActIdx(actIdx + 1)
        setSelectedActRes('keep-existing')
        setApplyActAll(false)
      } else {
        finishActivityConflicts(next)
      }
    }
  }

  function handleItemContinue() {
    const next = new Map(itemResolutions)
    if (applyItemAll) {
      for (let i = itemIdx; i < itemConflicts.length; i++) next.set(itemConflicts[i].importedItem.id, selectedItemRes)
      setItemResolutions(next)
      setStats(executeImport(payload!, actResolutions, next))
      setStep('summary')
    } else {
      next.set(itemConflicts[itemIdx].importedItem.id, selectedItemRes)
      setItemResolutions(next)
      if (itemIdx + 1 < itemConflicts.length) {
        setItemIdx(itemIdx + 1)
        setSelectedItemRes('keep-existing')
        setApplyItemAll(false)
      } else {
        setStats(executeImport(payload!, actResolutions, next))
        setStep('summary')
      }
    }
  }

  const currentActConflict = step === 'activity' && payload ? actConflicts[actIdx] : null
  const existActForConflict = currentActConflict
    ? getActivities().find(a => a.name === currentActConflict.name) ?? null
    : null
  const currentItemConflict = step === 'item' ? itemConflicts[itemIdx] : null

  return (
    <div className="p-4 bg-slate-950 text-slate-100 min-h-screen">

      {/* ── Step 1: File select ── */}
      {step === 'select' && (
        <>
          <Link to="/" className="text-slate-400 text-sm mb-6 block">← Back</Link>
          <h1 className="text-xl font-bold mb-2">Import data</h1>
          <p className="text-slate-400 text-sm mb-6">
            Select a backup file exported from Practice App.
          </p>
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <label className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold text-center block cursor-pointer">
            Choose file
            <input type="file" accept=".json" className="hidden" onChange={handleFile} />
          </label>
        </>
      )}

      {/* ── Step 2: Activity conflict ── */}
      {step === 'activity' && payload && currentActConflict && existActForConflict && (
        <>
          <h1 className="text-xl font-bold mb-1">Import data</h1>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-500">
              Activity conflict {actIdx + 1} of {actConflicts.length}
            </span>
            <div className="flex-1 h-0.5 bg-slate-800 rounded">
              <div
                className="h-full bg-violet-500 rounded transition-all"
                style={{ width: `${((actIdx + 1) / actConflicts.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 mb-4">
            <div className="font-semibold mb-3">{currentActConflict.name}</div>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Existing</div>
                <div className="text-sm text-slate-300">
                  {getItems(existActForConflict.id).length} items ·{' '}
                  {Object.values(getPracticeCountByItem(existActForConflict.id)).reduce((a, b) => a + b, 0)} sessions
                </div>
              </div>
              <div className="w-px bg-slate-700" />
              <div className="flex-1">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Importing</div>
                <div className="text-sm text-slate-300">
                  {payload.items.filter(i => i.activityId === currentActConflict.id).length} items ·{' '}
                  {payload.logs.filter(l =>
                    payload.items.some(i => i.activityId === currentActConflict.id && i.id === l.itemId)
                  ).length} sessions
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-4">
            {(['keep-existing', 'replace', 'keep-both', 'combine'] as ActivityResolution[]).map(res => (
              <button
                key={res}
                onClick={() => setSelectedActRes(res)}
                className={`text-left rounded-xl px-4 py-3 border ${
                  selectedActRes === res
                    ? 'bg-violet-950 border-violet-500'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className={`text-sm font-semibold ${selectedActRes === res ? 'text-violet-300' : ''}`}>
                  {res === 'keep-existing' ? 'Keep existing'
                    : res === 'replace' ? 'Replace with imported'
                    : res === 'keep-both' ? 'Keep both'
                    : 'Combine'}
                </div>
                <div className={`text-xs mt-0.5 ${selectedActRes === res ? 'text-violet-400' : 'text-slate-500'}`}>
                  {res === 'keep-existing' ? 'Ignore the imported version entirely'
                    : res === 'replace' ? 'Overwrite existing with the imported version'
                    : res === 'keep-both'
                      ? `Add imported as "${currentActConflict.name} (imported)" alongside existing`
                      : 'Merge items into existing activity — resolve item conflicts next'}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setApplyActAll(v => !v)}
            className="flex items-center gap-3 w-full bg-slate-800 rounded-xl px-4 py-3 mb-4"
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 ${
              applyActAll ? 'bg-violet-600 border-violet-600' : 'border-slate-500'
            }`}>
              {applyActAll && <span className="text-white text-xs leading-none">✓</span>}
            </div>
            <span className="text-sm text-slate-300">Apply to all remaining activity conflicts</span>
          </button>

          <button
            onClick={handleActContinue}
            className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold"
          >
            Continue →
          </button>
        </>
      )}

      {/* ── Step 3: Item conflict ── */}
      {step === 'item' && currentItemConflict && (
        <>
          <h1 className="text-xl font-bold mb-1">Import data — {
            payload?.activities.find(a =>
              payload.items.find(i => i.id === currentItemConflict.importedItem.id)?.activityId === a.id
            )?.name
          }</h1>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-500">
              Item conflict {itemIdx + 1} of {itemConflicts.length}
            </span>
            <div className="flex-1 h-0.5 bg-slate-800 rounded">
              <div
                className="h-full bg-violet-500 rounded transition-all"
                style={{ width: `${((itemIdx + 1) / itemConflicts.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 mb-4">
            <div className="font-semibold mb-3">{currentItemConflict.importedItem.name}</div>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Existing</div>
                <div className="flex items-center gap-1.5 text-sm text-slate-300">
                  <span style={{ color: DOT[currentItemConflict.existingItem.color] }}>●</span>
                  {currentItemConflict.existingItem.color} ·{' '}
                  {getLogs().filter(l => l.itemId === currentItemConflict.existingItem.id).length} sessions
                </div>
              </div>
              <div className="w-px bg-slate-700" />
              <div className="flex-1">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Importing</div>
                <div className="flex items-center gap-1.5 text-sm text-slate-300">
                  <span style={{ color: DOT[currentItemConflict.importedItem.color] }}>●</span>
                  {currentItemConflict.importedItem.color} ·{' '}
                  {payload!.logs.filter(l => l.itemId === currentItemConflict.importedItem.id).length} sessions
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-4">
            {(['keep-existing', 'keep-imported', 'keep-both'] as ItemResolution[]).map(res => (
              <button
                key={res}
                onClick={() => setSelectedItemRes(res)}
                className={`text-left rounded-xl px-4 py-3 border ${
                  selectedItemRes === res
                    ? 'bg-violet-950 border-violet-500'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className={`text-sm font-semibold ${selectedItemRes === res ? 'text-violet-300' : ''}`}>
                  {res === 'keep-existing' ? 'Keep existing'
                    : res === 'keep-imported' ? 'Keep imported'
                    : 'Keep both'}
                </div>
                <div className={`text-xs mt-0.5 ${selectedItemRes === res ? 'text-violet-400' : 'text-slate-500'}`}>
                  {res === 'keep-existing'
                    ? 'Keep existing item and its history. Discard imported version.'
                    : res === 'keep-imported'
                    ? 'Use imported item. Discard existing history.'
                    : `Add imported as a second "${currentItemConflict.importedItem.name}" with its own history.`}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setApplyItemAll(v => !v)}
            className="flex items-center gap-3 w-full bg-slate-800 rounded-xl px-4 py-3 mb-4"
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 ${
              applyItemAll ? 'bg-violet-600 border-violet-600' : 'border-slate-500'
            }`}>
              {applyItemAll && <span className="text-white text-xs leading-none">✓</span>}
            </div>
            <span className="text-sm text-slate-300">Apply to all remaining item conflicts</span>
          </button>

          <button
            onClick={handleItemContinue}
            className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold"
          >
            Continue →
          </button>
        </>
      )}

      {/* ── Step 4: Summary ── */}
      {step === 'summary' && stats && (
        <>
          <Link to="/" className="text-slate-400 text-sm mb-6 block">← Home</Link>
          <h1 className="text-xl font-bold mb-4">Import complete.</h1>
          {stats.activitiesAdded === 0 && stats.itemsAdded === 0 && stats.logsAdded === 0 ? (
            <p className="text-slate-400 text-sm">Nothing to import.</p>
          ) : (
            <div className="flex flex-col gap-1 text-sm text-slate-300">
              {stats.activitiesAdded > 0 && (
                <p>{stats.activitiesAdded} {stats.activitiesAdded === 1 ? 'activity' : 'activities'} added</p>
              )}
              {stats.itemsAdded > 0 && (
                <p>{stats.itemsAdded} {stats.itemsAdded === 1 ? 'item' : 'items'} added</p>
              )}
              {stats.logsAdded > 0 && (
                <p>{stats.logsAdded} {stats.logsAdded === 1 ? 'session' : 'sessions'} imported</p>
              )}
              {stats.skipped > 0 && (
                <p>{stats.skipped} skipped</p>
              )}
            </div>
          )}
          <button
            onClick={() => navigate('/')}
            className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold mt-6"
          >
            Done
          </button>
        </>
      )}

    </div>
  )
}
