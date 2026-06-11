import { Menu, WifiOff, FlaskConical, Home } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import { useState, useEffect } from 'react'
import { cn } from '../../lib/utils'

export function Header({ title, subtitle, actions }) {
  const { toggleSidebar, offlineQueue, sandboxMode, setSandboxMode } = useAppStore()
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return (
    <>
      {/* Sandbox banner */}
      {sandboxMode && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-amber-900 font-semibold">
          <FlaskConical size={13} />
          SANDBOX MODE — all writes are flagged as test data
          <button
            type="button"
            onClick={() => setSandboxMode(false)}
            className="ml-2 underline hover:text-amber-700"
          >
            Exit sandbox
          </button>
        </div>
      )}

      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white/95 backdrop-blur sticky top-0 z-30">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <Menu size={20} />
        </button>

        <Link
          to="/"
          title="Back to circuit hub"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-[#E85D26] hover:bg-gray-100 transition-colors shrink-0"
        >
          <Home size={18} />
          <span className="text-xs font-bold uppercase tracking-wide hidden sm:inline">Hub</span>
        </Link>

        <div className="flex-1 min-w-0">
          {title && (
            <h1 className="font-display text-xl font-bold uppercase tracking-wide text-gray-900 truncate leading-none">{title}</h1>
          )}
          {subtitle && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSandboxMode(!sandboxMode)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              sandboxMode
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            )}
            title={sandboxMode ? 'Exit sandbox mode' : 'Enter sandbox mode'}
          >
            <FlaskConical size={12} />
            {sandboxMode ? 'Sandbox ON' : 'Sandbox'}
          </button>

          {!isOnline && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 border border-amber-300">
              <WifiOff size={12} className="text-amber-700" />
              <span className="text-xs text-amber-800 font-medium">Offline</span>
              {offlineQueue.length > 0 && (
                <span className="text-xs text-amber-700">({offlineQueue.length})</span>
              )}
            </div>
          )}
          {actions}
        </div>
      </header>
    </>
  )
}
