import { cn, scoreColor } from '../../lib/utils'
import { getGrade } from '../../lib/scoring'

export function ScoreCircle({ score, size = 'md', showGrade = false }) {
  if (score == null) return <span className="text-gray-500">—</span>

  const grade = getGrade(score)
  const sizes = {
    sm:  'w-10 h-10 text-base',
    md:  'w-14 h-14 text-xl',
    lg:  'w-20 h-20 text-3xl',
    xl:  'w-28 h-28 text-4xl',
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-bold border-2',
          sizes[size] || sizes.md,
          grade.color,
          grade.bg,
          grade.color.replace('text-', 'border-').replace('400', '400/40')
        )}
      >
        {score.toFixed(1)}
      </div>
      {showGrade && (
        <span className={cn('text-xs font-semibold', grade.color)}>
          {grade.grade}
        </span>
      )}
    </div>
  )
}

export function ScoreBars({ score, maxScore = 5, className }) {
  const pct = Math.round((score / maxScore) * 100)
  const color =
    score >= 4 ? 'bg-emerald-500' :
    score >= 3 ? 'bg-yellow-500' :
    score >= 2 ? 'bg-orange-500' : 'bg-red-500'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-xs font-mono font-bold w-7 text-right', scoreColor(score))}>
        {score?.toFixed(1)}
      </span>
    </div>
  )
}
