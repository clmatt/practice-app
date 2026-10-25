import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useActivity } from '../useActivity'
import { useTapGuard } from '../useTapGuard'
import { getItems, getActiveItems, recordPractice, undoPracticeLog, getTodayPracticedItemIds, getNotesForItem } from '../storage'
import { toggled } from '../utils'
import { localDateKey } from '../dates'
import { loadSession, saveSession, clearSession, type SessionEntry } from '../sessionResume'
import { RATING_ORDER } from '../palette'
import type { Item, Color } from '../types'
import ColorDot from '../components/ColorDot'
import RatePanel from '../components/RatePanel'
import NoteList from '../components/NoteList'
import AdvancedFilterModal from '../components/AdvancedFilterModal'
import UndoBar from '../components/UndoBar'
import {
  buildFilteredPool, describeFilter, drawFrom, isFiltering, practiceWeights, tagsOf, type PracticeFilter,
} from '../autoPractice'
import ToggleChip from '../components/ToggleChip'
import TagList from '../components/TagList'

// 'next-filter' is the filter step between items: same screen as setup, for the next draw.
type Phase = 'setup' | 'next-filter' | 'draw' | 'done'

interface SetupPhaseProps {
  allTags: string[]
  filter: PracticeFilter
  /** Choosing the filter for the item after this one, mid-session, rather than starting. */
  forNextItem: boolean
  onToggleTag: (tag: string) => void
  onToggleColor: (color: Color) => void
  onOpenFilterModal: () => void
  onStart: () => void
}

function SetupPhase({ allTags, filter, forNextItem, onToggleTag, onToggleColor, onOpenFilterModal, onStart }: SetupPhaseProps) {
  const { tags: activeTags, colors, advanced: advancedFilter } = filter
  const startLabel = forNextItem
    ? 'Next item'
    : advancedFilter ? 'Start with filter' : isFiltering(filter) ? 'Start with selected' : 'Start — practice all'
  const hint = allTags.length === 0
    ? 'Pick colors to filter, or start with everything.'
    : forNextItem ? 'Adjust the colors and tags, or keep them as they are.' : 'Pick colors or tags to filter, or start with everything.'
  return (
    <div className="flex flex-col flex-1 gap-6">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center gap-4">
        <h2 className="text-xl font-bold">{forNextItem ? 'Filter for next item' : 'What are you focusing on?'}</h2>
        {!advancedFilter && <p className="text-slate-400 text-sm">{hint}</p>}
        <div className="flex flex-wrap gap-2">
          {RATING_ORDER.map(color => (
            <ToggleChip key={color} size="md" selected={colors.has(color)} onClick={() => onToggleColor(color)}>
              <ColorDot color={color} size="sm" decorative />
              <span className="capitalize">{color}</span>
            </ToggleChip>
          ))}
        </div>
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
        ) : allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <ToggleChip key={tag} size="md" selected={activeTags.has(tag)} onClick={() => onToggleTag(tag)}>
                {tag}
              </ToggleChip>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {!advancedFilter && allTags.length > 0 && (
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
          {startLabel}
        </button>
      </div>
    </div>
  )
}

/** One line saying what's being drawn from, with a way to change it. */
function FilterLine({ filter, onChange }: { filter: PracticeFilter; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 w-full text-xs mb-2">
      <span className="text-slate-500 truncate">Filter: {describeFilter(filter)}</span>
      <button onClick={onChange} className="text-violet-400 font-medium shrink-0">Change</button>
    </div>
  )
}


interface FilterExhaustedDoneProps {
  filter: PracticeFilter
  onChangeFilter: () => void
  onEndSession: () => void
}

function FilterExhaustedDone({ filter, onChangeFilter, onEndSession }: FilterExhaustedDoneProps) {
  const { tags: activeTags, colors, advanced: advancedFilter } = filter
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-xl font-bold text-slate-100">All done with your current filter.</p>
        {colors.size > 0 && (
          <div className="flex flex-wrap justify-center gap-3">
            {RATING_ORDER.filter(c => colors.has(c)).map(c => (
              <span key={c} className="flex items-center gap-1.5 text-xs text-slate-300 capitalize">
                <ColorDot color={c} size="sm" decorative />
                {c}
              </span>
            ))}
          </div>
        )}
        {advancedFilter ? (
          <p className="text-xs text-slate-400 font-mono bg-slate-800 px-3 py-2 rounded-lg">{advancedFilter}</p>
        ) : activeTags.size > 0 && (
          <TagList tags={[...activeTags]} className="justify-center" />
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
  sessionLog: SessionEntry[]
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

  const [activity] = useActivity()
  const [items, setItems] = useState<Item[]>(() => (activity ? getActiveItems(activity.id) : []))
  const allTags = useMemo(() => tagsOf(items), [items])
  // A session from earlier today (the app was closed or reloaded mid-session) carries on.
  const [resumed] = useState(() => (activity ? loadSession(activity.id) : null))
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set(resumed?.tags ?? []))
  const [activeColors, setActiveColors] = useState<Set<Color>>(() => new Set(resumed?.colors ?? []))
  const [advancedFilter, setAdvancedFilter] = useState<string | null>(() => resumed?.advanced ?? null)
  const [sessionLog, setSessionLog] = useState<SessionEntry[]>(() => resumed?.sessionLog ?? [])
  const [skippedItemIds, setSkippedItemIds] = useState<Set<string>>(() => new Set(resumed?.skipped ?? []))
  // Where a resumed session picks up: its item if still due, otherwise the next draw.
  const [start] = useState<{ phase: Phase; item: Item | null; exhausted: boolean }>(() => {
    if (!activity || !resumed) return { phase: 'setup', item: null, exhausted: false }
    const active = getActiveItems(activity.id)
    const saved = active.find(i => i.id === resumed.currentItemId)
    if (saved && !getTodayPracticedItemIds(activity.id).has(saved.id) && !resumed.skipped.includes(saved.id)) {
      return { phase: 'draw', item: saved, exhausted: false }
    }
    const savedFilter = { tags: new Set(resumed.tags), colors: new Set(resumed.colors), advanced: resumed.advanced }
    const result = drawFrom(activity, active, savedFilter, new Set(resumed.skipped))
    return result.kind === 'item'
      ? { phase: 'draw', item: result.item, exhausted: false }
      : { phase: 'done', item: null, exhausted: result.kind === 'filter-exhausted' }
  })
  const [phase, setPhase] = useState<Phase>(start.phase)
  const [currentItem, setCurrentItem] = useState<Item | null>(start.item)
  const [filterExhausted, setFilterExhausted] = useState(start.exhausted)
  const [revealed, setRevealed] = useState(false)
  const [tapsReady, rearmTaps] = useTapGuard()
  const [noteText, setNoteText] = useState('')
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [lastSaved, setLastSaved] = useState<{ logId: string; name: string } | null>(null)
  const clearLastSaved = useCallback(() => setLastSaved(null), [])
  const filter: PracticeFilter = { tags: activeTags, colors: activeColors, advanced: advancedFilter }

  useEffect(() => {
    if (activity && items.length === 0) navigate(`/activity/${activity.id}`)
  }, [activity, items.length, navigate])

  /** Saves the session so it survives the app restarting. Takes new values explicitly: state updates aren't visible yet. */
  function remember(next: { log?: SessionEntry[]; skipped?: Set<string>; currentItemId: string | null }) {
    if (!activity) return
    saveSession(activity.id, {
      day: localDateKey(new Date()),
      tags: [...activeTags],
      colors: [...activeColors],
      advanced: advancedFilter,
      skipped: [...(next.skipped ?? skippedItemIds)],
      sessionLog: next.log ?? sessionLog,
      currentItemId: next.currentItemId,
    })
  }

  function drawNextItem({ skipped = skippedItemIds, log = sessionLog }: { skipped?: Set<string>; log?: SessionEntry[] } = {}) {
    if (!activity) return
    const freshItems = getActiveItems(activity.id)
    setItems(freshItems)
    const result = drawFrom(activity, freshItems, filter, skipped)
    remember({ log, skipped, currentItemId: result.kind === 'item' ? result.item.id : null })
    if (result.kind === 'item') {
      setCurrentItem(result.item)
      setPhase('draw')
      setRevealed(false)
      rearmTaps()
    } else {
      setFilterExhausted(result.kind === 'filter-exhausted')
      setPhase('done')
      setCurrentItem(null)
    }
  }

  const handleSkip = () => {
    if (!currentItem) return
    const updated = new Set([...skippedItemIds, currentItem.id])
    setSkippedItemIds(updated)
    drawNextItem({ skipped: updated })
  }

  /** One tap on a color: save the rep (with any note) and move on. */
  const handleRate = (colorAfter: Color) => {
    if (!currentItem || !activityId) return

    const colorBefore = getItems(currentItem.activityId).find(i => i.id === currentItem.id)?.color ?? currentItem.color
    const logId = recordPractice({ item: currentItem, color: colorAfter, note: noteText })

    const log = [...sessionLog, { name: currentItem.name, colorBefore, colorAfter }]
    setSessionLog(log)
    setLastSaved({ logId, name: currentItem.name })
    setNoteText('')
    if (activity?.chooseFilterEachItem) openFilterStep(log)
    else drawNextItem({ log })
  }

  /** Pick the filter for the next draw; the current item (if any) goes back in the pool. */
  function openFilterStep(log: SessionEntry[] = sessionLog) {
    setCurrentItem(null)
    setPhase('next-filter')
    remember({ log, currentItemId: null })
  }

  const handleUndo = () => {
    if (!lastSaved || !activity) return
    undoPracticeLog(lastSaved.logId)
    setLastSaved(null)
    const log = sessionLog.slice(0, -1)
    setSessionLog(log)
    // The undone item can be drawn again; if the session had ended, bring it back.
    if (phase === 'done') drawNextItem({ log })
    else {
      setItems(getActiveItems(activity.id))
      remember({ log, currentItemId: currentItem?.id ?? null })
    }
  }

  /** Leaving on purpose ends the session (a reload or the app closing doesn't). */
  const handleExit = () => {
    if (activity) clearSession(activity.id)
    navigate(`/activity/${activityId}`)
  }

  if (!activity || items.length === 0) return null

  const pastNotes = currentItem ? getNotesForItem(currentItem.id) : []
  // Items of a 0%-weight color never come up, so they don't count towards "done".
  const weights = practiceWeights(activity.weights, activeColors)
  const sessionPool = buildFilteredPool(items, filter).filter(i => weights[i.color] > 0)
  const sessionTotal = sessionPool.length
  const practicedToday = activityId ? getTodayPracticedItemIds(activityId) : new Set<string>()
  const todayDoneCount = sessionPool.filter(i => practicedToday.has(i.id)).length

  return (
    <div className="p-4 flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        {(phase === 'draw' || phase === 'next-filter') ? (
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

      {(phase === 'setup' || phase === 'next-filter') && (
        <SetupPhase
          allTags={allTags}
          filter={filter}
          forNextItem={phase === 'next-filter'}
          onToggleTag={tag => setActiveTags(prev => toggled(prev, tag))}
          onToggleColor={color => setActiveColors(prev => toggled(prev, color))}
          onOpenFilterModal={() => setShowFilterModal(true)}
          onStart={() => drawNextItem()}
        />
      )}

      {phase === 'done' && filterExhausted && (
        <FilterExhaustedDone
          filter={filter}
          onChangeFilter={() => setPhase('setup')}
          onEndSession={() => setFilterExhausted(false)}
        />
      )}

      {phase === 'done' && !filterExhausted && (
        <SessionCompleteDone
          sessionLog={sessionLog}
          activityName={activity.name}
          onNavigateBack={handleExit}
        />
      )}

      {phase === 'draw' && currentItem && (
        <div className="flex flex-col flex-1 gap-6">
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <FilterLine filter={filter} onChange={openFilterStep} />

            <p className="text-3xl font-bold text-center">{currentItem.name}</p>
            <TagList tags={currentItem.tags} className="justify-center" />

            {revealed ? (
              <div className="flex items-center gap-2">
                <ColorDot color={currentItem.color} size="md" decorative />
                <span className="text-slate-400 text-sm capitalize">{currentItem.color}</span>
              </div>
            ) : (
              <button onClick={() => setRevealed(true)} className="text-slate-400 text-sm underline">
                Tap to reveal previous rating
              </button>
            )}

            <NoteList notes={pastNotes} compact />
          </div>

          <div className="flex flex-col gap-3">
            <RatePanel note={noteText} onNoteChange={setNoteText} onRate={handleRate} ready={tapsReady} />
            <button onClick={handleSkip} className="text-slate-400 text-sm text-center py-1">
              Skip without rating
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
