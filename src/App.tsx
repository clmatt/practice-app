import { HashRouter, Routes, Route } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import ActivityDashboardScreen from './screens/ActivityDashboardScreen'
import PracticeSessionScreen from './screens/PracticeSessionScreen'
import ManageItemsScreen from './screens/ManageItemsScreen'
import AddEditItemScreen from './screens/AddEditItemScreen'
import ItemProgressScreen from './screens/ItemProgressScreen'
import StatsScreen from './screens/StatsScreen'
import HistoryScreen from './screens/HistoryScreen'

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 max-w-md mx-auto">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/activity/:activityId" element={<ActivityDashboardScreen />} />
          <Route path="/activity/:activityId/practice" element={<PracticeSessionScreen />} />
          <Route path="/activity/:activityId/manage" element={<ManageItemsScreen />} />
          <Route path="/activity/:activityId/manage/add" element={<AddEditItemScreen />} />
          <Route path="/activity/:activityId/manage/:itemId" element={<ItemProgressScreen />} />
          <Route path="/activity/:activityId/manage/:itemId/edit" element={<AddEditItemScreen />} />
          <Route path="/activity/:activityId/stats" element={<StatsScreen />} />
          <Route path="/activity/:activityId/history" element={<HistoryScreen />} />
        </Routes>
      </div>
    </HashRouter>
  )
}
