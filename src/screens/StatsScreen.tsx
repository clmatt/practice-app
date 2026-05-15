import { Link, useParams } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import ColorDot from '../components/ColorDot'
import {
  getActivities,
  getItems,
  getColorDistributionByDay,
  getPracticeCountByItem,
  getLastPracticedByItem,
} from '../storage'

function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function StatsScreen() {
  const { activityId = '' } = useParams<{ activityId: string }>()

  const activities = getActivities()
  const activity = activities.find(a => a.id === activityId)

  const chartData = getColorDistributionByDay(activityId)
  const items = getItems(activityId)
  const practiceCounts = getPracticeCountByItem(activityId)
  const lastPracticed = getLastPracticedByItem(activityId)

  const sortedItems = [...items].sort(
    (a, b) => (practiceCounts[a.id] ?? 0) - (practiceCounts[b.id] ?? 0)
  )

  const itemLabel = activity?.itemLabel ?? 'item'
  const title = activity ? `${activity.name} Stats` : 'Stats'

  return (
    <div className="p-4">
      <Link to={`/activity/${activityId}`} className="text-slate-400 text-sm mb-4 block">
        ← Back
      </Link>

      <h1 className="text-lg font-bold mb-4">{title}</h1>

      {/* Area Chart */}
      <h2 className="text-base font-semibold mb-2">Color Distribution</h2>
      {chartData.length === 0 ? (
        <p className="text-slate-400 text-sm mb-6">No practice data yet.</p>
      ) : (
        <div className="mb-6">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid stroke="#334155" />
              <XAxis
                dataKey="date"
                tickFormatter={(val: string) => val.slice(5)}
              />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="red"
                stackId="a"
                stroke="#ef4444"
                fill="#ef4444"
              />
              <Area
                type="monotone"
                dataKey="yellow"
                stackId="a"
                stroke="#eab308"
                fill="#eab308"
              />
              <Area
                type="monotone"
                dataKey="green"
                stackId="a"
                stroke="#22c55e"
                fill="#22c55e"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-item table */}
      <h2 className="text-base font-semibold mb-2">Items</h2>
      {sortedItems.length === 0 ? (
        <p className="text-slate-400 text-sm">No {itemLabel}s yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs text-slate-400 pb-2">Name</th>
              <th className="text-left text-xs text-slate-400 pb-2">Color</th>
              <th className="text-left text-xs text-slate-400 pb-2">Practices</th>
              <th className="text-left text-xs text-slate-400 pb-2">Last Practiced</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map(item => {
              const count = practiceCounts[item.id] ?? 0
              const last = lastPracticed[item.id]
              const lastStr = last ? formatShortDate(last.slice(0, 10)) : 'Never'
              return (
                <tr key={item.id}>
                  <td className="py-2 border-t border-slate-800">{item.name}</td>
                  <td className="py-2 border-t border-slate-800">
                    <ColorDot color={item.color} size="sm" />
                  </td>
                  <td className="py-2 border-t border-slate-800">{count}</td>
                  <td className="py-2 border-t border-slate-800">{lastStr}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
