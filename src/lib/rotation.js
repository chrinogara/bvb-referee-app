/**
 * Auto-assign referees to courts using a rotation pattern.
 *
 * Pattern grammar (each token = one session per court):
 *   M1, M2, M3...   → referee works that session
 *   PAUSE           → referee rests this session
 *   Pattern length = total sessions in the day
 *
 * Default pattern: "M1-M2-PAUSE-M3" (4 sessions: work, work, rest, work)
 *
 * Algorithm:
 * 1. For each court: figure out how many referees are needed concurrently.
 * 2. Distribute present referees round-robin per session, skipping refs marked PAUSE.
 * 3. Returns an array of { court, session_order, referee_id, role } rows.
 *
 * Inputs:
 *   - presentReferees: array of referee objects (already filtered by attendance)
 *   - courts: array of court labels e.g. ["Court 1", "Court 2", "Court 3"]
 *   - pattern: string e.g. "M1-M2-PAUSE-M3"
 *   - sessionsPerCourt: optional override of pattern length
 *
 * Returns: { assignments: [...], warnings: [...] }
 */
export function autoAssign({
  presentReferees,
  courts,
  pattern = 'M1-M2-PAUSE-M3',
  defaultRole = 'R1',
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

  // Each court needs 1 referee per session (R1 only for regular matches).
  // Finals would need more but that's edge case — handled manually.
  const slotsPerSession = courts.length
  const totalWorkSlots = workSessions * slotsPerSession

  const warnings = []

  if (presentReferees.length < courts.length) {
    warnings.push(
      `Only ${presentReferees.length} referees present for ${courts.length} courts — some sessions will be unassigned.`
    )
  }

  // Sort referees by ranking_level (A > B > C) then by name for stability
  const refs = [...presentReferees].sort((a, b) => {
    const order = { A: 0, B: 1, C: 2 }
    const da = (order[a.ranking_level] ?? 9) - (order[b.ranking_level] ?? 9)
    if (da !== 0) return da
    return a.last_name.localeCompare(b.last_name)
  })

  const assignments = []
  // Pointer into the rotated referee list — advances every assignment
  let refIdx = 0

  // For each session, fill all courts
  for (let s = 0; s < totalSessions; s++) {
    const token = tokens[s]
    if (token === 'PAUSE') continue // Whole day pauses — skip (but we still increment)

    for (let c = 0; c < courts.length; c++) {
      const ref = refs[refIdx % refs.length]
      assignments.push({
        court: courts[c],
        session_order: s + 1,
        referee_id: ref.id,
        role: defaultRole,
        _refereeObj: ref, // hint for UI rendering
      })
      refIdx++
    }
  }

  // Compute pause assignments: a referee who has < workSessions actual work assignments
  // gets a virtual PAUSE entry so the UI can show their full day timeline.
  const workCountByRef = {}
  for (const a of assignments) workCountByRef[a.referee_id] = (workCountByRef[a.referee_id] || 0) + 1

  const pauseAssignments = []
  for (const ref of refs) {
    const worked = workCountByRef[ref.id] || 0
    // The "ideal" is workSessions per ref if refs == courts; otherwise prorated
    // We don't add fake pause sessions to DB; UI computes them.
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
  { value: 'M1-M2-PAUSE-M3',         label: '4 sessions (work-work-pause-work)', sessions: 4 },
  { value: 'M1-M2-PAUSE-M3-M4',      label: '5 sessions (work-work-pause-work-work)', sessions: 5 },
  { value: 'M1-PAUSE-M2-PAUSE-M3',   label: '5 sessions (sparse pauses)', sessions: 5 },
  { value: 'M1-M2-M3',               label: '3 sessions (no pause)', sessions: 3 },
  { value: 'M1-M2-PAUSE-M3-PAUSE-M4', label: '6 sessions (heavy day)', sessions: 6 },
]
