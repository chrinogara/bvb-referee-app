import { cn } from '../../lib/utils'

export function Badge({ children, className, variant = 'default', size = 'sm' }) {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    navy:    'bg-[#2D3270]/10 text-[#2D3270]',
    orange:  'bg-[#E85D26]/10 text-[#E85D26]',
    green:   'bg-emerald-50 text-emerald-700',
    yellow:  'bg-yellow-50 text-yellow-700',
    red:     'bg-red-50 text-red-700',
    blue:    'bg-blue-50 text-blue-700',
    amber:   'bg-amber-50 text-amber-700',
  }
  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        variants[variant] || variants.default,
        sizes[size] || sizes.sm,
        className
      )}
    >
      {children}
    </span>
  )
}
