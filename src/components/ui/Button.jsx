import { cn } from '../../lib/utils'

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  onClick,
  type = 'button',
  ...props
}) {
  const variants = {
    primary: 'bg-[#E85D26] hover:bg-[#C44D1E] text-white shadow-sm',
    navy:    'bg-[#2D3270] hover:bg-[#1E2255] text-white shadow-sm',
    ghost:   'hover:bg-gray-100 text-gray-700 hover:text-gray-900',
    outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900',
    danger:  'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200',
    success: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200',
  }
  const sizes = {
    xs:  'text-xs px-2.5 py-1.5 gap-1',
    sm:  'text-sm px-3 py-1.5 gap-1.5',
    md:  'text-sm px-4 py-2 gap-2',
    lg:  'text-base px-5 py-2.5 gap-2',
    icon:'p-2',
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
