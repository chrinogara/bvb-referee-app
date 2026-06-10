import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

/**
 * Fixed top banner shown when the device has no internet connection.
 * - Red background with WifiOff icon
 * - Respects iOS safe-area-inset-top (Dynamic Island / notch)
 * - Pushes page content down via a spacer so nothing is hidden beneath
 * - Listens to browser 'online'/'offline' events in real time
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const goOnline  = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <>
      {/* Fixed banner at top — respects iPhone notch / Dynamic Island */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white shadow-lg"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 max-w-6xl mx-auto">
          <WifiOff size={16} className="shrink-0" />
          <span className="text-sm font-semibold">
            Offline — changes will sync automatically when connected
          </span>
        </div>
      </div>
      {/* Spacer that pushes content below the banner */}
      <div
        className="shrink-0 bg-red-500"
        style={{ height: 'calc(2.5rem + env(safe-area-inset-top))' }}
        aria-hidden="true"
      />
    </>
  )
}
