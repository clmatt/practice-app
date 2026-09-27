import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import ActivityDashboardScreen from './screens/ActivityDashboardScreen'
import PracticeSessionScreen from './screens/PracticeSessionScreen'
import ManualPracticeScreen from './screens/ManualPracticeScreen'
import ManageItemsScreen from './screens/ManageItemsScreen'
import AddEditItemScreen from './screens/AddEditItemScreen'
import ItemProgressScreen from './screens/ItemProgressScreen'
import ImportScreen from './screens/ImportScreen'
import PracticeChooserScreen from './screens/PracticeChooserScreen'
import ErrorBoundary from './components/ErrorBoundary'
import StorageErrorBanner from './components/StorageErrorBanner'

// Stats pulls in the charting library (most of the bundle); load it on demand.
const StatsScreen = lazy(() => import('./screens/StatsScreen'))

export default function App() {
  return (
    <HashRouter>
      <div className="h-screen overflow-hidden bg-slate-950 text-slate-100 max-w-md mx-auto" style={{ paddingTop: 'env(safe-area-inset-top)', height: '100dvh' }}>
        <StorageErrorBanner />
        <ErrorBoundary>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/activity/:activityId" element={<ActivityDashboardScreen />} />
              <Route path="/activity/:activityId/practice-chooser" element={<PracticeChooserScreen />} />
              <Route path="/activity/:activityId/practice" element={<PracticeSessionScreen />} />
              <Route path="/activity/:activityId/manual-practice" element={<ManualPracticeScreen />} />
              <Route path="/activity/:activityId/manage" element={<ManageItemsScreen />} />
              <Route path="/activity/:activityId/manage/add" element={<AddEditItemScreen />} />
              <Route path="/activity/:activityId/manage/:itemId" element={<ItemProgressScreen />} />
              <Route path="/activity/:activityId/manage/:itemId/edit" element={<AddEditItemScreen />} />
              <Route path="/activity/:activityId/stats" element={<StatsScreen />} />
              <Route path="/import" element={<ImportScreen />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </HashRouter>
  )
}
