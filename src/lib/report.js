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
