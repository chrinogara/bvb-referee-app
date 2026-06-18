import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatTime(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

// Format an elapsed duration (in milliseconds) as H:MM:SS, or M:SS when under
// an hour. Used for the live running clock and the final match duration.
export function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms) || ms < 0) return '—'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function refereeName(referee) {
  if (!referee) return 'Unknown'
  return `${referee.first_name} ${referee.last_name}`
}

export function refereeInitials(referee) {
  if (!referee) return '??'
  return `${referee.first_name[0]}${referee.last_name[0]}`
}

export function levelColor(level) {
  switch (level) {
    case 'A': return 'text-emerald-400 bg-emerald-400/10'
    case 'B': return 'text-blue-400 bg-blue-400/10'
    case 'C': return 'text-yellow-400 bg-yellow-400/10'
    default: return 'text-gray-400 bg-gray-400/10'
  }
}

export function seriesColor(series) {
  return series === 'PRO'
    ? 'text-orange-400 bg-orange-400/10'
    : 'text-sky-400 bg-sky-400/10'
}

export function roleColor(role) {
  switch (role) {
    case 'R1': return 'text-purple-400 bg-purple-400/10'
    case 'R2': return 'text-blue-400 bg-blue-400/10'
    case 'LJ1':
    case 'LJ2': return 'text-cyan-400 bg-cyan-400/10'
    default: return 'text-gray-400 bg-gray-400/10'
  }
}

export function scoreColor(score) {
  if (score >= 4.5) return 'text-emerald-400'
  if (score >= 3.5) return 'text-green-400'
  if (score >= 2.5) return 'text-yellow-400'
  if (score >= 1.5) return 'text-orange-400'
  return 'text-red-400'
}

export function tournamentDuration(t) {
  const days = Math.ceil(
    (new Date(t.end_date) - new Date(t.start_date)) / (1000 * 60 * 60 * 24)
  ) + 1
  return `${days} day${days !== 1 ? 's' : ''}`
}

export function isUpcoming(tournament) {
  return new Date(tournament.start_date) > new Date()
}

export function isOngoing(tournament) {
  const now = new Date()
  return new Date(tournament.start_date) <= now && new Date(tournament.end_date) >= now
}

export function isPast(tournament) {
  return new Date(tournament.end_date) < new Date()
}
