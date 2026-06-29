// ─────────────────────────────────────────────────────────────────────────────
// Schedule-based referee auto-assignment.
// Assigns ONE referee (role R1) per match, using the same principles as the
// rotation engine: 2ON/2OFF balance, MAX_CONSEC hard cap, no double-booking in
// the same time slot, and meritocratic finals (top-ranked → most prestigious).
// Pure & deterministic given the inputs → unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_CONSEC = 2

// Prestige order for finals: PRO before CHALLENGE, Men (M) before Women (F).
function finalPrestige(m) {
  return (m.series === 'PRO' ? 0 : 1) * 2 + (m.gender === 'M' ? 0 : 1)
}

/**
 * @param {Array} matches  - [{id, match_number, court, scheduled_time, round, series, gender, is_final}]
 * @param {Array} presentRanked - present referees, BEST→WORST (e.g. by avg_score desc)
 * @param {number} maxConsec
 * @returns {Object} map matchId -> refereeId (matches with no available ref are omitted)
 */
export function autoAssignSchedule(matches, presentRanked, maxConsec = MAX_CONSEC) {
  matches = matches.filter((m) => m.referees_needed !== 0) // skip self-refereed matches
  const refIds = presentRanked.map((r) => r.id)
  if (refIds.length === 0) return {}
  const rankIndex = {}; presentRanked.forEach((r, i) => { rankIndex[r.id] = i })

  // Group matches into time slots, preserving chronological order of arrival.
  const slotsMap = new Map()
  const order = []
  const sorted = [...matches].sort((a, b) => {
    const ta = a.scheduled_time || ''
    const tb = b.scheduled_time || ''
    if (ta !== tb) return ta < tb ? -1 : 1
    return (a.match_number || 0) - (b.match_number || 0)
  })
  for (const m of sorted) {
    const key = m.scheduled_time || `m${m.match_number}`
    if (!slotsMap.has(key)) { slotsMap.set(key, []); order.push(key) }
    slotsMap.get(key).push(m)
  }

  // Meritocratic finals: sort by prestige, assign best present refs in order.
  const finals = matches.filter((m) => m.is_final)
    .sort((a, b) => finalPrestige(a) - finalPrestige(b) || (a.match_number || 0) - (b.match_number || 0))
  const finalRef = {}
  finals.forEach((m, i) => { if (refIds[i] != null) finalRef[m.id] = refIds[i] })

  const consec = {}; refIds.forEach((r) => { consec[r] = 0 })
  const load = {}; refIds.forEach((r) => { load[r] = 0 })
  const assign = {}

  for (const key of order) {
    const slot = slotsMap.get(key)
    const used = new Set()
    // 1) pin finals first
    for (const m of slot) {
      if (finalRef[m.id]) { assign[m.id] = finalRef[m.id]; used.add(finalRef[m.id]) }
    }
    // 2) fill the rest — no double-book, prefer under the consecutive cap, balance load
    for (const m of slot) {
      if (assign[m.id]) continue
      const cand = refIds.filter((r) => !used.has(r))
      if (cand.length === 0) continue
      const under = cand.filter((r) => consec[r] < maxConsec)
      const pool = under.length ? under : cand
      pool.sort((a, b) => (load[a] - load[b]) || (consec[a] - consec[b]) || (rankIndex[a] - rankIndex[b]))
      const r = pool[0]
      assign[m.id] = r
      used.add(r)
    }
    // 3) update consecutive-on / workload
    for (const r of refIds) {
      if (used.has(r)) { consec[r] += 1; load[r] += 1 }
      else consec[r] = 0
    }
  }
  return assign
}

/**
 * Assign referees for ONE time slot only, while respecting the state built up by
 * the slots that come BEFORE it (workload balance + consecutive-on cap), read from
 * the assignments already saved. Finals are pinned meritocratically (top-ranked →
 * most prestigious) whenever the final falls inside the slot being generated.
 *
 * @param {Array}  allMatches    - every match of the day (used to rebuild slot order + prior state)
 * @param {string} slotKey       - the scheduled_time string of the slot to generate
 * @param {Array}  presentRanked - present referees, BEST→WORST
 * @param {Object} existingAssign- matchId -> refereeId already saved (prior slots)
 * @param {number} maxConsec
 * @returns {Object} map matchId -> refereeId for the matches of THIS slot only
 */
export function autoAssignSlot(allMatches, slotKey, presentRanked, existingAssign = {}, maxConsec = MAX_CONSEC) {
  allMatches = allMatches.filter((m) => m.referees_needed !== 0) // skip self-refereed matches
  const refIds = presentRanked.map((r) => r.id)
  if (refIds.length === 0) return {}
  const rankIndex = {}; presentRanked.forEach((r, i) => { rankIndex[r.id] = i })

  const slotsMap = new Map()
  const order = []
  const sorted = [...allMatches].sort((a, b) => {
    const ta = a.scheduled_time || ''
    const tb = b.scheduled_time || ''
    if (ta !== tb) return ta < tb ? -1 : 1
    return (a.match_number || 0) - (b.match_number || 0)
  })
  for (const m of sorted) {
    const key = m.scheduled_time || `m${m.match_number}`
    if (!slotsMap.has(key)) { slotsMap.set(key, []); order.push(key) }
    slotsMap.get(key).push(m)
  }

  // Meritocratic finals (global, derived from ranking).
  const finals = allMatches.filter((m) => m.is_final)
    .sort((a, b) => finalPrestige(a) - finalPrestige(b) || (a.match_number || 0) - (b.match_number || 0))
  const finalRef = {}
  finals.forEach((m, i) => { if (refIds[i] != null) finalRef[m.id] = refIds[i] })

  const consec = {}; refIds.forEach((r) => { consec[r] = 0 })
  const load = {}; refIds.forEach((r) => { load[r] = 0 })

  for (const key of order) {
    const slot = slotsMap.get(key)
    if (key === slotKey) {
      // Generate this slot fresh.
      const used = new Set()
      const out = {}
      for (const m of slot) {
        if (finalRef[m.id]) { out[m.id] = finalRef[m.id]; used.add(finalRef[m.id]) }
      }
      for (const m of slot) {
        if (out[m.id]) continue
        const cand = refIds.filter((r) => !used.has(r))
        if (cand.length === 0) continue
        const under = cand.filter((r) => consec[r] < maxConsec)
        const pool = under.length ? under : cand
        pool.sort((a, b) => (load[a] - load[b]) || (consec[a] - consec[b]) || (rankIndex[a] - rankIndex[b]))
        const r = pool[0]
        out[m.id] = r
        used.add(r)
      }
      return out
    }
    // Prior slot: accrue load + consecutive-on from the assignments already saved.
    const used = new Set()
    for (const m of slot) {
      const r = existingAssign[m.id]
      if (r && refIds.includes(r)) used.add(r)
    }
    for (const r of refIds) {
      if (used.has(r)) { consec[r] += 1; load[r] += 1 }
      else consec[r] = 0
    }
  }
  return {}
}

// Detect referees double-booked within the same time slot (should never happen
// after auto-assign, but manual overrides can create conflicts).
export function findSlotConflicts(matches, assignMap) {
  const bySlot = {}
  for (const m of matches) {
    const refId = assignMap[m.id]
    if (!refId) continue
    const key = m.scheduled_time || `m${m.match_number}`
    bySlot[key] = bySlot[key] || {}
    bySlot[key][refId] = (bySlot[key][refId] || 0) + 1
  }
  const conflicted = new Set() // matchId set
  for (const m of matches) {
    const refId = assignMap[m.id]
    if (!refId) continue
    const key = m.scheduled_time || `m${m.match_number}`
    if (bySlot[key][refId] > 1) conflicted.add(m.id)
  }
  return conflicted
}
