/**
 * Auto-assign referees to courts using a rotation pattern.
 *
 * Pattern grammar (each token = one session per court):
 *   M1, M2, M3...   → referee works that session
 *   PAUSE           → referee rests this session
 *
 * Sections of the same day (Part 1, Part 2, Part 3...) are mixed: from the
 * second section onward the algorithm receives the previous sections via
 * `history` and avoids (a) putting a referee back on a court already worked,
 * and (b) re-forming the same court "pair" of referees.
 *
 * Inputs:
 *   - presentReferees: array of referee objects (already filtered by attendance)
 *   - courts: array of court labels e.g. ["Court 1", "Court 2", ...]
 *   - pattern: string e.g. "M1-M2-M3-M4"
 *   - sectionOffset: legacy rotation offset (used only for the first section)
 *   - history: array of previous assignments for the day
 *              [{ referee_id, court, section_number }, ...]
 *
 * Returns: { assignments, warnings, totalSessions, pattern }
 */
export function autoAssign({
  presentReferees,
  courts,
  pattern = 'M1-M2-PAUSE-M3',
  defaultRole = 'R1',
  sectionOffset = 0,
  history = [],
}) {
  if (!presentReferees?.length) {
    return { assignments: [], warnings: ['No referees marked as present.'] }
  }
  if (!courts?.length) {
    return { assignments: [], warnings: ['No courts configured.'] }
  }

  const tokens = pattern.split('-').map((t) => t.trim().toUpperCase())
  const totalSessions = tokens.length
  const workSessions = tokens.filter((t) => t !== 'PAUSE').length
  const C = courts.length

  const warnings = []
  if (presentReferees.length < C) {
    warnings.push(
      `Only ${presentReferees.length} referees present for ${C} courts — some sessions will be unassigned.`
    )
  }

  const maxSessionsPerRef = workSessions > C ? workSessions - 1 : workSessions

  // Stable base ordering: ranking_level (A > B > C) then last name.
  const sorted = [...presentReferees].sort((a, b) => {
    const order = { A: 0, B: 1, C: 2 }
    const da = (order[a.ranking_level] ?? 9) - (order[b.ranking_level] ?? 9)
    if (da !== 0) return da
    return (a.last_name || '').localeCompare(b.last_name || '')
  })

  // ── Memory of previous sections (from `history`) ───────────────────────────
  // courtsByRef: which courts a referee already worked today
  // partnersByRef: which referees already shared a court with a given referee
  const courtsByRef = {}
  const partnersByRef = {}
  const prevGroups = {} // `${section}|${court}` -> array of referee_id
  for (const h of history || []) {
    if (!h || h.referee_id == null || h.court == null) continue
    if (!courtsByRef[h.referee_id]) courtsByRef[h.referee_id] = new Set()
    courtsByRef[h.referee_id].add(h.court)
    const k = `${h.section_number}|${h.court}`
    if (!prevGroups[k]) prevGroups[k] = new Set()
    prevGroups[k].add(h.referee_id)
  }
  for (const k in prevGroups) {
    const arr = [...prevGroups[k]]
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue
        if (!partnersByRef[arr[i]]) partnersByRef[arr[i]] = new Set()
        partnersByRef[arr[i]].add(arr[j])
      }
    }
  }

  // Build assignments from a given referee ordering (original round-robin).
  function buildFromOrder(order) {
    const refSessionCount = {}
    order.forEach((r) => {
      refSessionCount[r.id] = 0
    })
    const asg = []
    let idx = 0
    for (let s = 0; s < totalSessions; s++) {
      if (tokens[s] === 'PAUSE') continue
      for (let c = 0; c < C; c++) {
        let assigned = false
        let attempts = 0
        while (!assigned && attempts < order.length * 2) {
          const ref = order[idx % order.length]
          if (refSessionCount[ref.id] < maxSessionsPerRef) {
            asg.push({
              court: courts[c],
              session_order: s + 1,
              referee_id: ref.id,
              role: defaultRole,
              _refereeObj: ref,
            })
            refSessionCount[ref.id]++
            assigned = true
          }
          idx++
          attempts++
        }
      }
    }
    return asg
  }

  // Count how many history constraints an arrangement breaks.
  function countViolations(asg) {
    let v = 0
    for (const a of asg) {
      if (courtsByRef[a.referee_id] && courtsByRef[a.referee_id].has(a.court)) v++
    }
    const g = {}
    for (const a of asg) {
      if (!g[a.court]) g[a.court] = new Set()
      g[a.court].add(a.referee_id)
    }
    for (const court in g) {
      const arr = [...g[court]]
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          if (partnersByRef[arr[i]] && partnersByRef[arr[i]].has(arr[j])) v++
        }
      }
    }
    return v
  }

  function shuffled(arr) {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = a[i]
      a[i] = a[j]
      a[j] = tmp
    }
    return a
  }

  let assignments
  const hasHistory = (history || []).length > 0

  if (!hasHistory) {
    // First section of the day → keep the original deterministic layout.
    const off = sorted.length ? sectionOffset % sorted.length : 0
    const order = sorted.slice(off).concat(sorted.slice(0, off))
    assignments = buildFromOrder(order)
  } else {
    // Later sections → search for an ordering that avoids reusing courts and
    // pairs from earlier sections. Try sorted first, then random shuffles,
    // keeping the arrangement with the fewest repeats (0 = perfect mix).
    let best = buildFromOrder(sorted)
    let bestV = countViolations(best)
    const MAX_TRIES = 5000
    for (let t = 0; t < MAX_TRIES && bestV > 0; t++) {
      const cand = buildFromOrder(shuffled(sorted))
      const v = countViolations(cand)
      if (v < bestV) {
        best = cand
        bestV = v
      }
    }
    assignments = best
    if (bestV > 0) {
      warnings.push(
        `Couldn't fully avoid repeats: ${bestV} court/pair overlap(s) with earlier sections (too few referees or courts to keep every section unique). Used the arrangement with the fewest repeats.`
      )
    }
  }

  return { assignments, warnings, totalSessions, pattern: tokens }
}

/**
 * Validate that no referee is double-booked at the same session.
 */
export function validateAssignments(assignments) {
  const conflicts = []
  const seen = {}
  for (const a of assignments) {
    const key = `${a.referee_id}|${a.session_order}`
    if (seen[key]) {
      conflicts.push({ referee_id: a.referee_id, session_order: a.session_order })
    }
    seen[key] = true
  }
  return conflicts
}

/**
 * Common rotation presets.
 */
export const ROTATION_PRESETS = [
  { value: 'M1-M2-M3-M4',            label: '4 sessions (auto pause per referee)', sessions: 4 },
  { value: 'M1-M2-PAUSE-M3',         label: '4 sessions (work-work-pause-work)', sessions: 4 },
  { value: 'M1-M2-PAUSE-M3-M4',      label: '5 sessions (work-work-pause-work-work)', sessions: 5 },
  { value: 'M1-PAUSE-M2-PAUSE-M3',   label: '5 sessions (sparse pauses)', sessions: 5 },
  { value: 'M1-M2-M3',               label: '3 sessions (no pause)', sessions: 3 },
  { value: 'M1-M2-PAUSE-M3-PAUSE-M4', label: '6 sessions (heavy day)', sessions: 6 },
]
