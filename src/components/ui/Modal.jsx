import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Modal({ open, onClose, title, children, size = 'md', className }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm:   'max-w-md',
    md:   'max-w-lg',
    lg:   'max-w-2xl',
    xl:   'max-w-4xl',
    full: 'max-w-screen-lg',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          'w-full bg-white border border-gray-200 rounded-2xl shadow-2xl',
          'flex flex-col max-h-[90vh]',
          sizes[size] || sizes.md,
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-4">{children}</div>
      </div>
    </div>
  )
}
