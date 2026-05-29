import { cn } from '../../lib/utils'
import { TranslateButton } from '../TranslateButton'

export function Input({ className, label, error, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        className={cn(
          'bg-white border border-gray-300 rounded-lg px-3 py-2',
          'text-gray-900 placeholder-gray-400 text-sm',
          'focus:outline-none focus:border-[#E85D26]/60 focus:ring-2 focus:ring-[#E85D26]/20',
          'transition-colors duration-150',
          error && 'border-red-400',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

export function Textarea({ className, label, error, rows = 3, translate = false, onTranslated, ...props }) {
  const showButton = translate && typeof props.value === 'string' && props.value.trim().length > 0
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        <textarea
          rows={rows}
          className={cn(
            'bg-white border border-gray-300 rounded-lg px-3 py-2 w-full',
            'text-gray-900 placeholder-gray-400 text-sm resize-none',
            'focus:outline-none focus:border-[#E85D26]/60 focus:ring-2 focus:ring-[#E85D26]/20',
            'transition-colors duration-150',
            translate && 'pr-12',
            error && 'border-red-400',
            className
          )}
          {...props}
        />
        {showButton && (
          <div className="absolute bottom-2 right-2">
            <TranslateButton text={props.value} onTranslated={onTranslated} />
          </div>
        )}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

export function Select({ className, label, error, children, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        className={cn(
          'bg-white border border-gray-300 rounded-lg px-3 py-2',
          'text-gray-900 text-sm appearance-none',
          'focus:outline-none focus:border-[#E85D26]/60 focus:ring-2 focus:ring-[#E85D26]/20',
          'transition-colors duration-150',
          error && 'border-red-400',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
