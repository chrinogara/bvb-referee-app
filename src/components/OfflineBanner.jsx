import { useState, useEffect } from 'react'
import { WifiOff, AlertTriangle } from 'lucide-react'

/**
 * Banner offline mostrato fisso in alto quando navigator.onLine === false.
 * - Rosso/arancione con icona WifiOff
 * - Messaggio: "You are offline — local changes will sync when connected"
 * - Ascolta gli eventi 'online' e 'offline' del browser per aggiornare in tempo reale
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/95 text-white px-4 py-3 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-center gap-2 max-w-6xl mx-auto">
        <WifiOff size={18} className="flex-shrink-0" />
        <span className="text-sm font-medium">
          You are offline — local changes will sync when connected
        </span>
      </div>
    </div>
  )
}
