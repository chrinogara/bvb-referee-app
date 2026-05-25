import { Menu, Wifi, WifiOff } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useState, useEffect } from 'react'

export function Header({ title, subtitle, actions }) {
  const { toggleSidebar, offlineQueue } = useAppStore()
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-gray-950/50 backdrop-blur-sm sticky top-0 z-30">
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 min-w-0">
        {title && (
          <h1 className="text-base font-semibold text-white truncate">{title}</h1>
        )}
        {subtitle && (
          <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Offline indicator */}
        {!isOnline && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
            <WifiOff size={12} className="text-amber-400" />
            <span className="text-xs text-amber-400 font-medium">Offline</span>
            {offlineQueue.length > 0 && (
              <span className="text-xs text-amber-300">({offlineQueue.length})</span>
            )}
          </div>
        )}
        {actions}
      </div>
    </header>
  )
}
