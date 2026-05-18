import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ColorPicker from '../components/ColorPicker'
import { getActivities, getItems, saveItem } from '../storage'
import { generateId } from '../utils'
import type { Activity, Color, Item } from '../types'

export default function AddEditItemScreen() {
  const { activityId, itemId } = useParams<{ activityId: string; itemId?: string }>()
  const navigate = useNavigate()
  const isEditing = Boolean(itemId)

  const [activity, setActivity] = useState<Activity | null>(null)
  const [existingItem, setExistingItem] = useState<Item | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<Color | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const found = getActivities().find(a => a.id === activityId)
    if (!found) {
      navigate('/')
      return
    }
    setActivity(found)

    if (itemId) {
      const item = getItems(activityId!).find(i => i.id === itemId)
      if (!item) {
        navigate(`/activity/${activityId}/manage`)
        return
      }
      setExistingItem(item)
      setName(item.name)
      setColor(item.color)
      setTags(item.tags ?? [])
    }
  }, [activityId, itemId, navigate])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (!color) {
      setError('Please select a color.')
      return
    }

    if (isEditing && existingItem) {
      saveItem({ ...existingItem, name: name.trim(), color, tags })
    } else {
      saveItem({
        id: generateId(),
        activityId: activityId!,
        name: name.trim(),
        color,
        tags,
        createdAt: new Date().toISOString(),
      })
    }

    navigate(`/activity/${activityId}/manage`)
  }

  function addTag() {
    const trimmed = tagInput.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags(tags.filter(t => t !== tag))
  }

  if (!activity) return null

  const label = activity.itemLabel

  return (
    <div className="p-4 bg-slate-950 text-slate-100 min-h-screen">
      <Link to={`/activity/${activityId}/manage`} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>

      <h1 className="text-xl font-bold mb-6">
        {isEditing ? `Edit ${label}` : `Add ${label}`}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder={`${label} name`}
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          className="rounded-xl px-4 py-3 outline-none text-sm w-full bg-slate-800"
        />

        <ColorPicker value={color} onChange={c => { setColor(c); setError('') }} />

        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Add tag, press Enter"
            value={tagInput}
            autoCapitalize="words"
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag()
              }
            }}
            className="bg-slate-800 rounded-xl px-4 py-3 outline-none text-sm w-full"
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-slate-700 rounded-full px-3 py-1 text-xs">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-slate-400 hover:text-white">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          className="bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold w-full"
        >
          {isEditing ? 'Save changes' : `Add ${label}`}
        </button>
      </form>
    </div>
  )
}
