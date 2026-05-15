import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ColorDot from '../components/ColorDot'
import { getActivities, getItems, deleteItem } from '../storage'
import type { Activity, Item } from '../types'

export default function ManageItemsScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()

  const [activity, setActivity] = useState<Activity | null>(null)
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    const found = getActivities().find(a => a.id === activityId)
    if (!found) {
      navigate('/')
      return
    }
    setActivity(found)
    setItems(getItems(activityId!))
  }, [activityId, navigate])

  function handleDelete(itemId: string) {
    deleteItem(itemId)
    setItems(getItems(activityId!))
  }

  if (!activity) return null

  const label = activity.itemLabel

  return (
    <div className="p-4 bg-slate-950 text-slate-100 min-h-screen">
      <Link to={`/activity/${activityId}`} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>

      <h1 className="text-xl font-bold mb-4">
        Manage {label}s
      </h1>

      {items.length === 0 ? (
        <p className="text-slate-400 text-sm mb-6">No {label}s yet</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-6">
          {items.map(item => (
            <li key={item.id} className="bg-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
              <ColorDot color={item.color} size="md" />
              <span className="flex-1 text-sm">{item.name}</span>
              <Link
                to={`/activity/${activityId}/manage/${item.id}/edit`}
                className="text-violet-400 text-sm hover:text-violet-300"
              >
                Edit
              </Link>
              <button
                onClick={() => handleDelete(item.id)}
                className="text-red-400 text-sm hover:text-red-300"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => navigate(`/activity/${activityId}/manage/add`)}
        className="bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold w-full"
      >
        Add {label}
      </button>
    </div>
  )
}
