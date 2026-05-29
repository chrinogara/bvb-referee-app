import { useState } from 'react'
import { cn } from '../lib/utils'
import { TranslateButton } from './TranslateButton'

export function TextareaWithTranslate({
  value,
  onChange,
  onBlur,
  placeholder,
  rows = 3,
  label,
  disabled = false,
  className,
  showTranslateButton = true,
  onTranslated,
}) {
  const [isFocused, setIsFocused] = useState(false)

  const handleBlur = (e) => {
    setIsFocused(false)
    onBlur?.(e)
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        <textarea
          value={value}
          onChange={onChange}
          onBlur={handleBlur}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={cn(
            'w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2',
            'text-gray-900 placeholder-gray-400 text-sm resize-none',
            'focus:outline-none focus:border-[#E85D26]/60 focus:ring-1 focus:ring-[#E85D26]/30',
            'transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
            'pr-12', // Space for button
            className
          )}
        />
        {/* Translate button positioned in bottom-right corner */}
        {showTranslateButton && value?.trim().length > 0 && (
          <div className="absolute bottom-2 right-2">
            <TranslateButton
              text={value}
              onTranslated={onTranslated}
            />
          </div>
        )}
      </div>
    </div>
  )
}
