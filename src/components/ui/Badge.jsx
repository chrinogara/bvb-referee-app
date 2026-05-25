import { cn } from '../../lib/utils'

export function Badge({ children, className, variant = 'default', size = 'sm' }) {
  const variants = {
    default: 'bg-white/10 text-white',
    navy:    'bg-[#2D3270]/20 text-[#7B85C9]',
    orange:  'bg-[#E85D26]/20 text-[#E85D26]',
    green:   'bg-emerald-500/15 text-emerald-400',
    yellow:  'bg-yellow-500/15 text-yellow-400',
    red:     'bg-red-500/15 text-red-400',
    blue:    'bg-blue-500/15 text-blue-400',
    amber:   'bg-amber-500/15 text-amber-400',
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
