import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'

let toastQueue = []
let listeners = []

function notify(listeners, toasts) {
  listeners.forEach((l) => l(toasts))
}

export function toast(message, type = 'success', duration = 3500) {
  const id = Date.now()
  toastQueue = [...toastQueue, { id, message, type }]
  notify(listeners, toastQueue)
  setTimeout(() => {
    toastQueue = toastQueue.filter((t) => t.id !== id)
    notify(listeners, toastQueue)
  }, duration)
}

toast.success = (msg, duration) => toast(msg, 'success', duration)
toast.error   = (msg, duration) => toast(msg, 'error',   duration)
toast.info    = (msg, duration) => toast(msg, 'info',    duration)
toast.warning = (msg, duration) => toast(msg, 'warning', duration)

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const listener = (t) => setToasts([...t])
    listeners.push(listener)
    return () => { listeners = listeners.filter((l) => l !== listener) }
  }, [])

  const icons = {
    success: <CheckCircle   size={16} className="text-emerald-600 shrink-0" />,
    error:   <XCircle       size={16} className="text-red-600 shrink-0" />,
    info:    <AlertCircle   size={16} className="text-blue-600 shrink-0" />,
    warning: <AlertTriangle size={16} className="text-amber-600 shrink-0" />,
  }

  const colors = {
    success: 'border-emerald-300 bg-emerald-50',
    error:   'border-red-300   bg-red-50',
    info:    'border-blue-300  bg-blue-50',
    warning: 'border-amber-300 bg-amber-50',
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-2.5 px-4 py-3 rounded-xl',
            'border shadow-lg pointer-events-auto',
            'animate-in slide-in-from-bottom-2 duration-200',
            colors[t.type] || colors.info
          )}
        >
          {icons[t.type]}
          <span className="text-sm text-gray-800">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
