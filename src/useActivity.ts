import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getActivities } from './storage'
import type { Activity } from './types'

/** The activity named in the route, read once when the screen opens. Redirects Home if it doesn't exist. */
export function useActivity(): [Activity | null, Dispatch<SetStateAction<Activity | null>>] {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const [activity, setActivity] = useState<Activity | null>(() => getActivities().find(a => a.id === activityId) ?? null)
  useEffect(() => {
    if (!activity) navigate('/')
  }, [activity, navigate])
  return [activity, setActivity]
}
