import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getActivities, getItems, saveItem, appendLog, getTodayPracticedItemIds, getLastPracticedByItem, getNotesForItem } from '../storage'
import { selectItem } from '../selection'
import { generateId } from '../utils'
import type { Activity, Item, Color } from '../types'
import ColorDot from '../components/ColorDot'
import ColorPicker from '../components/ColorPicker'
import AdvancedFilterModal from '../components/AdvancedFilterModal'
import { parseFilter, evaluateFilter } from '../filterParser'

type Phase = 'setup' | 'draw' | 'rate' | 'done'

function buildFilteredPool(items: Item[], activeTags: Set<string>, advancedFilter: string | null): Item[] {
  if (advancedFilter) {
    const ast = parseFilter(advancedFilter)
    return typeof ast === 'string' ? [] : items.filter(i => evaluateFilter(ast, i.tags ?? []))
  }
  return activeTags.size === 0
    ? items
    : items.filter(i => (i.tags ?? []).some(t => activeTags.has(t)))
}

interface SetupPhaseProps {
  allTags: string[]
  activeTags: Set<string>
  advancedFilter: string | null
  onToggleTag: (tag: string) => void
  onOpenFilterModal: () => void
  onStart: () => void
}

function SetupPhase({ allTags, activeTags, advancedFilter, onToggleTag, onOpenFilterModal, onStart }: SetupPhaseProps) {
  return (
    <div className="flex flex-col flex-1 gap-6">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center gap-4">
        <h2 className="text-xl font-bold">What are you focusing on?</h2>
        {advancedFilter ? (
          <>
            <p className="text-slate-400 text-sm">Advanced filter active.</p>
            <button
              onClick={onOpenFilterModal}
              className="flex items-center justify-between bg-slate-800 border border-violet-600 rounded-xl px-4 py-3 w-full"
            >
              <span className="text-violet-400 text-sm font-mono text-left truncate">⚡ {advancedFilter}</span>
              <span className="text-slate-400 text-xs ml-2 shrink-0">edit</span>
            </button>
          </>
        ) : (
          <>
            <p className="text-slate-400 text-sm">Select tags to filter, or start with everything.</p>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => onToggleTag(tag)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    activeTags.has(tag)
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {!advancedFilter && (
          <button
            onClick={onOpenFilterModal}
            className="bg-transparent border border-slate-600 hover:border-violet-500 text-slate-400 hover:text-violet-400 rounded-xl py-3 text-sm w-full transition-colors"
          >
            ⚡ Advanced Filter
          </button>
        )}
        <button
          onClick={onStart}
          className="bg-violet-600 hover:bg-violet-500 rounded-xl py-4 font-bold text-lg w-full"
        >
          {advancedFilter ? 'Start with filter' : activeTags.size > 0 ? 'Start with selected' : 'Start — practice all'}
        </button>
      </div>
    </div>
  )
}

interface FilterExhaustedDoneProps {
  advancedFilter: string | null
  activeTags: Set<string>
  onChangeFilter: () => void
  onEndSession: () => void
}

function FilterExhaustedDone({ advancedFilter, activeTags, onChangeFilter, onEndSession }: FilterExhaustedDoneProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-xl font-bold text-slate-100">All done with your current filter.</p>
        {advancedFilter ? (
          <p className="text-xs text-slate-400 font-mono bg-slate-800 px-3 py-2 rounded-lg">{advancedFilter}</p>
        ) : activeTags.size > 0 && (
          <div className="flex flex-wrap gap-2 justify-center">
            {[...activeTags].map(tag => (
              <span key={tag} className="bg-slate-700 rounded-full px-3 py-1 text-xs text-slate-300">{tag}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 w-full">
        <button onClick={onChangeFilter} className="bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold w-full">
          Change filter
        </button>
        <button onClick={onEndSession} className="bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold w-full">
          End session
        </button>
      </div>
    </div>
  )
}

interface SessionCompleteDoneProps {
  sessionLog: Array<{ name: string; colorBefore: Color; colorAfter: Color }>
  activityName: string
  onNavigateBack: () => void
}

function SessionCompleteDone({ sessionLog, activityName, onNavigateBack }: SessionCompleteDoneProps) {
  return (
    <div className="flex flex-col flex-1 gap-6">
      <div className="flex-1 flex flex-col justify-center gap-4">
        <h2 className="text-lg font-semibold mb-2">Session complete</h2>
        <p className="text-slate-400 text-sm">
          You practiced {sessionLog.length} {sessionLog.length === 1 ? 'item' : 'items'}
        </p>
        {sessionLog.some(e => e.colorBefore !== e.colorAfter) ? (
          <div>
            <h3 className="text-lg font-semibold mb-2">Changes</h3>
            <div className="flex flex-col">
              {sessionLog
                .filter(e => e.colorBefore !== e.colorAfter)
                .map((e, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <span className="text-slate-200 text-sm">{e.name}</span>
                    <ColorDot color={e.colorBefore} size="sm" />
                    <span className="text-slate-400 text-sm">→</span>
                    <ColorDot color={e.colorAfter} size="sm" />
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">No ratings changed</p>
        )}
      </div>
      <button onClick={onNavigateBack} className="bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold w-full">
        Back to {activityName}
      </button>
    </div>
  )
}

export default function PracticeSessionScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()

  const [activity, setActivity] = useState<Activity | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [phase, setPhase] = useState<Phase>('setup')
  const [currentItem, setCurrentItem] = useState<Item | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [selectedColor, setSelectedColor] = useState<Color | null>(null)
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [allTags, setAllTags] = useState<string[]>([])
  const [sessionLog, setSessionLog] = useState<Array<{ name: string; colorBefore: Color; colorAfter: Color }>>([])
  const [filterExhausted, setFilterExhausted] = useState(false)
  const [skippedItemIds, setSkippedItemIds] = useState<Set<string>>(new Set())
  const [noteText, setNoteText] = useState('')
  const [advancedFilter, setAdvancedFilter] = useState<string | null>(null)
  const [showFilterModal, setShowFilterModal] = useState(false)

  useEffect(() => {
    if (!activityId) {
      navigate('/')
      return
    }
    const activities = getActivities()
    const found = activities.find(a => a.id === activityId)
    if (!found) {
      navigate('/')
      return
    }
    setActivity(found)
    const loadedItems = getItems(activityId)
    if (loadedItems.length === 0) {
      navigate(`/activity/${activityId}`)
      return
    }
    setItems(loadedItems)
    const tags = [...new Set(loadedItems.flatMap(i => i.tags ?? []))].sort()
    setAllTags(tags)
    setActiveTags(new Set())
    setPhase(tags.length > 0 ? 'setup' : 'draw')
  }, [activityId, navigate])

  const drawNextItem = useCallback((skipped: Set<string> = skippedItemIds) => {
    if (!activity || !activityId) return
    const freshItems = getItems(activityId)
    setItems(freshItems)
    const todayPracticed = getTodayPracticedItemIds(activityId)
    const excluded = new Set([...todayPracticed, ...skipped])
    const lastPracticedAt = getLastPracticedByItem(activityId)
    const recencyBias = activity.recencyBias ?? 0.9

    const filtered = buildFilteredPool(freshItems, activeTags, advancedFilter)
    const next = selectItem(filtered, excluded, activity.weights, recencyBias, lastPracticedAt)
    if (next === null) {
      if (activeTags.size > 0 || advancedFilter) {
        const nextUnfiltered = selectItem(freshItems, excluded, activity.weights, recencyBias, lastPracticedAt)
        if (nextUnfiltered !== null) {
          setFilterExhausted(true)
          setPhase('done')
          setCurrentItem(null)
          return
        }
      }
      setFilterExhausted(false)
      setPhase('done')
      setCurrentItem(null)
    } else {
      setCurrentItem(next)
      setPhase('draw')
      setRevealed(false)
      setSelectedColor(null)
    }
  }, [activity, activityId, activeTags, skippedItemIds, advancedFilter])

  useEffect(() => {
    if (activity && items.length > 0 && phase === 'draw' && currentItem === null) {
      drawNextItem()
    }
  }, [activity, items, phase, currentItem, drawNextItem])

  function formatNoteDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  function toggleTag(tag: string) {
    setActiveTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const handleIPracticed = () => {
    setPhase('rate')
    setSelectedColor(null)
  }

  const handleSkip = () => {
    if (!currentItem) return
    const updated = new Set([...skippedItemIds, currentItem.id])
    setSkippedItemIds(updated)
    drawNextItem(updated)
  }

  const handleSave = () => {
    if (!currentItem || !selectedColor || !activityId) return

    const colorBefore = currentItem.color
    const colorAfter = selectedColor
    const trimmedNote = noteText.trim()

    appendLog({
      id: generateId(),
      itemId: currentItem.id,
      practicedAt: new Date().toISOString(),
      colorBefore,
      colorAfter,
      ...(trimmedNote ? { note: trimmedNote } : {}),
    })

    if (colorAfter !== colorBefore) {
      saveItem({ ...currentItem, color: colorAfter })
    }

    setSessionLog(prev => [...prev, { name: currentItem.name, colorBefore, colorAfter }])
    setNoteText('')
    drawNextItem()
  }

  const handleBackToDraw = () => {
    setPhase('draw')
    setNoteText('')
  }

  const handleExit = () => {
    if (activityId) navigate(`/activity/${activityId}`)
    else navigate('/')
  }

  if (!activity) return null

  const pastNotes = currentItem ? getNotesForItem(currentItem.id) : []
  const filteredPool = buildFilteredPool(items, activeTags, advancedFilter)
  const sessionTotal = filteredPool.length
  const practicedToday = activityId ? getTodayPracticedItemIds(activityId) : new Set<string>()
  const todayDoneCount = filteredPool.filter(i => practicedToday.has(i.id)).length

  return (
    <div className="p-4 flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        {(phase === 'draw' || phase === 'rate') ? (
          <div className="flex flex-col">
            <span className="text-slate-400 text-sm">{todayDoneCount} / {sessionTotal} done</span>
            {skippedItemIds.size > 0 && (
              <span className="text-slate-500 text-xs">{skippedItemIds.size} skipped this session</span>
            )}
          </div>
        ) : (
          <span />
        )}
        <button onClick={handleExit} className="text-slate-500 hover:text-slate-300 text-sm">
          Exit
        </button>
      </div>

      {phase === 'setup' && (
        <SetupPhase
          allTags={allTags}
          activeTags={activeTags}
          advancedFilter={advancedFilter}
          onToggleTag={toggleTag}
          onOpenFilterModal={() => setShowFilterModal(true)}
          onStart={() => drawNextItem()}
        />
      )}

      {phase === 'done' && filterExhausted && (
        <FilterExhaustedDone
          advancedFilter={advancedFilter}
          activeTags={activeTags}
          onChangeFilter={() => setPhase('setup')}
          onEndSession={() => setFilterExhausted(false)}
        />
      )}

      {phase === 'done' && !filterExhausted && (
        <SessionCompleteDone
          sessionLog={sessionLog}
          activityName={activity.name}
          onNavigateBack={() => navigate(`/activity/${activityId}`)}
        />
      )}

      {phase === 'draw' && currentItem && (
        <div className="flex flex-col flex-1 gap-6">
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {advancedFilter ? (
              <button
                onClick={() => setShowFilterModal(true)}
                className="flex items-center justify-between bg-slate-800 border border-violet-600 rounded-xl px-3 py-2 w-full mb-2"
              >
                <span className="text-violet-400 text-xs font-mono text-left truncate">⚡ {advancedFilter}</span>
                <span className="text-slate-400 text-xs ml-2 shrink-0">edit</span>
              </button>
            ) : allTags.length > 0 && (
              <div className="flex gap-2 mb-2 overflow-x-auto w-full pb-1">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activeTags.has(tag) ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            <p className="text-3xl font-bold text-center">{currentItem.name}</p>

            {revealed ? (
              <div className="flex items-center gap-2">
                <ColorDot color={currentItem.color} size="md" />
                <span className="text-slate-400 text-sm capitalize">{currentItem.color}</span>
              </div>
            ) : (
              <button onClick={() => setRevealed(true)} className="text-slate-400 text-sm underline">
                Tap to reveal previous rating
              </button>
            )}

            {pastNotes.length > 0 && (
              <div className="w-full max-h-36 overflow-y-auto flex flex-col gap-1.5">
                {pastNotes.map(n => (
                  <div key={n.practicedAt} className="bg-slate-800 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500 mb-0.5">{formatNoteDate(n.practicedAt)}</p>
                    <p className="text-sm text-slate-300">{n.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={handleIPracticed} className="bg-violet-600 hover:bg-violet-500 rounded-xl py-4 font-bold text-lg w-full">
              I practiced it
            </button>
            <button onClick={handleSkip} className="text-slate-400 text-sm text-center">
              Skip without rating
            </button>
          </div>
        </div>
      )}

      {phase === 'rate' && currentItem && (
        <div className="flex flex-col flex-1 gap-6">
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {advancedFilter ? (
              <button
                onClick={() => setShowFilterModal(true)}
                className="flex items-center justify-between bg-slate-800 border border-violet-600 rounded-xl px-3 py-2 w-full mb-2"
              >
                <span className="text-violet-400 text-xs font-mono text-left truncate">⚡ {advancedFilter}</span>
                <span className="text-slate-400 text-xs ml-2 shrink-0">edit</span>
              </button>
            ) : allTags.length > 0 && (
              <div className="flex gap-2 mb-2 overflow-x-auto w-full pb-1">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activeTags.has(tag) ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
            <p className="text-3xl font-bold text-center">{currentItem.name}</p>
            <p className="text-slate-400 text-sm">How did it go?</p>
          </div>

          <div className="flex flex-col gap-4">
            <ColorPicker value={selectedColor} onChange={setSelectedColor} />
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a note (optional)"
              rows={2}
              className="bg-slate-800 rounded-xl px-4 py-3 text-sm w-full outline-none resize-none text-slate-100 placeholder:text-slate-500"
            />
            <button
              onClick={handleSave}
              disabled={selectedColor === null}
              className="bg-violet-600 hover:bg-violet-500 rounded-xl py-4 font-bold text-lg w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button onClick={handleBackToDraw} className="bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold w-full">
              Back
            </button>
          </div>
        </div>
      )}

      {showFilterModal && (
        <AdvancedFilterModal
          activityId={activityId!}
          allTags={allTags}
          items={items}
          initialExpression={advancedFilter ?? ''}
          onApply={expr => {
            setAdvancedFilter(expr)
            setShowFilterModal(false)
          }}
          onClose={() => setShowFilterModal(false)}
        />
      )}
    </div>
  )
}
