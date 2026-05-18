import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ColorDot from '../components/ColorDot'
import { getActivities, getItems } from '../storage'
import type { Activity, Item } from '../types'

export default function ManageItemsScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()

  const [activity, setActivity] = useState<Activity | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const found = getActivities().find(a => a.id === activityId)
    if (!found) {
      navigate('/')
      return
    }
    setActivity(found)
    setItems(getItems(activityId!))
  }, [activityId, navigate])

  if (!activity) return null

  const label = activity.itemLabel

  const filteredItems = searchQuery.trim() === ''
    ? items
    : items.filter(item => item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))

  return (
    <div className="p-4 bg-slate-950 text-slate-100 min-h-screen">
      <Link to={`/activity/${activityId}`} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Manage {label}s</h1>
        <button
          onClick={() => navigate(`/activity/${activityId}/manage/add`)}
          className="bg-violet-600 hover:bg-violet-500 rounded-xl px-4 py-2 text-sm font-semibold"
        >
          + Add {label}
        </button>
      </div>

      <input
        type="text"
        placeholder={`Search ${label}s`}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="bg-slate-800 rounded-xl px-4 py-3 outline-none text-sm w-full mb-4"
      />

      {items.length === 0 ? (
        <p className="text-slate-400 text-sm">No {label}s yet</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-slate-400 text-sm">No {label}s match your search.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filteredItems.map(item => (
            <li key={item.id}>
              <Link
                to={`/activity/${activityId}/manage/${item.id}/edit`}
                className="bg-slate-800 rounded-xl px-4 py-3 flex flex-col gap-2 block"
              >
                <div className="flex items-center gap-3">
                  <ColorDot color={item.color} size="md" />
                  <span className="flex-1 text-sm">{item.name}</span>
                  <span className="text-violet-400 text-sm">›</span>
                </div>
                {(item.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(item.tags ?? []).map(tag => (
                      <span key={tag} className="bg-slate-700 rounded-full px-2 py-0.5 text-xs text-slate-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
