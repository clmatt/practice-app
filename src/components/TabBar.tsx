import { useLocation, useNavigate } from 'react-router-dom'

interface TabBarProps {
  activityId: string
}

export type Tab = 'home' | 'practice' | 'items' | 'stats'

export function getActiveTab(pathname: string, activityId: string): Tab {
  const base = `/activity/${activityId}`
  const path = pathname.split('?')[0]
  if (path.startsWith(`${base}/manage`)) return 'items'
  if (path.startsWith(`${base}/stats`)) return 'stats'
  if (path.startsWith(`${base}/practice-chooser`)) return 'practice'
  return 'home'
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function BarChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

const TABS = [
  { id: 'home' as Tab, label: 'Home', icon: HomeIcon },
  { id: 'practice' as Tab, label: 'Practice', icon: PlayIcon },
  { id: 'items' as Tab, label: 'Items', icon: ListIcon },
  { id: 'stats' as Tab, label: 'Stats', icon: BarChartIcon },
]

export default function TabBar({ activityId }: TabBarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = getActiveTab(pathname, activityId)

  const routes: Record<Tab, string> = {
    home: `/activity/${activityId}`,
    practice: `/activity/${activityId}/practice-chooser`,
    items: `/activity/${activityId}/manage`,
    stats: `/activity/${activityId}/stats`,
  }

  return (
    <div
      className="shrink-0 bg-slate-900 border-t border-slate-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => navigate(routes[id])}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 ${
              active === id ? 'text-violet-400' : 'text-slate-500'
            }`}
          >
            <Icon />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
