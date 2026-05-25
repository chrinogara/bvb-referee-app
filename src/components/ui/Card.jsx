import { cn } from '../../lib/utils'

export function Card({ children, className, onClick, ...props }) {
  return (
    <div
      className={cn(
        'bg-gray-900 border border-white/10 rounded-xl',
        onClick && 'cursor-pointer hover:border-white/20 transition-colors',
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }) {
  return (
    <div className={cn('p-4 border-b border-white/10', className)}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }) {
  return (
    <div className={cn('p-4', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className }) {
  return (
    <h3 className={cn('text-sm font-semibold text-white', className)}>
      {children}
    </h3>
  )
}
