import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getActivities, getItems, saveItem, appendLog, undoPracticeLog, getTodayPracticedItemIds, getNotesForItem } from '../storage'
import { generateId } from '../utils'
import type { Activity, Item, Color } from '../types'
import ColorDot from '../components/ColorDot'
import ColorPicker from '../components/ColorPicker'
import AdvancedFilterModal from '../components/AdvancedFilterModal'
import UndoBar from '../components/UndoBar'
import { buildFilteredPool, drawFrom, tagsOf, type DrawResult } from '../autoPractice'

type Phase = 'setup' | 'draw' | 'rate' | 'done'

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

  const [activity] = useState<Activity | null>(() => getActivities().find(a => a.id === activityId) ?? null)
  const [items, setItems] = useState<Item[]>(() => (activity ? getItems(activity.id) : []))
  const allTags = useMemo(() => tagsOf(items), [items])
  // With no tags there is nothing to choose in setup, so draw the first item straight away.
  const [firstDraw] = useState<DrawResult | null>(() =>
    activity && items.length > 0 && tagsOf(items).length === 0
      ? drawFrom(activity, items, new Set(), null, new Set())
      : null)
  const [phase, setPhase] = useState<Phase>(() =>
    firstDraw === null ? 'setup' : firstDraw.kind === 'item' ? 'draw' : 'done')
  const [currentItem, setCurrentItem] = useState<Item | null>(() =>
    firstDraw?.kind === 'item' ? firstDraw.item : null)
  const [filterExhausted, setFilterExhausted] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [selectedColor, setSelectedColor] = useState<Color | null>(null)
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [sessionLog, setSessionLog] = useState<Array<{ name: string; colorBefore: Color; colorAfter: Color }>>([])
  const [skippedItemIds, setSkippedItemIds] = useState<Set<string>>(new Set())
  const [noteText, setNoteText] = useState('')
  const [advancedFilter, setAdvancedFilter] = useState<string | null>(null)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [lastSaved, setLastSaved] = useState<{ logId: string; name: string } | null>(null)
  const clearLastSaved = useCallback(() => setLastSaved(null), [])

  useEffect(() => {
    if (!activity) navigate('/')
    else if (items.length === 0) navigate(`/activity/${activity.id}`)
  }, [activity, items.length, navigate])

  function drawNextItem(skipped: Set<string> = skippedItemIds) {
    if (!activity) return
    const freshItems = getItems(activity.id)
    setItems(freshItems)
    const result = drawFrom(activity, freshItems, activeTags, advancedFilter, skipped)
    if (result.kind === 'item') {
      setCurrentItem(result.item)
      setPhase('draw')
      setRevealed(false)
      setSelectedColor(null)
    } else {
      setFilterExhausted(result.kind === 'filter-exhausted')
      setPhase('done')
      setCurrentItem(null)
    }
  }

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

    const logId = generateId()
    appendLog({
      id: logId,
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
    setLastSaved({ logId, name: currentItem.name })
    setNoteText('')
    drawNextItem()
  }

  const handleUndo = () => {
    if (!lastSaved || !activity) return
    undoPracticeLog(lastSaved.logId)
    setLastSaved(null)
    setSessionLog(prev => prev.slice(0, -1))
    // The undone item can be drawn again; if the session had ended, bring it back.
    if (phase === 'done') drawNextItem()
    else setItems(getItems(activity.id))
  }

  const handleBackToDraw = () => {
    setPhase('draw')
    setNoteText('')
  }

  const handleExit = () => {
    if (activityId) navigate(`/activity/${activityId}`)
    else navigate('/')
  }

  if (!activity || items.length === 0) return null

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

      {lastSaved && (
        <UndoBar key={lastSaved.logId} message={`Saved "${lastSaved.name}"`} onUndo={handleUndo} onExpire={clearLastSaved} />
      )}

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
