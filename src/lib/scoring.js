// FIVB evaluation scoring logic

export const WEIGHTS = {
  positioning:   0.20,
  signals:       0.25,
  attitude:      0.20,
  captain_comm:  0.15,
  presentation:  0.20,
}

export const SCORE_LABELS = {
  1: 'Poor',
  2: 'Below Standard',
  3: 'Adequate',
  4: 'Good',
  5: 'Excellent',
}

export const GRADE_THRESHOLDS = [
  { min: 4.5, grade: 'EXCELLENT',      color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { min: 3.5, grade: 'GOOD',           color: 'text-green-400',   bg: 'bg-green-400/10' },
  { min: 2.5, grade: 'ADEQUATE',       color: 'text-yellow-400',  bg: 'bg-yellow-400/10' },
  { min: 1.5, grade: 'BELOW STANDARD', color: 'text-orange-400',  bg: 'bg-orange-400/10' },
  { min: 0,   grade: 'POOR',           color: 'text-red-400',     bg: 'bg-red-400/10' },
]

export const CRIT_KEYS = ['positioning', 'signals', 'attitude', 'captain_comm', 'presentation']

// Match difficulty adjustment applied to the final score (1–5 scale).
// Harder match → more credit; easier match → less. Medium is neutral.
export const DIFFICULTY_ADJ = { easy: -0.3, medium: 0, hard: 0.3 }

// Off-court control (R1 duty: ball kids, rakers, line-judge uniforms, etc.).
// These points are ADDED to the final score.
export const OFFCOURT_ADJ = { attento: 0.2, superficiale: -0.2, non_attento: -0.1 }
export const OFFCOURT_LABEL = { attento: 'Attentive', superficiale: 'Superficial', non_attento: 'Not attentive' }

export function computeScore(scores, repeats, difficulty = 'medium', extraAdj = 0) {
  // Weighted average over ONLY the criteria that were actually scored.
  // A criterion marked "not evaluable" (null/undefined score) is excluded and
  // the remaining weights are re-normalised, so it does NOT count as zero.
  let weighted = 0
  let wsum = 0
  let evaluated = 0
  for (const k of CRIT_KEYS) {
    const v = scores?.[k]
    if (v == null || isNaN(v) || Number(v) <= 0) continue
    weighted += Number(v) * WEIGHTS[k]
    wsum += WEIGHTS[k]
    evaluated++
  }

  if (wsum === 0) {
    return { raw: null, penalty: 0, adjustment: 0, overall: null, grade: null, evaluated: 0 }
  }

  const raw = weighted / wsum

  // Repeated-fault penalty counts only for criteria that were scored.
  const repeatCount = CRIT_KEYS.filter((k) => {
    const v = scores?.[k]
    return v != null && !isNaN(v) && Number(v) > 0 && repeats?.[k]
  }).length
  const penalty = repeatCount * 0.5

  const adjustment = DIFFICULTY_ADJ[difficulty] ?? 0

  let overall = raw - penalty + adjustment + (Number(extraAdj) || 0)
  overall = Math.min(5.0, Math.max(1.0, overall))

  return {
    raw: Math.round(raw * 10) / 10,
    penalty: Math.round(penalty * 10) / 10,
    adjustment,
    overall: Math.round(overall * 10) / 10,
    grade: getGrade(overall),
    evaluated,
  }
}

export function getGrade(score) {
  return GRADE_THRESHOLDS.find((t) => score >= t.min) || GRADE_THRESHOLDS[4]
}

export function getGradeColor(grade) {
  return GRADE_THRESHOLDS.find((t) => t.grade === grade)?.color || 'text-gray-400'
}

export function getGradeBg(grade) {
  return GRADE_THRESHOLDS.find((t) => t.grade === grade)?.bg || 'bg-gray-400/10'
}

export const CRITERIA = [
  {
    key: 'positioning',
    label: 'Positioning & Court Coverage',
    weight: 20,
    description:
      'R1: anticipation of ball contacts, in/out reads, movement relative to ball trajectory. R2: net area position, penetration calls, LJ coordination.',
  },
  {
    key: 'signals',
    label: 'Official Signals & Three-Step Protocol',
    weight: 25,
    description:
      'Correctness of official FIVB hand signals. Application of: (1) Whistle — immediate & decisive; (2) Information gathering — brief, visible, systematic; (3) Signal decision — correct official hand signal.',
    threeStep: true,
  },
  {
    key: 'attitude',
    label: 'Attitude & Player Management',
    weight: 20,
    description:
      'Authority without authoritarianism. Game pace (12-second rule). Managing player reactions, discipline prevention & escalation.',
  },
  {
    key: 'captain_comm',
    label: 'Captain Communication',
    weight: 15,
    description:
      'Communication exclusively with captain while ball is out of play. Clear, concise explanations using correct technical terminology. Handling of protests and improper requests per rulebook.',
  },
  {
    key: 'presentation',
    label: 'Presentation & Critical Situations',
    weight: 20,
    description:
      'Pre-match appearance & protocol compliance. Composure, body language, professional demeanor during controversial/high-pressure moments.',
  },
]
