import { formatDate, refereeName } from './utils'
import { dict, normalizePhone } from './i18n-docs'

/**
 * Build a WhatsApp-formatted designation message.
 * @param {Object} args
 * @param {Object} args.tournament
 * @param {number} args.dayNumber
 * @param {Array}  args.assignments  Array of { court, session_order, referees, role }
 * @param {boolean} args.isUpdate
 * @param {string} args.rotationPattern
 * @param {string} args.lang  'en' | 'fr' | 'nl'
 */
export function buildDesignationMessage({
  tournament,
  dayNumber,
  assignments,
  isUpdate = false,
  rotationPattern = 'M1-M2-PAUSE-M3',
  lang = 'en',
}) {
  const d = dict(lang)
  const lines = []

  lines.push(isUpdate ? `*${d.designationsUpdated}*` : `*${d.designations}*`)
  lines.push(`*${tournament?.name || 'Tournament'}* — ${d.day} ${dayNumber}`)
  if (tournament?.start_date) lines.push(`${d.date}: ${formatDate(tournament.start_date)}`)
  lines.push('')

  // Group by court
  const byCourt = {}
  for (const a of assignments) {
    const c = a.court || '—'
    if (!byCourt[c]) byCourt[c] = []
    byCourt[c].push(a)
  }

  const courts = Object.keys(byCourt).sort((a, b) => {
    const na = parseInt(a.match(/\d+/)?.[0] || '0', 10)
    const nb = parseInt(b.match(/\d+/)?.[0] || '0', 10)
    return na - nb
  })

  for (const court of courts) {
    const label = /^\d+$/.test(court) ? `${d.court} ${court}` : court
    lines.push(`*${label}*`)
    const sessions = byCourt[court].sort((a, b) => a.session_order - b.session_order)
    for (const s of sessions) {
      const name = s.referees ? refereeName(s.referees) : '—'
      const roleLabel = s.role === 'PAUSE' ? d.pause : s.role
      lines.push(`  ${d.round} ${s.session_order}: ${name} (${roleLabel})`)
    }
    lines.push('')
  }

  if (rotationPattern) lines.push(`_${d.pattern}: ${rotationPattern}_`)
  lines.push(`_${d.signature}_`)
  return lines.join('\n')
}

/** Open WhatsApp with a pre-filled message (generic — user picks the chat/group). */
export function shareToWhatsApp(message) {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Copy message to clipboard. */
export async function copyDesignationMessage(message) {
  try {
    await navigator.clipboard.writeText(message)
    return true
  } catch {
    return false
  }
}

/** Build an evaluation summary message for the referee (personal briefing DM). */
export function buildEvaluationMessage({ referee, evaluation, tournament, lang = 'en' }) {
  const d = dict(lang)
  const name = referee?.first_name || ''
  const date = evaluation?.evaluated_at
    ? new Date(evaluation.evaluated_at).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : ''

  const lines = []
  lines.push(`${d.hi} ${name},`.trim())
  lines.push('')
  lines.push(`${d.evalIntro} *${tournament?.name || ''}*${date ? ` (${date})` : ''}:`)
  lines.push('')
  if (evaluation.role) lines.push(`${d.role}: *${evaluation.role}*`)
  if (evaluation.match_description) lines.push(`${evaluation.match_description}`)
  if (evaluation.overall_score != null) {
    lines.push(`${d.overall}: *${evaluation.overall_score.toFixed(1)}/5* — ${evaluation.grade || ''}`)
  }
  if (evaluation.repeat_penalty > 0) {
    lines.push(`${d.repeatPenalty}: -${evaluation.repeat_penalty.toFixed(1)}`)
  }
  lines.push('')
  lines.push(`*${d.criteriaScores}*`)

  const keys = ['positioning', 'signals', 'attitude', 'captain_comm', 'presentation']
  for (const key of keys) {
    const score = evaluation[`score_${key}`]
    const repeat = evaluation[`repeat_${key}`]
    if (score != null) {
      lines.push(`• ${d.criteria[key]}: *${score}/5*${repeat ? ` ⚠ (${d.repeatedFault})` : ''}`)
    }
  }

  if (evaluation.general_notes) {
    lines.push('')
    lines.push(`*${d.generalFeedback}*`)
    lines.push(evaluation.general_notes)
  }

  lines.push('')
  lines.push(d.keepWorking)
  lines.push(d.signature)
  return lines.join('\n')
}

/** Open WhatsApp with an evaluation pre-filled, addressed to the referee's phone. */
export function shareEvaluationToReferee({ referee, evaluation, tournament, lang = 'en' }) {
  const msg = buildEvaluationMessage({ referee, evaluation, tournament, lang })
  const phone = normalizePhone(referee?.phone)
  if (phone) {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  } else {
    shareToWhatsApp(msg)
  }
}

/** Build a per-referee personalized assignments message (DM). */
export function buildPersonalMessage({ referee, tournament, dayNumber, assignments, lang = 'en', rounds = null }) {
  const d = dict(lang)
  const name = referee.first_name || ''
  const mineAll = assignments.filter((a) => a.referee_id === referee.id)

  // Slot da mostrare: o i round del blocco (con riposo esplicito) o tutte le sue gare
  let slots
  if (rounds && rounds.length) {
    slots = rounds.map((r) => {
      const a = mineAll.find((x) => x.session_order === r)
      return { session_order: r, court: a ? a.court : null }
    })
  } else {
    slots = mineAll
      .slice()
      .sort((a, b) => a.session_order - b.session_order)
      .map((a) => ({ session_order: a.session_order, court: a.court }))
  }

  const hasWork = slots.some((s) => s.court != null)
  if (!hasWork && !(rounds && rounds.length)) {
    return [
      `${d.hi} ${name},`.trim(),
      '',
      `${d.notAssignedPre} (${tournament.name} ${d.day} ${dayNumber}).`,
      '',
      d.signature,
    ].join('\n')
  }

  let header = `${d.hi} ${name}, ${d.assignmentsIntroPre} *${tournament.name}* ${d.day} ${dayNumber}`
  if (rounds && rounds.length) {
    const from = rounds[0]
    const to = rounds[rounds.length - 1]
    header += ` — ${d.round} ${from}${to !== from ? `-${to}` : ''}`
  }
  header += ':'

  const lines = [header, '']
  for (const s of slots) {
    if (s.court == null) {
      lines.push(`• ${d.round} ${s.session_order} → *${d.rest}*`)
    } else {
      const courtLabel = /^\d+$/.test(String(s.court)) ? `${d.court} ${s.court}` : s.court
      lines.push(`• ${d.round} ${s.session_order} → ${courtLabel}`)
    }
  }
  lines.push('')
  lines.push(d.seeYou)
  lines.push(d.signature)
  return lines.join('\n')
}

/** Open WhatsApp with a referee's personal assignments, addressed to their phone. */
export function sharePersonalToReferee({ referee, tournament, dayNumber, assignments, lang = 'en', rounds = null }) {
  const msg = buildPersonalMessage({ referee, tournament, dayNumber, assignments, lang, rounds })
  const phone = normalizePhone(referee?.phone)
  if (phone) {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  } else {
    shareToWhatsApp(msg)
  }
}

// ─── Per-referee digests (evening day + end of tournament) ───────────────────
const DIG_CRIT = [
  ['positioning', 'Positioning'],
  ['signals', 'Signals'],
  ['attitude', 'Attitude'],
  ['captain_comm', 'Captain comm.'],
  ['presentation', 'Presentation'],
]
function fmt1(n) { return n == null ? '—' : Number(n).toFixed(1) }

/** Concise evening day-digest message for the referee (full detail in the PDF). */
export function buildDayDigestMessage({ referee, tournament, dayNumber, digest, coachComment }) {
  const name = referee?.first_name || ''
  const L = []
  L.push(`Hi ${name},`.trim())
  L.push('')
  L.push(`Your Day ${dayNumber} summary${tournament?.name ? ` — *${tournament.name}*` : ''} (${digest.count} match${digest.count === 1 ? '' : 'es'}):`)
  L.push('')
  L.push(`Day average: *${fmt1(digest.averages.overall)}/5*`)
  for (const [k, label] of DIG_CRIT) L.push(`• ${label}: ${fmt1(digest.averages.criteria[k])}`)
  if (coachComment) { L.push(''); L.push(`*Coach comment:* ${coachComment}`) }
  L.push('')
  L.push('Full breakdown in the PDF I’m sending you. Rest well — see you tomorrow!')
  L.push('— RC')
  return L.join('\n')
}

/** Concise end-of-tournament message for the referee (full detail in the PDF). */
export function buildTournamentDigestMessage({ referee, tournament, evolution, advice, coachComment }) {
  const name = referee?.first_name || ''
  const ev = evolution.evolution
  const L = []
  L.push(`Hi ${name},`.trim())
  L.push('')
  L.push(`Your tournament evaluation${tournament?.name ? ` — *${tournament.name}*` : ''} (${evolution.count} match${evolution.count === 1 ? '' : 'es'}):`)
  L.push('')
  L.push(`Overall average: *${fmt1(evolution.overall.overall)}/5*`)
  if (ev && ev.overall != null) {
    const sign = ev.overall > 0 ? '+' : ''
    L.push(`Evolution Day ${ev.fromDay}→${ev.toDay}: *${sign}${ev.overall.toFixed(1)}*`)
  }
  L.push('')
  if (advice?.summary) L.push(advice.summary)
  if (advice?.advice) { L.push(''); L.push(advice.advice) }
  if (coachComment) { L.push(''); L.push(`*Final coach comment:* ${coachComment}`) }
  L.push('')
  L.push('Full report in the PDF attached. Thanks for your work this tournament!')
  L.push('— RC')
  return L.join('\n')
}

export function shareDayDigestToReferee(args) {
  const msg = buildDayDigestMessage(args)
  const phone = normalizePhone(args.referee?.phone)
  if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  else shareToWhatsApp(msg)
}

export function shareTournamentDigestToReferee(args) {
  const msg = buildTournamentDigestMessage(args)
  const phone = normalizePhone(args.referee?.phone)
  if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  else shareToWhatsApp(msg)
}

// ─── Schedule-based designations (finals/bracket day) ─────────────────────────
// Helpers
function _serShort(m) { return m.series === 'PRO' ? 'PRO' : 'CH' }
function _genLabel(m) { return m.gender === 'M' ? 'Heren' : 'Dames' }
function _matchTag(m) { return `${_serShort(m)} ${_genLabel(m)} ${m.round || ''}`.trim() }
function _hhmm(t) {
  if (!t) return ''
  try { return new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }) }
  catch { return String(t).slice(11, 16) }
}

/** General broadcast: full day designations grouped by time slot. */
export function buildScheduleGeneralMessage({ tournamentName, dayLabel, matches, refNameById, ref2NameById }) {
  const L = []
  L.push(`🏐 *${tournamentName || 'Torneo'} — ${dayLabel || ''}*`.trim())
  L.push('_Assignments_')
  let curr = null
  for (const m of matches) {
    const t = _hhmm(m.scheduled_time)
    if (t !== curr) { curr = t; L.push(''); L.push(`*${t}*`) }
    const star = m.is_final ? '🏆 ' : ''
    const ref = refNameById[m.id] || '—'
    const ref2 = ref2NameById && ref2NameById[m.id]
    const head = `${star}C${m.court} · #${m.match_number} ${_matchTag(m)}`
    L.push(ref2 ? `${head} → R1: *${ref}* · R2: *${ref2}*` : `${head} → *${ref}*`)
  }
  L.push('')
  L.push('Christian Nogara')
  L.push('CEV Referee Coach')
  return L.join('\n')
}

/** Individual message for one referee: only their matches. */
export function buildRefereeScheduleMessage({ referee, tournamentName, dayLabel, matches }) {
  const name = referee?.first_name || ''
  const L = []
  L.push(`🏐 *${tournamentName || 'Torneo'} — ${dayLabel || ''}*`.trim())
  L.push(`Ciao *${name}*, ecco le tue partite:`.trim())
  L.push('')
  for (const m of matches) {
    const star = m.is_final ? '🏆 ' : '⏰ '
    const roleP = m._role ? ` · _${m._role}${m._partner ? ` con ${m._partner}` : ''}_` : ''
    L.push(`${star}*${_hhmm(m.scheduled_time)}* — Campo ${m.court} · #${m.match_number} ${_matchTag(m)}${roleP}`)
  }
  L.push('')
  L.push(`Totale: *${matches.length}* partit${matches.length === 1 ? 'a' : 'e'}.`)
  L.push('Christian Nogara')
  L.push('CEV Referee Coach')
  return L.join('\n')
}

/** Message for a SINGLE time slot: only the matches starting at that time. */
export function buildSlotScheduleMessage({ tournamentName, dayLabel, slotTime, matches, refNameById, ref2NameById }) {
  const L = []
  L.push(`🏐 *${tournamentName || 'Torneo'} — ${dayLabel || ''}*`.trim())
  L.push(`_Assignments · ${_hhmm(slotTime)}_`)
  L.push('')
  for (const m of matches) {
    const star = m.is_final ? '🏆 ' : ''
    const ref = (refNameById && refNameById[m.id]) || '—'
    const ref2 = ref2NameById && ref2NameById[m.id]
    const head = `${star}C${m.court} · #${m.match_number} ${_matchTag(m)}`
    L.push(ref2 ? `${head} → R1: *${ref}* · R2: *${ref2}*` : `${head} → *${ref}*`)
  }
  L.push('')
  L.push('Christian Nogara')
  L.push('CEV Referee Coach')
  return L.join('\n')
}

export function shareSlotSchedule(args) {
  shareToWhatsApp(buildSlotScheduleMessage(args))
}

export function shareScheduleGeneral(args) {
  shareToWhatsApp(buildScheduleGeneralMessage(args))
}
export function shareRefereeSchedule(args) {
  const msg = buildRefereeScheduleMessage(args)
  const phone = normalizePhone(args.referee?.phone)
  if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  else shareToWhatsApp(msg)
}
