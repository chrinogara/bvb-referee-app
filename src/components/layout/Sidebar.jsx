import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Trophy,
  Calendar,
  ClipboardCheck,
  FileText,
  MessageSquare,
  X,
  Volleyball,
  Monitor,
  BookOpen,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../store/appStore'

const NAV = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/briefing',     icon: BookOpen,        label: 'Briefing' },
  { to: '/referees',     icon: Users,           label: 'Referees' },
  { to: '/tournaments',  icon: Trophy,          label: 'Tournaments' },
  { to: '/assignments',  icon: Calendar,        label: 'Assignments' },
  { to: '/live-courts',  icon: Monitor,         label: 'Live Courts' },
  { to: '/evaluate',     icon: ClipboardCheck,  label: 'Evaluate', accent: true },
  { to: '/reports',      icon: FileText,        label: 'Reports' },
  { to: '/assistant',    icon: MessageSquare,   label: 'Rules AI' },
]

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col',
          'bg-white border-r border-gray-200',
          'transition-transform duration-300 ease-in-out',
          'lg:relative lg:translate-x-0 lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo → back to circuit hub */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <Link to="/" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-[#E85D26] to-[#C44D1E] rounded-lg flex items-center justify-center shadow-sm">
              <Volleyball size={20} className="text-white" strokeWidth={2.2} />
            </div>
            <div>
              <div className="font-display text-lg font-bold uppercase text-gray-900 leading-none group-hover:text-[#E85D26] transition-colors">BVB RC</div>
              <div className="text-[10px] text-gray-500 leading-tight mt-0.5">Beach Volley Tour</div>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
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
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive
                    ? accent
                      ? 'bg-[#E85D26] text-white font-semibold shadow-sm'
                      : 'bg-[#2D3270]/10 text-[#2D3270] font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* RC Info */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
            Referee Coach
          </div>
          <div className="text-sm font-semibold text-gray-900">RC Nogara Christian</div>
          <div className="text-xs text-gray-500">CEV Referee Coach</div>
        </div>
      </aside>
    </>
  )
}
