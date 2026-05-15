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
      saveItem({ ...existingItem, name: name.trim(), color })
    } else {
      saveItem({
        id: generateId(),
        activityId: activityId!,
        name: name.trim(),
        color,
        createdAt: new Date().toISOString(),
      })
    }

    navigate(`/activity/${activityId}/manage`)
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
