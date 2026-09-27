import { useLocation, useNavigate } from 'react-router-dom'
import { getActiveTab } from '../tabs'

interface TabBarProps {
  activityId: string
  activityName?: string
}

function GridIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  )
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
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

export default function TabBar({ activityId, activityName = '' }: TabBarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = getActiveTab(pathname, activityId)

  const inactive = 'text-slate-500'
  const activeClass = 'text-violet-400'

  return (
    <div
      className="shrink-0 relative z-10 bg-slate-900 border-t border-slate-800 pb-3"
    >
      <div className="flex items-end">
        <button
          onClick={() => navigate('/')}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 ${active === 'activities' ? activeClass : inactive}`}
        >
          <GridIcon />
          <span className="text-[10px] font-medium">Activities</span>
        </button>

        <button
          onClick={() => navigate(`/activity/${activityId}`)}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 ${active === 'dashboard' ? activeClass : inactive}`}
        >
          <HomeIcon />
          <span className="text-[10px] font-medium max-w-[4.5rem] truncate">{activityName || 'Home'}</span>
        </button>

        <button
          onClick={() => navigate(`/activity/${activityId}/practice-chooser`)}
          className={`flex-1 flex flex-col items-center justify-center pb-2 gap-1 ${active === 'practice' ? activeClass : inactive}`}
        >
          <div className="bg-violet-600 rounded-2xl p-2 -mt-4 text-white">
            <PlayIcon />
          </div>
          <span className="text-xs font-medium">Practice</span>
        </button>

        <button
          onClick={() => navigate(`/activity/${activityId}/manage`)}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 ${active === 'items' ? activeClass : inactive}`}
        >
          <ListIcon />
          <span className="text-[10px] font-medium">Items</span>
        </button>

        <button
          onClick={() => navigate(`/activity/${activityId}/stats`)}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 ${active === 'stats' ? activeClass : inactive}`}
        >
          <BarChartIcon />
          <span className="text-[10px] font-medium">Stats</span>
        </button>
      </div>
    </div>
  )
}
