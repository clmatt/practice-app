export type Tab = 'activities' | 'dashboard' | 'practice' | 'items' | 'stats'

export function getActiveTab(pathname: string, activityId: string): Tab {
  const base = `/activity/${activityId}`
  const path = pathname.split('?')[0]
  if (path === '/') return 'activities'
  if (path.startsWith(`${base}/practice-chooser`)) return 'practice'
  if (path.startsWith(`${base}/manage`)) return 'items'
  if (path.startsWith(`${base}/stats`)) return 'stats'
  return 'dashboard'
}
