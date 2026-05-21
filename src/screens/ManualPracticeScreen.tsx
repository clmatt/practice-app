import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getActivities, getItems, saveItem, appendLog, getNotesForItem } from '../storage'
import { generateId } from '../utils'
import type { Activity, Item, Color } from '../types'
import ColorDot from '../components/ColorDot'
import ColorPicker from '../components/ColorPicker'

type Phase = 'list' | 'rate'

export default function ManualPracticeScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()

  const [activity, setActivity] = useState<Activity | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [phase, setPhase] = useState<Phase>('list')
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [selectedColor, setSelectedColor] = useState<Color | null>(null)
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    const found = getActivities().find(a => a.id === activityId)
    if (!found) { navigate('/'); return }
    setActivity(found)
    setItems(getItems(activityId!))
  }, [activityId, navigate])

  if (!activity) return null

  const filtered = searchQuery.trim() === ''
    ? items
    : items.filter(item => item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
  const filteredItems = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

  function handleSelectItem(item: Item) {
    setSelectedItem(item)
    setSelectedColor(null)
    setNoteText('')
    setPhase('rate')
  }

  function handleSave() {
    if (!selectedItem || !selectedColor || !activityId) return

    const colorBefore = selectedItem.color
    const colorAfter = selectedColor
    const trimmedNote = noteText.trim()

    appendLog({
      id: generateId(),
      itemId: selectedItem.id,
      practicedAt: new Date().toISOString(),
      colorBefore,
      colorAfter,
      ...(trimmedNote ? { note: trimmedNote } : {}),
    })

    if (colorAfter !== colorBefore) {
      saveItem({ ...selectedItem, color: colorAfter })
    }

    setItems(getItems(activityId))
    setPhase('list')
    setSearchQuery('')
    setSelectedItem(null)
    setSelectedColor(null)
    setNoteText('')
  }

  function handleBack() {
    setPhase('list')
    setSelectedItem(null)
    setSelectedColor(null)
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
            <ColorDot color={selectedItem.color} size="md" />
            <span className="text-slate-400 text-sm capitalize">{selectedItem.color}</span>
          </div>
          <p className="text-slate-400 text-sm">How did it go?</p>
          {selectedItemNotes.length > 0 && (
            <div className="w-full max-h-36 overflow-y-auto flex flex-col gap-1.5">
              {selectedItemNotes.map(n => (
                <div key={n.practicedAt} className="bg-slate-800 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500 mb-0.5">
                    {new Date(n.practicedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-sm text-slate-300">{n.note}</p>
                </div>
              ))}
            </div>
          )}
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
          <button
            onClick={handleBack}
            className="bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold w-full"
          >
            Back
          </button>
        </div>
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

      <input
        type="text"
        placeholder={`Search ${activity.itemLabel}s`}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="bg-slate-800 rounded-xl px-4 py-3 outline-none text-sm w-full mb-4 shrink-0"
      />

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-slate-400 text-sm">No {activity.itemLabel}s yet</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-slate-400 text-sm">No {activity.itemLabel}s match your search.</p>
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
