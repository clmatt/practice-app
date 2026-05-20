import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getActivities, getItems } from '../storage'
import type { Activity, Item } from '../types'
import TabBar from '../components/TabBar'

export default function PracticeChooserScreen() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    if (!activityId) { navigate('/'); return }
    const a = getActivities().find(a => a.id === activityId)
    if (!a) { navigate('/'); return }
    setActivity(a)
    setItems(getItems(activityId))
  }, [activityId, navigate])

  if (!activity) return null

  const hasItems = items.length > 0

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100">
      <div className="flex-1 min-h-0 flex flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold mb-2">Practice</h1>

        {!hasItems && (
          <p className="text-slate-400 text-sm mb-2">
            Add some {activity.itemLabel}s first to start practicing.
          </p>
        )}

        <button
          onClick={() => navigate(`/activity/${activityId}/practice`)}
          disabled={!hasItems}
          className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl p-5 text-left disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="font-bold text-lg">Auto Practice</div>
          <div className="text-sm text-violet-200 mt-1">Items drawn based on your weights</div>
        </button>

        <button
          onClick={() => navigate(`/activity/${activityId}/manual-practice`)}
          disabled={!hasItems}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl p-5 text-left disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="font-bold text-lg">Manual Practice</div>
          <div className="text-sm text-slate-400 mt-1">Choose items yourself</div>
        </button>
      </div>

      <TabBar activityId={activityId!} activityName={activity.name} />
    </div>
  )
}
