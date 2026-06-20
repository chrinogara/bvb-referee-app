/**
 * Rule-based analysis for the Assignments section.
 * Pure functions — no network, no AI — so reports are deterministic and work offline.
 *
 * A "round" (giro) is one rotation slot: { courts: [refId|null per court] }.
 * Everything here is computed from those rounds plus the day's evaluations.
 */

import { refereeName } from './utils'

// ── Per-day metrics ─────────────────────────────────────────────────────────
export function computeDayStats({ giri = [], rosterIds = [], refById = {}, courts = [], evaluations = [] }) {
  const rounds = giri.length
  const matches = {}     // refId -> matches worked
  const courtDist = {}   // refId -> { courtName: count }
  const maxConsec = {}   // refId -> longest consecutive working streak
  const streak = {}

  rosterIds.forEach((id) => { matches[id] = 0; courtDist[id] = {}; maxConsec[id] = 0; streak[id] = 0 })

  giri.forEach((g) => {
    const onCourt = new Set()
    g.courts.forEach((id, ci) => {
      if (id == null) return
      onCourt.add(id)
      matches[id] = (matches[id] || 0) + 1
      const cn = courts[ci] || `Court ${ci + 1}`
      courtDist[id] = courtDist[id] || {}
      courtDist[id][cn] = (courtDist[id][cn] || 0) + 1
    })
    // update consecutive streaks
    rosterIds.forEach((id) => {
      if (onCourt.has(id)) {
        streak[id] = (streak[id] || 0) + 1
        if (streak[id] > (maxConsec[id] || 0)) maxConsec[id] = streak[id]
      } else {
        streak[id] = 0
      }
    })
  })

  const workingRefs = rosterIds.filter((id) => (matches[id] || 0) > 0)
  const matchVals = workingRefs.map((id) => matches[id])
  const minMatches = matchVals.length ? Math.min(...matchVals) : 0
  const maxMatches = matchVals.length ? Math.max(...matchVals) : 0
  const spread = maxMatches - minMatches

  // Evaluations done this day
  const evaluatedIds = new Set(evaluations.map((e) => e.referee_id))

  // Per-referee summary rows
  const perRef = rosterIds.map((id) => {
    const ref = refById[id]
    const dist = courtDist[id] || {}
    const courtsUsed = Object.keys(dist).length
    return {
      id,
      name: ref ? refereeName(ref) : '—',
      level: ref?.ranking_level || '—',
      matches: matches[id] || 0,
      rest: rounds - (matches[id] || 0),
      maxConsec: maxConsec[id] || 0,
      courtsUsed,
      courtDist: dist,
      evaluated: evaluatedIds.has(id),
    }
  }).sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name))

  return {
    rounds,
    courtsCount: courts.length,
    totalRefs: rosterIds.length,
    workingCount: workingRefs.length,
    minMatches,
    maxMatches,
    spread,
    evaluatedCount: evaluatedIds.size,
    perRef,
  }
}

// ── Rule-based advice for one day ───────────────────────────────────────────
export function dayAdvice(stats) {
  const tips = []
  if (stats.rounds === 0) {
    tips.push({ type: 'info', text: 'No rotation generated for this day yet.' })
    return tips
  }

  // 1. Workload balance
  if (stats.spread === 0 && stats.workingCount > 0) {
    tips.push({ type: 'good', text: `Workload perfectly balanced — every active referee worked ${stats.maxMatches} matches.` })
  } else if (stats.spread === 1) {
    tips.push({ type: 'good', text: `Workload well balanced (difference of 1 match between busiest and least busy referee).` })
  } else if (stats.spread >= 2) {
    const busiest = stats.perRef[0]
    const leastList = stats.perRef.filter((r) => r.matches > 0)
    const least = leastList[leastList.length - 1]
    tips.push({ type: 'warn', text: `Workload uneven: ${busiest.name} did ${busiest.matches} matches vs ${least.name} with ${least.matches}. Consider rebalancing the rotation.` })
  }

  // 2. Consecutive matches (fatigue)
  const tired = stats.perRef.filter((r) => r.maxConsec >= 3)
  if (tired.length > 0) {
    tips.push({ type: 'warn', text: `${tired.map((r) => `${r.name} (${r.maxConsec} in a row)`).join(', ')} worked 3+ consecutive rounds. Ensure enough rest between blocks.` })
  } else if (stats.rounds >= 2) {
    tips.push({ type: 'good', text: 'No referee exceeded 2 consecutive rounds — rest pattern is healthy.' })
  }

  // 3. Court variety
  const stuck = stats.perRef.filter((r) => r.matches >= 3 && r.courtsUsed === 1)
  if (stuck.length > 0) {
    tips.push({ type: 'warn', text: `${stuck.map((r) => r.name).join(', ')} stayed on a single court all day. Vary court assignments for fairness and exposure.` })
  }

  // 4. Present but unused
  const unused = stats.perRef.filter((r) => r.matches === 0)
  if (unused.length > 0) {
    tips.push({ type: 'warn', text: `${unused.map((r) => r.name).join(', ')} marked present but never assigned. Check attendance or include them in the rotation.` })
  }

  // 5. Evaluation coverage
  if (stats.workingCount > 0) {
    if (stats.evaluatedCount === 0) {
      tips.push({ type: 'info', text: 'No evaluations recorded today. Aim to assess referees during their matches.' })
    } else if (stats.evaluatedCount < stats.workingCount) {
      tips.push({ type: 'info', text: `${stats.evaluatedCount} of ${stats.workingCount} active referees evaluated today. Try to cover the remaining ${stats.workingCount - stats.evaluatedCount}.` })
    } else {
      tips.push({ type: 'good', text: 'All active referees were evaluated today — excellent coverage.' })
    }
  }

  return tips
}

// ── Aggregate across all days (general / commission report) ─────────────────
export function computeTournamentStats(dayReports) {
  // dayReports: [{ dayNumber, stats }]
  const totals = {} // refId -> { name, level, matches, days:Set, maxConsec, evaluatedDays }
  let totalRounds = 0
  let totalMatches = 0

  for (const { stats } of dayReports) {
    totalRounds += stats.rounds
    for (const r of stats.perRef) {
      if (!totals[r.id]) totals[r.id] = { id: r.id, name: r.name, level: r.level, matches: 0, days: 0, maxConsec: 0, evaluatedDays: 0 }
      totals[r.id].matches += r.matches
      if (r.matches > 0) totals[r.id].days += 1
      if (r.maxConsec > totals[r.id].maxConsec) totals[r.id].maxConsec = r.maxConsec
      if (r.evaluated) totals[r.id].evaluatedDays += 1
      totalMatches += r.matches
    }
  }

  const rows = Object.values(totals).sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name))
  const working = rows.filter((r) => r.matches > 0)
  const vals = working.map((r) => r.matches)
  const minM = vals.length ? Math.min(...vals) : 0
  const maxM = vals.length ? Math.max(...vals) : 0

  return {
    days: dayReports.length,
    totalRounds,
    totalMatches,
    minMatches: minM,
    maxMatches: maxM,
    spread: maxM - minM,
    rows,
  }
}

export function tournamentAdvice(tStats) {
  const tips = []
  if (tStats.rows.length === 0) {
    tips.push({ type: 'info', text: 'No assignment data across the tournament yet.' })
    return tips
  }
  if (tStats.spread <= 1) {
    tips.push({ type: 'good', text: `Across the whole tournament the workload was even (difference of ${tStats.spread} match overall).` })
  } else {
    const busiest = tStats.rows[0]
    const working = tStats.rows.filter((r) => r.matches > 0)
    const least = working[working.length - 1]
    tips.push({ type: 'warn', text: `Tournament workload spread: ${busiest.name} (${busiest.matches}) vs ${least.name} (${least.matches}). Spread of ${tStats.spread} matches over ${tStats.days} days.` })
  }
  const heavy = tStats.rows.filter((r) => r.maxConsec >= 3)
  if (heavy.length > 0) {
    tips.push({ type: 'warn', text: `${heavy.map((r) => r.name).join(', ')} hit 3+ consecutive rounds at least once. Review rest planning for future events.` })
  }
  return tips
}

// ════════════════════════════════════════════════════════════════════════════
//  Per-referee digests (Evening day digest + End-of-tournament evolution)
//  Used by the per-referee PDF/WhatsApp digests. Pure, deterministic, offline.
// ════════════════════════════════════════════════════════════════════════════
import { getGrade } from './scoring'

export const DIGEST_CRITERIA = [
  { key: 'positioning',  label: 'Positioning & Court Coverage' },
  { key: 'signals',      label: 'Signals & 3-Step Protocol' },
  { key: 'attitude',     label: 'Attitude & Player Management' },
  { key: 'captain_comm', label: 'Captain Communication' },
  { key: 'presentation', label: 'Presentation & Critical Situations' },
]

function _mean(nums) {
  const a = nums.filter((n) => typeof n === 'number' && !isNaN(n))
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null
}
function _r1(n) { return n == null ? null : Math.round(n * 10) / 10 }

// Average overall + per-criterion for a set of evaluations
export function evalAverages(evals) {
  return {
    overall: _r1(_mean(evals.map((e) => e.overall_score))),
    criteria: Object.fromEntries(
      DIGEST_CRITERIA.map((c) => [c.key, _r1(_mean(evals.map((e) => e[`score_${c.key}`])))])
    ),
  }
}

// One referee's day: per-round list + day averages
export function refereeDayDigest(evals) {
  const sorted = [...evals].sort((a, b) => new Date(a.evaluated_at) - new Date(b.evaluated_at))
  return {
    count: sorted.length,
    averages: evalAverages(sorted),
    matches: sorted.map((e) => ({
      id: e.id,
      tournament_id: e.tournament_id,
      day_number: e.day_number,
      evaluated_at: e.evaluated_at,
      label: e.match_description || '—',
      role: e.role || 'R1',
      overall: e.overall_score,
      scores: Object.fromEntries(DIGEST_CRITERIA.map((c) => [c.key, e[`score_${c.key}`]])),
      repeats: Object.fromEntries(DIGEST_CRITERIA.map((c) => [c.key, !!e[`repeat_${c.key}`]])),
      notes: Object.fromEntries(DIGEST_CRITERIA.map((c) => [c.key, e[`note_${c.key}`] || ''])),
      general: e.general_notes || '',
    })),
  }
}

// One referee across the whole tournament: per-day averages + evolution deltas
export function refereeEvolution(evals) {
  const byDay = {}
  evals.forEach((e) => {
    const d = e.day_number || 1
    ;(byDay[d] = byDay[d] || []).push(e)
  })
  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b)
  const perDay = days.map((d) => ({ day: d, count: byDay[d].length, averages: evalAverages(byDay[d]) }))

  let evolution = null
  if (perDay.length >= 2) {
    const first = perDay[0].averages
    const last = perDay[perDay.length - 1].averages
    const delta = (a, b) => (a == null || b == null ? null : _r1(b - a))
    evolution = {
      fromDay: perDay[0].day,
      toDay: perDay[perDay.length - 1].day,
      overall: delta(first.overall, last.overall),
      criteria: Object.fromEntries(
        DIGEST_CRITERIA.map((c) => [c.key, delta(first.criteria[c.key], last.criteria[c.key])])
      ),
    }
  }
  return { perDay, evolution, overall: evalAverages(evals), count: evals.length }
}

// Auto summary + advice for ONE referee across the tournament (English)
export function refereeTournamentAdvice(evals) {
  const ev = refereeEvolution(evals)
  const avg = ev.overall
  if (avg.overall == null) {
    return { summary: 'No scored evaluations recorded for this referee.', advice: '', trend: 'na' }
  }
  const grade = getGrade(avg.overall).grade

  // Strongest / weakest criterion by tournament average
  const rated = DIGEST_CRITERIA
    .map((c) => ({ ...c, v: avg.criteria[c.key] }))
    .filter((c) => c.v != null)
    .sort((a, b) => b.v - a.v)
  const strongest = rated[0]
  const weakest = rated[rated.length - 1]

  // Repeated faults across the tournament
  const repeatCounts = Object.fromEntries(DIGEST_CRITERIA.map((c) => [c.key, 0]))
  evals.forEach((e) => DIGEST_CRITERIA.forEach((c) => { if (e[`repeat_${c.key}`]) repeatCounts[c.key]++ }))
  const flagged = DIGEST_CRITERIA.filter((c) => repeatCounts[c.key] >= 2)

  // Trend
  let trend = 'stable'
  const d = ev.evolution?.overall
  if (typeof d === 'number') {
    if (d >= 0.3) trend = 'improving'
    else if (d <= -0.3) trend = 'declining'
  }

  const dayWord = ev.perDay.length === 1 ? 'day' : `${ev.perDay.length} days`
  let summary = `Over ${ev.count} match${ev.count === 1 ? '' : 'es'} across ${dayWord}, the average performance was ${avg.overall.toFixed(1)}/5 (${grade}).`
  if (ev.evolution && typeof d === 'number') {
    const arrow = d > 0 ? 'up' : d < 0 ? 'down' : 'flat'
    const sign = d > 0 ? '+' : ''
    summary += ` Performance was ${trend} from Day ${ev.evolution.fromDay} to Day ${ev.evolution.toDay} (${sign}${d.toFixed(1)} overall, trending ${arrow}).`
  }

  // Advice
  const tips = []
  if (trend === 'improving') tips.push('Good progression through the tournament — acknowledge the improvement and keep building on it.')
  else if (trend === 'declining') tips.push('Performance dropped over the tournament — check for fatigue or confidence and give targeted support before the next event.')
  else tips.push('Performance was consistent across the tournament.')

  if (weakest && weakest.v != null && weakest.v < 3.5) {
    tips.push(`Main area to work on: ${weakest.label.toLowerCase()} (avg ${weakest.v.toFixed(1)}).`)
  }
  if (strongest && strongest.v != null && strongest.v >= 4) {
    tips.push(`Strength to maintain: ${strongest.label.toLowerCase()} (avg ${strongest.v.toFixed(1)}).`)
  }
  if (flagged.length) {
    tips.push(`Recurring faults flagged in: ${flagged.map((c) => c.label.toLowerCase()).join(', ')} — address these specifically.`)
  }

  return { summary, advice: tips.join(' '), trend, grade, strongest, weakest }
}
