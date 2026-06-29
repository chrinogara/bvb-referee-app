// ─────────────────────────────────────────────────────────────────────────────
// Schedule-based referee auto-assignment.
// Assigns R1 (and R2 where a match needs two referees) using the rotation
// principles: 2ON/2OFF balance, MAX_CONSEC hard cap, no double-booking in the
// same time slot, and MERITOCRATIC finals (best-evaluated refs → most
// prestigious matches, for BOTH R1 and R2).
// Pure & deterministic given the inputs → unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_CONSEC = 2

// How many referees a match needs. Explicit per-match value wins (0 = self-
// refereed, 1, 2). Fallback heuristic (no value set, e.g. Hemiksem): finals and
// PRO semifinals get two referees.
export function needsTwoRefs(m) {
  if (m.referees_needed != null) return m.referees_needed >= 2
  return !!m.is_final || (m.series === 'PRO' && /semi/i.test(m.round || ''))
}

// Prestige order for finals: PRO before CHALLENGE, Men (M) before Women (F).
function finalPrestige(m) {
  return (m.series === 'PRO' ? 0 : 1) * 2 + (m.gender === 'M' ? 0 : 1)
}

const slotKeyOf = (m) => m.scheduled_time || `m${m.match_number}`

function buildSlots(matches) {
  const slotsMap = new Map()
  const order = []
  const sorted = [...matches].sort((a, b) => {
    const ta = a.scheduled_time || '', tb = b.scheduled_time || ''
    if (ta !== tb) return ta < tb ? -1 : 1
    return (a.match_number || 0) - (b.match_number || 0)
  })
  for (const m of sorted) {
    const key = slotKeyOf(m)
    if (!slotsMap.has(key)) { slotsMap.set(key, []); order.push(key) }
    slotsMap.get(key).push(m)
  }
  return { slotsMap, order }
}

/**
 * @param {Array} matches  - [{id, match_number, court, scheduled_time, round, series, gender, is_final, referees_needed}]
 * @param {Array} presentRanked - present referees, BEST→WORST (by evaluation avg desc)
 * @param {number} maxConsec
 * @returns {{r1: Object, r2: Object}} matchId -> refereeId maps for first and second referee
 */
export function autoAssignSchedule(matches, presentRanked, maxConsec = MAX_CONSEC) {
  matches = matches.filter((m) => m.referees_needed !== 0) // skip self-refereed matches
  const refIds = presentRanked.map((r) => r.id)
  if (refIds.length === 0) return { r1: {}, r2: {} }
  const rankIndex = {}; presentRanked.forEach((r, i) => { rankIndex[r.id] = i })

  const { slotsMap, order } = buildSlots(matches)

  const r1 = {}, r2 = {}
  const slotUsed = {}                                  // slotKey -> Set(refId)
  const useIn = (k, id) => { (slotUsed[k] || (slotUsed[k] = new Set())).add(id) }
  const usedIn = (k, id) => slotUsed[k] && slotUsed[k].has(id)

  // ── Meritocratic finals (R1 + R2): prestige order, best-evaluated refs ───────
  // Pick the ref doing the FEWEST finals so far (spreads the showcase matches),
  // tie-break by ranking → the most prestigious final gets the strongest officials.
  const finalLoad = {}; refIds.forEach((r) => { finalLoad[r] = 0 })
  const finals = matches.filter((m) => m.is_final)
    .sort((a, b) => finalPrestige(a) - finalPrestige(b) || (a.match_number || 0) - (b.match_number || 0))
  function pickFinal(k, exclude) {
    let best = null
    for (const id of refIds) {
      if (id === exclude || usedIn(k, id)) continue
      if (best === null || finalLoad[id] < finalLoad[best] ||
         (finalLoad[id] === finalLoad[best] && rankIndex[id] < rankIndex[best])) best = id
    }
    return best
  }
  for (const m of finals) {
    const k = slotKeyOf(m)
    const a = pickFinal(k, null)
    if (a != null) { r1[m.id] = a; useIn(k, a); finalLoad[a] += 1 }
    if (needsTwoRefs(m)) {
      const b = pickFinal(k, a)
      if (b != null) { r2[m.id] = b; useIn(k, b); finalLoad[b] += 1 }
    }
  }

  // ── Rotation for the rest: R1 of non-finals, then R2 of non-final 2-ref games ─
  const consec = {}; refIds.forEach((r) => { consec[r] = 0 })
  const load = {}; refIds.forEach((r) => { load[r] = 0 })
  const rotPick = (key, exclude) => {
    const cand = refIds.filter((r) => !usedIn(key, r) && r !== exclude)
    if (cand.length === 0) return null
    const under = cand.filter((r) => consec[r] < maxConsec)
    const pool = under.length ? under : cand
    pool.sort((a, b) => (load[a] - load[b]) || (consec[a] - consec[b]) || (rankIndex[a] - rankIndex[b]))
    return pool[0]
  }

  for (const key of order) {
    const slot = slotsMap.get(key)
    for (const m of slot) {                            // R1 for non-finals
      if (r1[m.id]) continue
      const r = rotPick(key, null)
      if (r != null) { r1[m.id] = r; useIn(key, r) }
    }
    for (const m of slot) {                            // R2 for non-final 2-ref matches
      if (r2[m.id] || !needsTwoRefs(m)) continue
      const r = rotPick(key, r1[m.id])
      if (r != null) { r2[m.id] = r; useIn(key, r) }
    }
    const worked = slotUsed[key] || new Set()          // accrue consec/load
    for (const r of refIds) {
      if (worked.has(r)) { consec[r] += 1; load[r] += 1 } else consec[r] = 0
    }
  }
  return { r1, r2 }
}

/**
 * Assign referees for ONE time slot only, respecting state built up by prior
 * slots (workload + consecutive-on cap) read from the assignments already saved.
 * Returns R1 (+R2 where needed) for the matches of THIS slot only.
 */
export function autoAssignSlot(allMatches, slotKey, presentRanked, existingAssign = {}, existingAssign2 = {}, maxConsec = MAX_CONSEC) {
  allMatches = allMatches.filter((m) => m.referees_needed !== 0) // skip self-refereed
  const refIds = presentRanked.map((r) => r.id)
  if (refIds.length === 0) return { r1: {}, r2: {} }
  const rankIndex = {}; presentRanked.forEach((r, i) => { rankIndex[r.id] = i })

  const { slotsMap, order } = buildSlots(allMatches)

  const consec = {}; refIds.forEach((r) => { consec[r] = 0 })
  const load = {}; refIds.forEach((r) => { load[r] = 0 })

  for (const key of order) {
    const slot = slotsMap.get(key)
    if (key === slotKey) {
      const used = new Set()
      const r1 = {}, r2 = {}
      const usedIn = (id) => used.has(id)
      // finals in this slot → best-evaluated available (R1 then R2), prestige order
      const finalsHere = slot.filter((m) => m.is_final)
        .sort((a, b) => finalPrestige(a) - finalPrestige(b) || (a.match_number || 0) - (b.match_number || 0))
      const bestFree = (exclude) => {
        let b = null
        for (const id of refIds) { if (id === exclude || usedIn(id)) continue; if (b === null || rankIndex[id] < rankIndex[b]) b = id }
        return b
      }
      for (const m of finalsHere) {
        const a = bestFree(null); if (a != null) { r1[m.id] = a; used.add(a) }
        if (needsTwoRefs(m)) { const b = bestFree(a); if (b != null) { r2[m.id] = b; used.add(b) } }
      }
      const rotPick = (exclude) => {
        const cand = refIds.filter((r) => !usedIn(r) && r !== exclude)
        if (!cand.length) return null
        const under = cand.filter((r) => consec[r] < maxConsec)
        const pool = under.length ? under : cand
        pool.sort((a, b) => (load[a] - load[b]) || (consec[a] - consec[b]) || (rankIndex[a] - rankIndex[b]))
        return pool[0]
      }
      for (const m of slot) { if (r1[m.id]) continue; const r = rotPick(null); if (r != null) { r1[m.id] = r; used.add(r) } }
      for (const m of slot) { if (r2[m.id] || !needsTwoRefs(m)) continue; const r = rotPick(r1[m.id]); if (r != null) { r2[m.id] = r; used.add(r) } }
      return { r1, r2 }
    }
    // prior slot: accrue load + consecutive-on from saved assignments (R1 + R2)
    const used = new Set()
    for (const m of slot) {
      for (const r of [existingAssign[m.id], existingAssign2[m.id]]) if (r && refIds.includes(r)) used.add(r)
    }
    for (const r of refIds) { if (used.has(r)) { consec[r] += 1; load[r] += 1 } else consec[r] = 0 }
  }
  return { r1: {}, r2: {} }
}

// Detect referees double-booked within the same time slot (R1 only — manual
// overrides can create conflicts the auto-assign never would).
export function findSlotConflicts(matches, assignMap) {
  const bySlot = {}
  for (const m of matches) {
    const refId = assignMap[m.id]
    if (!refId) continue
    const key = slotKeyOf(m)
    bySlot[key] = bySlot[key] || {}
    bySlot[key][refId] = (bySlot[key][refId] || 0) + 1
  }
  const conflicted = new Set()
  for (const m of matches) {
    const refId = assignMap[m.id]
    if (!refId) continue
    const key = slotKeyOf(m)
    if (bySlot[key][refId] > 1) conflicted.add(m.id)
  }
  return conflicted
}
