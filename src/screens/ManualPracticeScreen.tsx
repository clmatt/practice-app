import { useCallback, useState } from 'react'
import { useActivity } from '../useActivity'
import { useTapGuard } from '../useTapGuard'
import { useParams, useNavigate } from 'react-router-dom'
import { getActiveItems, recordPractice, undoPracticeLog, getNotesForItem } from '../storage'
import type { Item, Color } from '../types'
import ColorDot from '../components/ColorDot'
import RatePanel from '../components/RatePanel'
import NoteList from '../components/NoteList'
import UndoBar from '../components/UndoBar'
import { compareNatural } from '../sorting'
import { pluralLabel } from '../labels'

type Phase = 'list' | 'rate'

export default function ManualPracticeScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()

  const [activity] = useActivity()
  const [items, setItems] = useState<Item[]>(() => (activityId ? getActiveItems(activityId) : []))
  const [searchQuery, setSearchQuery] = useState('')
  const [phase, setPhase] = useState<Phase>('list')
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [tapsReady, rearmTaps] = useTapGuard()
  const [noteText, setNoteText] = useState('')
  const [lastSaved, setLastSaved] = useState<{ logId: string; name: string } | null>(null)
  const clearLastSaved = useCallback(() => setLastSaved(null), [])

  if (!activity) return null

  const filtered = searchQuery.trim() === ''
    ? items
    : items.filter(item => item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
  const filteredItems = [...filtered].sort((a, b) => compareNatural(a.name, b.name))

  function handleSelectItem(item: Item) {
    setSelectedItem(item)
    setNoteText('')
    setPhase('rate')
    rearmTaps()
  }

  /** One tap on a color: save the rep (with any note) and go back to the list. */
  function handleRate(color: Color) {
    if (!selectedItem || !activityId) return

    const logId = recordPractice({ item: selectedItem, color, note: noteText })
    setItems(getActiveItems(activityId))
    setLastSaved({ logId, name: selectedItem.name })
    setPhase('list')
    setSearchQuery('')
    setSelectedItem(null)
    setNoteText('')
  }

  function handleUndo() {
    if (!lastSaved || !activityId) return
    undoPracticeLog(lastSaved.logId)
    setLastSaved(null)
    setItems(getActiveItems(activityId))
  }

  function handleBack() {
    setPhase('list')
    setSelectedItem(null)
    setNoteText('')
  }

  const selectedItemNotes = selectedItem ? getNotesForItem(selectedItem.id) : []

  if (phase === 'rate' && selectedItem) {
    return (
      <div className="p-4 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
        <button onClick={handleBack} className="text-slate-400 text-sm mb-4 block">
          ← Back
        </button>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-3xl font-bold text-center">{selectedItem.name}</p>
          <div className="flex items-center gap-2">
            <ColorDot color={selectedItem.color} size="md" decorative />
            <span className="text-slate-400 text-sm capitalize">{selectedItem.color}</span>
          </div>
          <p className="text-slate-400 text-sm">How did it go?</p>
          <NoteList notes={selectedItemNotes} compact />
        </div>

        <RatePanel note={noteText} onNoteChange={setNoteText} onRate={handleRate} ready={tapsReady} />
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      <button
        onClick={() => navigate(`/activity/${activityId}`)}
        className="text-slate-400 text-sm mb-4 block shrink-0"
      >
        ← Back
      </button>

      <h1 className="text-xl font-bold mb-4 shrink-0">Manual Practice</h1>

      {lastSaved && (
        <UndoBar key={lastSaved.logId} message={`Saved "${lastSaved.name}"`} onUndo={handleUndo} onExpire={clearLastSaved} />
      )}

      <input
        type="text"
        placeholder={`Search ${pluralLabel(activity)}`}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="bg-slate-800 rounded-xl px-4 py-3 outline-hidden text-sm w-full mb-4 shrink-0"
      />

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-slate-400 text-sm">No {pluralLabel(activity)} yet</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-slate-400 text-sm">No {pluralLabel(activity)} match your search.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filteredItems.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => handleSelectItem(item)}
                  className="bg-slate-800 rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
                >
                  <ColorDot color={item.color} size="md" />
                  <span className="flex-1 text-sm">{item.name}</span>
                  <span className="text-violet-400 text-sm">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
