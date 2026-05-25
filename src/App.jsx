import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { ToastContainer } from './components/ui/Toast'

import Dashboard from './pages/Dashboard'
import Referees from './pages/Referees'
import RefereeProfile from './pages/RefereeProfile'
import Tournaments from './pages/Tournaments'
import TournamentDetail from './pages/TournamentDetail'
import Designations from './pages/Designations'
import Evaluate from './pages/Evaluate'
import Reports from './pages/Reports'
import Assistant from './pages/Assistant'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/referees"     element={<Referees />} />
            <Route path="/referees/:id" element={<RefereeProfile />} />
            <Route path="/tournaments"  element={<Tournaments />} />
            <Route path="/tournaments/:id" element={<TournamentDetail />} />
            <Route path="/designations" element={<Designations />} />
            <Route path="/evaluate"     element={<Evaluate />} />
            <Route path="/reports"      element={<Reports />} />
            <Route path="/assistant"    element={<Assistant />} />
          </Routes>
        </div>
      </div>

      <ToastContainer />
    </BrowserRouter>
  )
}
