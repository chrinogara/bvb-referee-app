import { formatDate, refereeName } from './utils'

/**
 * Build a WhatsApp-formatted designation message.
 *
 * @param {Object} args
 * @param {Object} args.tournament  Tournament row
 * @param {number} args.dayNumber
 * @param {Array}  args.assignments Array of { court, session_order, referee, role }
 * @param {boolean} args.isUpdate   Adds "🔄 UPDATED" tag if true
 * @param {string} args.rotationPattern e.g. "M1-M2-PAUSE-M3"
 * @returns {string}
 */
export function buildDesignationMessage({
  tournament,
  dayNumber,
  assignments,
  isUpdate = false,
  rotationPattern = 'M1-M2-PAUSE-M3',
}) {
  const lines = []

  // Header
  if (isUpdate) lines.push('🔄 *UPDATED DESIGNATIONS*')
  lines.push(`🏐 *BVB Referee Designations*`)
  lines.push(`*${tournament?.name || 'Tournament'}* — Day ${dayNumber}`)
  if (tournament?.start_date) {
    lines.push(`📅 ${formatDate(tournament.start_date)}`)
  }
  lines.push('')

  // Group by court
  const byCourt = {}
  for (const a of assignments) {
    const c = a.court || 'Unassigned'
    if (!byCourt[c]) byCourt[c] = []
    byCourt[c].push(a)
  }

  // Sort courts naturally (Court 1, Court 2, ...)
  const courts = Object.keys(byCourt).sort((a, b) => {
    const na = parseInt(a.match(/\d+/)?.[0] || '0', 10)
    const nb = parseInt(b.match(/\d+/)?.[0] || '0', 10)
    return na - nb
  })

  for (const court of courts) {
    lines.push(`*${court}*`)
    const sessions = byCourt[court].sort(
      (a, b) => a.session_order - b.session_order
    )
    for (const s of sessions) {
      const name = s.referees ? refereeName(s.referees) : '—'
      const roleLabel = s.role === 'PAUSE' ? '⏸ Pause' : s.role
      lines.push(`  M${s.session_order}: ${name} (${roleLabel})`)
    }
    lines.push('')
  }

  // Footer
  lines.push(`_Pattern: ${rotationPattern}_`)
  lines.push(`_RC Christian Nogara — Volley Vlaanderen / FWBV_`)

  return lines.join('\n')
}

/**
 * Open WhatsApp with a pre-filled message (URL scheme).
 * On mobile: opens the native app. On desktop: opens WhatsApp Web.
 * The user picks the group / chat manually.
 */
export function shareToWhatsApp(message) {
  const encoded = encodeURIComponent(message)
  const url = `https://wa.me/?text=${encoded}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Copy message to clipboard (fallback if WhatsApp unavailable).
 */
export async function copyDesignationMessage(message) {
  try {
    await navigator.clipboard.writeText(message)
    return true
  } catch {
    return false
  }
}

/**
 * Build a per-referee personalized message (DM).
 */
export function buildPersonalMessage({ referee, tournament, dayNumber, assignments }) {
  const name = referee.first_name
  const mine = assignments.filter((a) => a.referee_id === referee.id)
    .sort((a, b) => a.session_order - b.session_order)

  if (mine.length === 0) {
    return `Hi ${name},\n\nYou are not assigned to any court today (${tournament.name} Day ${dayNumber}).\n\nRC Christian Nogara`
  }

  const lines = [
    `Hi ${name}, here are your assignments for *${tournament.name}* Day ${dayNumber}:`,
    '',
  ]
  for (const a of mine) {
    const roleLabel = a.role === 'PAUSE' ? '⏸ Pause' : a.role
    lines.push(`• M${a.session_order} → ${a.court} (${roleLabel})`)
  }
  lines.push('')
  lines.push('See you on court! 🏐')
  lines.push('RC Christian Nogara')

  return lines.join('\n')
}
