import { useState, useCallback, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'
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

toast.success = (msg) => toast(msg, 'success')
toast.error = (msg) => toast(msg, 'error')
toast.info = (msg) => toast(msg, 'info')

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const listener = (t) => setToasts([...t])
    listeners.push(listener)
    return () => { listeners = listeners.filter((l) => l !== listener) }
  }, [])

  const icons = {
    success: <CheckCircle size={16} className="text-emerald-400 shrink-0" />,
    error:   <XCircle size={16} className="text-red-400 shrink-0" />,
    info:    <AlertCircle size={16} className="text-blue-400 shrink-0" />,
  }

  const colors = {
    success: 'border-emerald-500/30',
    error:   'border-red-500/30',
    info:    'border-blue-500/30',
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-2.5 px-4 py-3 rounded-xl',
            'bg-gray-900 border shadow-xl pointer-events-auto',
            'animate-in slide-in-from-bottom-2 duration-200',
            colors[t.type] || colors.info
          )}
        >
          {icons[t.type]}
          <span className="text-sm text-gray-200">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
