import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Trophy,
  Calendar,
  ClipboardCheck,
  FileText,
  MessageSquare,
  X,
  Waves,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../store/appStore'

const NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/referees',    icon: Users,           label: 'Referees' },
  { to: '/tournaments', icon: Trophy,          label: 'Tournaments' },
  { to: '/designations',icon: Calendar,        label: 'Designations' },
  { to: '/evaluate',    icon: ClipboardCheck,  label: 'Evaluate',    accent: true },
  { to: '/reports',     icon: FileText,        label: 'Reports' },
  { to: '/assistant',   icon: MessageSquare,   label: 'Rules AI' },
]

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col',
          'bg-[#1A1B2E] border-r border-white/10',
          'transition-transform duration-300 ease-in-out',
          'lg:relative lg:translate-x-0 lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#E85D26] rounded-lg flex items-center justify-center">
              <Waves size={18} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">BVB RC</div>
              <div className="text-[10px] text-gray-500 leading-tight">Belgian Beach Tour</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-gray-400"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, accent }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive
                    ? accent
                      ? 'bg-[#E85D26] text-white font-semibold'
                      : 'bg-[#2D3270]/60 text-white font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-white/8'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* RC Info */}
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Referee Coach</div>
          <div className="text-sm font-semibold text-white">Christian Nogara</div>
          <div className="text-xs text-gray-500">Volley Vlaanderen / FWBV</div>
        </div>
      </aside>
    </>
  )
}
