import { cn } from '../../lib/utils'

export function Card({ children, className, onClick, ...props }) {
  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-xl shadow-sm',
        onClick && 'cursor-pointer hover:border-gray-300 hover:shadow transition-all',
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
    <div className={cn('p-4 border-b border-gray-200', className)}>
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
    <h3 className={cn('text-sm font-semibold text-gray-900', className)}>
      {children}
    </h3>
  )
}
