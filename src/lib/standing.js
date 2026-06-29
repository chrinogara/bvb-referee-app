// ─────────────────────────────────────────────────────────────────────────────
// Persistent referee standing (cross-tournament).
//
// Idea: every referee has a STARTING level (ranking_level A/B/C) set on the
// Referees page. That level is the anchor the referee starts from. As the
// referee is evaluated — across ALL tournaments — a cumulative standing score
// moves up or down, and the EFFECTIVE level letter is recomputed from it.
//
//   • 0 evaluations  → standing = anchor of the starting level
//   • few evaluations → blend of anchor + cumulative average
//   • many evaluations → essentially the cumulative average
//
// The blend is a shrinkage mean: standing = (anchor*K + avg*n) / (K + n)
// where n = total evaluations across all tournaments, K = ANCHOR_WEIGHT.
// With K = 3, after ~3 evaluations the evaluations weigh as much as the anchor.
// ─────────────────────────────────────────────────────────────────────────────

export const LEVEL_ANCHOR = { A: 4.5, B: 3.5, C: 2.5 }
export const DEFAULT_LEVEL = 'B'
export const ANCHOR_WEIGHT = 3

// Effective-level thresholds (on the 1–5 standing scale)
export const LEVEL_FROM_STANDING = [
  { min: 4.0, level: 'A' },
  { min: 3.0, level: 'B' },
  { min: 0.0, level: 'C' },
]

export function anchorFor(level) {
  return LEVEL_ANCHOR[level] ?? LEVEL_ANCHOR[DEFAULT_LEVEL]
}

/**
 * Cumulative standing score (1–5) for a referee.
 * @param {{ranking_level?:string, avg_score?:number|null, total_evaluations?:number}} r
 */
export function computeStanding(r) {
  const anchor = anchorFor(r?.ranking_level)
  const n = Number(r?.total_evaluations) || 0
  const avg = r?.avg_score == null ? null : Number(r.avg_score)
  if (!n || avg == null || Number.isNaN(avg)) return anchor
  const s = (anchor * ANCHOR_WEIGHT + avg * n) / (ANCHOR_WEIGHT + n)
  return Math.round(s * 100) / 100
}

export function standingToLevel(s) {
  for (const t of LEVEL_FROM_STANDING) if (s >= t.min) return t.level
  return 'C'
}

/**
 * Effective level letter. With no evaluations it stays the starting letter;
 * once evaluations exist it is recomputed from the cumulative standing.
 */
export function effectiveLevel(r) {
  const n = Number(r?.total_evaluations) || 0
  if (!n) return r?.ranking_level || DEFAULT_LEVEL
  return standingToLevel(computeStanding(r))
}

/** Did the effective level move away from the starting level? */
export function levelChanged(r) {
  const start = r?.ranking_level || DEFAULT_LEVEL
  return effectiveLevel(r) !== start
}
