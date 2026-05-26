/**
 * Logic to check if a referee has too many consecutive matches (no pause)
 * and suggest breaks
 */

export function checkConsecutiveMatches(assignments, refereeId, currentCourt, currentSessionOrder) {
  /**
   * Group assignments by referee and check consecutive sequences
   * Returns: { isViolation, consecutiveCount, courts }
   */
  const refAssignments = assignments
    .filter(a => a.referee_id === refereeId)
    .sort((a, b) => {
      if (a.day_number !== b.day_number) return a.day_number - b.day_number
      if (a.section_number !== b.section_number) return a.section_number - b.section_number
      return a.session_order - b.session_order
    })

  let maxConsecutive = 1
  let currentConsecutive = 1
  let courtSequence = [refAssignments[0]?.court]
  let maxCourtSequence = [refAssignments[0]?.court]

  for (let i = 1; i < refAssignments.length; i++) {
    const prev = refAssignments[i - 1]
    const curr = refAssignments[i]

    // Check if consecutive (same court, next session in chronological order)
    const isConsecutive =
      prev.court === curr.court &&
      prev.day_number === curr.day_number &&
      prev.section_number === curr.section_number &&
      curr.session_order === prev.session_order + 1

    if (isConsecutive) {
      currentConsecutive++
      courtSequence.push(curr.court)
    } else {
      if (currentConsecutive > maxConsecutive) {
        maxConsecutive = currentConsecutive
        maxCourtSequence = courtSequence
      }
      currentConsecutive = 1
      courtSequence = [curr.court]
    }
  }

  // Check final sequence
  if (currentConsecutive > maxConsecutive) {
    maxConsecutive = currentConsecutive
    maxCourtSequence = courtSequence
  }

  // If adding the current assignment, would it exceed the limit?
  const wouldViolate = maxConsecutive >= 3

  return {
    isViolation: wouldViolate,
    consecutiveCount: maxConsecutive,
    courts: maxCourtSequence,
    message: wouldViolate
      ? `⚠️ ${refAssignments[0]?.referees?.last_name || 'Referee'} has ${maxConsecutive} consecutive matches on ${maxCourtSequence.join(', ')}. Consider a break!`
      : null,
  }
}

export function getAssignmentSummary(assignments, refereeId) {
  /**
   * Get a summary of where a referee is assigned
   */
  const refAssignments = assignments.filter(a => a.referee_id === refereeId)
  const courtCounts = {}
  const sessionCounts = {}

  for (const a of refAssignments) {
    courtCounts[a.court] = (courtCounts[a.court] || 0) + 1
    const key = `M${a.session_order}`
    sessionCounts[key] = (sessionCounts[key] || 0) + 1
  }

  return {
    totalAssignments: refAssignments.length,
    courtCounts,
    sessionCounts,
    courts: Object.keys(courtCounts),
    sessions: Object.keys(sessionCounts),
  }
}
