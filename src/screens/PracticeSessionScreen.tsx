import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getActivities, getItems, saveItem, appendLog, getTodayPracticedItemIds } from '../storage'
import { selectItem } from '../selection'
import { generateId } from '../utils'
import type { Activity, Item, Color } from '../types'
import ColorDot from '../components/ColorDot'
import ColorPicker from '../components/ColorPicker'

type Phase = 'setup' | 'draw' | 'rate' | 'done'

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

  // Load activity and items on mount
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

  const drawNextItem = useCallback(() => {
    if (!activity || !activityId) return
    const freshItems = getItems(activityId)
    setItems(freshItems)
    const todayPracticed = getTodayPracticedItemIds(activityId)
    const filtered = activeTags.size === 0
      ? freshItems
      : freshItems.filter(i => (i.tags ?? []).some(t => activeTags.has(t)))
    const next = selectItem(filtered, todayPracticed, activity.weights)
    if (next === null) {
      setPhase('done')
      setCurrentItem(null)
    } else {
      setCurrentItem(next)
      setPhase('draw')
      setRevealed(false)
      setSelectedColor(null)
    }
  }, [activity, activityId, activeTags])

  // Draw first item once activity and items are loaded
  useEffect(() => {
    if (activity && items.length > 0 && phase === 'draw' && currentItem === null) {
      drawNextItem()
    }
  }, [activity, items, phase, currentItem, drawNextItem])

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
    drawNextItem()
  }

  const handleSave = () => {
    if (!currentItem || !selectedColor || !activityId) return

    const colorBefore = currentItem.color
    const colorAfter = selectedColor

    appendLog({
      id: generateId(),
      itemId: currentItem.id,
      practicedAt: new Date().toISOString(),
      colorBefore,
      colorAfter,
    })

    if (colorAfter !== colorBefore) {
      saveItem({ ...currentItem, color: colorAfter })
    }

    drawNextItem()
  }

  const handleBackToDraw = () => {
    setPhase('draw')
  }

  const handleExit = () => {
    if (activityId) navigate(`/activity/${activityId}`)
    else navigate('/')
  }

  if (!activity) return null

  return (
    <div className="p-4 flex flex-col min-h-screen">
      {/* Header with exit button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={handleExit}
          className="text-slate-500 hover:text-slate-300 text-sm"
        >
          Exit
        </button>
      </div>

      {/* Phase: setup */}
      {phase === 'setup' && (
        <div className="flex flex-col flex-1 gap-6">
          <div className="flex-1 flex flex-col justify-center gap-4">
            <h2 className="text-xl font-bold">What are you focusing on?</h2>
            <p className="text-slate-400 text-sm">Select tags to filter, or start with everything.</p>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
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
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={drawNextItem}
              className="bg-violet-600 hover:bg-violet-500 rounded-xl py-4 font-bold text-lg w-full"
            >
              {activeTags.size > 0 ? 'Start with selected' : 'Start — practice all'}
            </button>
          </div>
        </div>
      )}

      {/* Phase: done */}
      {phase === 'done' && (
        <div className="flex flex-col items-center justify-center flex-1 gap-6">
          <p className="text-2xl font-bold text-center text-slate-100">
            All done! No more {activity.itemLabel}s to practice today.
          </p>
          <button
            onClick={() => navigate(`/activity/${activityId}`)}
            className="bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold w-full"
          >
            Back to {activity.name}
          </button>
        </div>
      )}

      {/* Phase: draw */}
      {phase === 'draw' && currentItem && (
        <div className="flex flex-col flex-1 gap-6">
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activeTags.has(tag)
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-700 text-slate-300'
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
              <button
                onClick={() => setRevealed(true)}
                className="text-slate-400 text-sm underline"
              >
                Tap to reveal previous rating
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleIPracticed}
              className="bg-violet-600 hover:bg-violet-500 rounded-xl py-4 font-bold text-lg w-full"
            >
              I practiced it
            </button>
            <button
              onClick={handleSkip}
              className="text-slate-400 text-sm text-center"
            >
              Skip without rating
            </button>
          </div>
        </div>
      )}

      {/* Phase: rate */}
      {phase === 'rate' && currentItem && (
        <div className="flex flex-col flex-1 gap-6">
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-3xl font-bold text-center">{currentItem.name}</p>
            <p className="text-slate-400 text-sm">How did it go?</p>
          </div>

          <div className="flex flex-col gap-4">
            <ColorPicker value={selectedColor} onChange={setSelectedColor} />

            <button
              onClick={handleSave}
              disabled={selectedColor === null}
              className="bg-violet-600 hover:bg-violet-500 rounded-xl py-4 font-bold text-lg w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>

            <button
              onClick={handleBackToDraw}
              className="bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold w-full"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
