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
  if (isUpdate) lines.push('*[UPDATED] BVB REFEREE ASSIGNMENTS*')
  else lines.push('*BVB Referee Assignments*')
  lines.push(`*${tournament?.name || 'Tournament'}* — Day ${dayNumber}`)
  if (tournament?.start_date) {
    lines.push(`Date: ${formatDate(tournament.start_date)}`)
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
      const roleLabel = s.role === 'PAUSE' ? 'PAUSE' : s.role
      lines.push(`  M${s.session_order}: ${name} (${roleLabel})`)
    }
    lines.push('')
  }

  // Footer
  lines.push(`_Pattern: ${rotationPattern}_`)
  lines.push(`_RC Nogara Christian — CEV Referee Coach_`)

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
 * Build an evaluation summary message for the referee (personal DM).
 */
export function buildEvaluationMessage({ referee, evaluation, tournament }) {
  const name = referee?.first_name || 'there'
  const date = evaluation?.evaluated_at
    ? new Date(evaluation.evaluated_at).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : ''

  const lines = []
  lines.push(`Hi ${name},`)
  lines.push('')
  lines.push(`Your evaluation summary from *${tournament?.name || 'the tournament'}*${date ? ` (${date})` : ''}:`)
  lines.push('')
  if (evaluation.role) lines.push(`Role: *${evaluation.role}*`)
  if (evaluation.match_description) lines.push(`${evaluation.match_description}`)
  if (evaluation.overall_score != null) {
    lines.push(`Overall: *${evaluation.overall_score.toFixed(1)}/5* — ${evaluation.grade || ''}`)
  }
  if (evaluation.repeat_penalty > 0) {
    lines.push(`Repeat fault penalty: -${evaluation.repeat_penalty.toFixed(1)}`)
  }
  lines.push('')
  lines.push('*Criteria scores*')

  const criteria = [
    { label: 'Positioning & Court Coverage',     key: 'positioning' },
    { label: 'Official Signals & 3-Step',        key: 'signals' },
    { label: 'Attitude & Player Management',     key: 'attitude' },
    { label: 'Captain Communication',            key: 'captain_comm' },
    { label: 'Presentation & Critical Situations', key: 'presentation' },
  ]

  for (const c of criteria) {
    const score = evaluation[`score_${c.key}`]
    const repeat = evaluation[`repeat_${c.key}`]
    if (score != null) {
      lines.push(`• ${c.label}: *${score}/5*${repeat ? ' ⚠ (repeated fault)' : ''}`)
    }
  }

  if (evaluation.general_notes) {
    lines.push('')
    lines.push('*General feedback*')
    lines.push(evaluation.general_notes)
  }

  lines.push('')
  lines.push('Keep working hard!')
  lines.push('RC Nogara Christian — CEV Referee Coach')

  return lines.join('\n')
}

/**
 * Open WhatsApp with an evaluation pre-filled, addressed to the referee's phone.
 */
export function shareEvaluationToReferee({ referee, evaluation, tournament }) {
  const msg = buildEvaluationMessage({ referee, evaluation, tournament })
  if (referee?.phone) {
    const phone = referee.phone.replace(/[^0-9+]/g, '').replace(/^\+/, '')
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  } else {
    // No phone — generic share
    shareToWhatsApp(msg)
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
    return `Hi ${name},\n\nYou are not assigned to any court today (${tournament.name} Day ${dayNumber}).\n\nRC Nogara Christian — CEV Referee Coach`
  }

  const lines = [
    `Hi ${name}, here are your assignments for *${tournament.name}* Day ${dayNumber}:`,
    '',
  ]
  for (const a of mine) {
    const roleLabel = a.role === 'PAUSE' ? 'PAUSE' : a.role
    lines.push(`• M${a.session_order} → ${a.court} (${roleLabel})`)
  }
  lines.push('')
  lines.push('See you on court!')
  lines.push('RC Nogara Christian — CEV Referee Coach')

  return lines.join('\n')
}
