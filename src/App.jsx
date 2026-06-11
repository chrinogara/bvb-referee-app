import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { BottomNav } from './components/layout/BottomNav'
import { ToastContainer } from './components/ui/Toast'
import { LanguageGateProvider } from './context/LanguageGate'
import { OfflineBanner } from './components/OfflineBanner'
import { useOfflineSync } from './hooks/useOfflineSync'

import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Referees from './pages/Referees'
import RefereeProfile from './pages/RefereeProfile'
import Tournaments from './pages/Tournaments'
import TournamentDetail from './pages/TournamentDetail'
import Assignments from './pages/Designations'   // file kept as Designations.jsx (label = Assignments)
import Briefing from './pages/Briefing'
import LiveCourts from './pages/LiveCourts'
import Evaluate from './pages/Evaluate'
import Reports from './pages/Reports'
import RcReport from './pages/RcReport'
import Assistant from './pages/Assistant'

// App shell (sidebar + bottom nav) used by every circuit section.
function AppLayout() {
  return (
    <div className="flex h-[100dvh] bg-white text-gray-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-gray-50 pb-16 lg:pb-0">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}

export default function App() {
  // Auto-sync offline drafts when the connection returns
  useOfflineSync()

  return (
    <BrowserRouter>
      <LanguageGateProvider>
        {/* Offline banner pinned at top (all pages) */}
        <OfflineBanner />

        <Routes>
          {/* Home hub — full screen, no app shell */}
          <Route path="/" element={<Home />} />

          {/* Belgian Tour (current app) — under the shell */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard"        element={<Dashboard />} />
            <Route path="/briefing"         element={<Briefing />} />
            <Route path="/referees"         element={<Referees />} />
            <Route path="/referees/:id"     element={<RefereeProfile />} />
            <Route path="/tournaments"      element={<Tournaments />} />
            <Route path="/tournaments/:id"  element={<TournamentDetail />} />
            {/* Legacy URLs */}
            <Route path="/designations"     element={<Navigate to="/assignments" replace />} />
            <Route path="/assignments"      element={<Assignments />} />
            <Route path="/live-courts"      element={<LiveCourts />} />
            <Route path="/evaluate"         element={<Evaluate />} />
            <Route path="/reports"          element={<Reports />} />
            <Route path="/rc-report"        element={<RcReport />} />
            <Route path="/assistant"        element={<Assistant />} />
          </Route>

          {/* Anything unknown → hub */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <ToastContainer />
      </LanguageGateProvider>
    </BrowserRouter>
  )
}
