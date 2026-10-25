import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useActivity } from '../useActivity'
import { getItems, getLogs, getNotesForItem, saveItem, deleteItemWithLogs } from '../storage'
import { formatDateKey, formatLongDate } from '../dates'
import TabBar from '../components/TabBar'
import { buildRuns, repsToGreen } from '../itemRuns'
import { isRep } from '../logs'
import TagList from '../components/TagList'
import NoteList from '../components/NoteList'
import { RATING_COLORS, ratingName } from '../palette'

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) => formatDateKey(d, { month: 'short', day: 'numeric' })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}

export default function ItemProgressScreen() {
  const { activityId, itemId } = useParams<{ activityId: string; itemId: string }>()
  const navigate = useNavigate()

  const [activity] = useActivity()
  const [item, setItem] = useState(() => (activity ? getItems(activity.id).find(i => i.id === itemId) ?? null : null))

  useEffect(() => {
    // A deleted item sends you back to the list (useActivity handles an unknown activity).
    if (activity && !item) navigate(`/activity/${activityId}/manage`, { replace: true })
  }, [activity, item, activityId, navigate])

  if (!activity || !item) return null

  function handleUnarchive() {
    const restored = { ...item!, archivedAt: undefined }
    saveItem(restored)
    setItem(restored)
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${item!.name}" and its practice history? This cannot be undone.`)) return
    deleteItemWithLogs(item!.id)
    navigate(`/activity/${activityId}/manage`, { replace: true })
  }

  const logs = getLogs().filter(l => l.itemId === itemId)
  const runs = buildRuns(logs)
  const toGreen = repsToGreen(logs)
  const totalReps = logs.filter(isRep).length
  const notes = getNotesForItem(itemId!)

  return (
    <div className="h-full overflow-hidden flex flex-col bg-slate-950 text-slate-100">
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="text-xl font-bold">{item.name}</h1>
          <button
            onClick={() => navigate(`/activity/${activityId}/manage/${item.id}/edit`)}
            className="shrink-0 bg-slate-800 hover:bg-slate-700 rounded-xl px-4 py-1.5 text-sm font-semibold"
          >
            Edit
          </button>
        </div>
        <p className="text-slate-400 text-sm mb-2">
          <span style={{ color: RATING_COLORS[item.color] }}>●</span>{' '}
          Currently {item.color}
          {totalReps > 0 && ` · ${totalReps} rep${totalReps === 1 ? '' : 's'} total`}
        </p>
        {toGreen !== null && (
          <p className="text-slate-500 text-xs -mt-1 mb-2">Turned green after {toGreen} rep{toGreen === 1 ? '' : 's'}.</p>
        )}
        <TagList tags={item.tags} className="mb-2" />
        {item.archivedAt && (
          <div className="bg-slate-800 rounded-xl px-4 py-3 mb-2 flex flex-col gap-2">
            <p className="text-sm text-slate-300">Archived on {formatLongDate(item.archivedAt)}</p>
            <div className="flex gap-2">
              <button onClick={handleUnarchive} className="flex-1 bg-violet-600 hover:bg-violet-500 rounded-lg py-2 text-sm font-semibold">
                Unarchive
              </button>
              <button onClick={handleDelete} className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg py-2 text-sm text-red-300">
                Delete permanently
              </button>
            </div>
          </div>
        )}
        <div className="mb-2" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {runs.length === 0 ? (
          <p className="text-slate-400 text-sm">No practice recorded yet.</p>
        ) : (
          <div className="flex gap-4">
            {/* Vertical color bar */}
            <div className="flex flex-col w-3 rounded-full overflow-hidden flex-shrink-0">
              {runs.map((run, i) => (
                <div
                  key={i}
                  style={{
                    height: `${Math.max(run.count, 0.5) * 48}px`,
                    backgroundColor: RATING_COLORS[run.color],
                    boxShadow: i === runs.length - 1 ? `0 0 8px ${RATING_COLORS[run.color]}88` : undefined,
                  }}
                />
              ))}
            </div>

            {/* Run labels */}
            <div className="flex flex-col flex-1">
              {runs.map((run, i) => {
                const isCurrent = i === runs.length - 1
                return (
                  <div
                    key={i}
                    className="flex flex-col justify-center"
                    style={{ height: `${Math.max(run.count, 0.5) * 48}px` }}
                  >
                    <span className="text-sm font-semibold" style={{ color: RATING_COLORS[run.color] }}>
                      {ratingName(run.color)}
                      {isCurrent && <span className="text-slate-500 font-normal"> · current</span>}
                    </span>
                    <span className="text-xs text-slate-500">
                      {run.edited && 'Set manually · '}
                      {run.count > 0 && `${run.count} rep${run.count === 1 ? '' : 's'} · `}
                      {formatDateRange(run.startDate, run.endDate)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {notes.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Notes</h2>
            <NoteList notes={notes} />
          </div>
        )}
      </div>

      <TabBar activityId={activityId!} activityName={activity.name} />
    </div>
  )
}
