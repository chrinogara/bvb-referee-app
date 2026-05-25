import { cn } from '../../lib/utils'

export function Input({ className, label, error, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        className={cn(
          'bg-gray-800 border border-white/15 rounded-lg px-3 py-2',
          'text-white placeholder-gray-500 text-sm',
          'focus:outline-none focus:border-[#E85D26]/60 focus:ring-1 focus:ring-[#E85D26]/30',
          'transition-colors duration-150',
          error && 'border-red-500/50',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

export function Textarea({ className, label, error, rows = 3, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        className={cn(
          'bg-gray-800 border border-white/15 rounded-lg px-3 py-2',
          'text-white placeholder-gray-500 text-sm resize-none',
          'focus:outline-none focus:border-[#E85D26]/60 focus:ring-1 focus:ring-[#E85D26]/30',
          'transition-colors duration-150',
          error && 'border-red-500/50',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

export function Select({ className, label, error, children, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        className={cn(
          'bg-gray-800 border border-white/15 rounded-lg px-3 py-2',
          'text-white text-sm appearance-none',
          'focus:outline-none focus:border-[#E85D26]/60 focus:ring-1 focus:ring-[#E85D26]/30',
          'transition-colors duration-150',
          error && 'border-red-500/50',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
