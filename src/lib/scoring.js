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

export function computeScore(scores, repeats) {
  const { positioning, signals, attitude, captain_comm, presentation } = scores

  const raw =
    (positioning  || 0) * WEIGHTS.positioning  +
    (signals      || 0) * WEIGHTS.signals      +
    (attitude     || 0) * WEIGHTS.attitude     +
    (captain_comm || 0) * WEIGHTS.captain_comm +
    (presentation || 0) * WEIGHTS.presentation

  const repeatCount = [
    repeats?.positioning,
    repeats?.signals,
    repeats?.attitude,
    repeats?.captain_comm,
    repeats?.presentation,
  ].filter(Boolean).length

  const penalty = repeatCount * 0.5
  const overall = Math.max(1.0, raw - penalty)

  return {
    raw: Math.round(raw * 10) / 10,
    penalty: Math.round(penalty * 10) / 10,
    overall: Math.round(overall * 10) / 10,
    grade: getGrade(overall),
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
