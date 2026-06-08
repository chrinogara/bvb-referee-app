import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { BottomNav } from './components/layout/BottomNav'
import { ToastContainer } from './components/ui/Toast'

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

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-white text-gray-900 overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-gray-50 pb-16 lg:pb-0">
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/briefing"      element={<Briefing />} />
            <Route path="/referees"      element={<Referees />} />
            <Route path="/referees/:id"  element={<RefereeProfile />} />
            <Route path="/tournaments"   element={<Tournaments />} />
            <Route path="/tournaments/:id" element={<TournamentDetail />} />
            {/* Legacy URL: redirect /designations → /assignments */}
            <Route path="/designations"  element={<Navigate to="/assignments" replace />} />
            <Route path="/assignments"   element={<Assignments />} />
            <Route path="/live-courts"   element={<LiveCourts />} />
            <Route path="/evaluate"      element={<Evaluate />} />
            <Route path="/reports"       element={<Reports />} />
            <Route path="/rc-report"     element={<RcReport />} />
            <Route path="/assistant"     element={<Assistant />} />
          </Routes>
        </div>

        <BottomNav />
      </div>

      <ToastContainer />
    </BrowserRouter>
  )
}
