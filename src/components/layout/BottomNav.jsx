import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Trophy, ClipboardCheck, Monitor, FileText } from 'lucide-react'
import { cn } from '../../lib/utils'

// Bottom navigation for mobile/tablet (hidden on desktop where the Sidebar is shown).
// Thumb-friendly primary nav for on-court use.
const ITEMS = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Home' },
  { to: '/tournaments', icon: Trophy,          label: 'Tournaments' },
  { to: '/evaluate',    icon: ClipboardCheck,  label: 'Evaluate', accent: true },
  { to: '/live-courts', icon: Monitor,         label: 'Live' },
  { to: '/reports',     icon: FileText,        label: 'Reports' },
]

export function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 px-1 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {ITEMS.map(({ to, icon: Icon, label, accent }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2 transition-colors',
                isActive
                  ? accent ? 'text-[#E85D26]' : 'text-[#2D3270]'
                  : 'text-gray-400'
              )
            }
          >
            <Icon size={22} strokeWidth={2.1} />
            <span className="text-[10px] font-semibold leading-none">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
