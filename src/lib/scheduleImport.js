// ─────────────────────────────────────────────────────────────────────────────
// Schedule paste-import — turn a copied schedule table into matches + officials.
//
// Expected paste = one COURT's table copied from a spreadsheet (tab-separated),
// columns in this order (a leading header row and blank rows are ignored):
//
//   TIME · M/W · [phase] · TEAM1 · TEAM2 · R1 · R2 · LJ1 · LJ2
//
// e.g.  9:00 ⇥ W ⇥ Q ⇥ GER ⇥ AUT ⇥ Hoernaert ⇥ Francescangeli ⇥ Poriau ⇥ Cleuren
//
// The phase column (e.g. "Q") is optional and auto-detected. Rows without both
// teams are treated as empty slots and skipped. This module is pure (no DB) so
// it can be unit-tested; the executor lives in the Import page.
// ─────────────────────────────────────────────────────────────────────────────

const TIME_RE = /^(\d{1,2}):(\d{2})$/

export const OFFICIAL_ROLES = ['R1', 'R2', 'LJ1', 'LJ2']
export const LINE_JUDGE_ROLES = ['LJ1', 'LJ2']

export function normalizeLast(s) {
  return (s || '').trim().toLowerCase()
}

// Line-judge marker inside the free-text notes (matches the Evaluate detection:
// notes containing "line judge"). Adds/removes it cleanly.
export function applyLineJudge(notes, on) {
  let base = (notes || '')
    .replace(/line judge/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  if (on) base = base ? `${base} (line judge)` : 'line judge'
  return base || null
}
export const isLineJudgeNotes = (notes) => (notes || '').toLowerCase().includes('line judge')

// Split a pasted line into trimmed cells (tab first, then 2+ spaces as fallback).
function splitCells(line) {
  const cells = line.includes('\t') ? line.split('\t') : line.split(/ {2,}/)
  return cells.map((c) => c.replace(/\u00a0/g, ' ').trim())
}

/**
 * Parse a pasted schedule table for a single court.
 * @param {string} text  the pasted table
 * @param {{court?:string, dateISO?:string, dayNumber?:number}} opts
 *        court    – e.g. "C2" (applied to every row)
 *        dateISO  – "YYYY-MM-DD"; combined with the row time into scheduled_time
 *        dayNumber – tournament day (1,2,3…)
 * @returns {{rows:Array, skipped:number}}
 */
export function parseSchedule(text, { court = '', dateISO = '', dayNumber = 1 } = {}) {
  const lines = String(text || '').split(/\r?\n/)
  const rows = []
  let skipped = 0

  for (const raw of lines) {
    if (!raw.trim()) continue
    const cells = splitCells(raw)

    const tm = TIME_RE.exec(cells[0] || '')
    if (!tm) { skipped++; continue } // header row or noise

    const g = (cells[1] || '').toUpperCase()
    const gender = g.startsWith('W') ? 'F' : g.startsWith('M') ? 'M' : ''

    // Optional phase column: a short token (<=2 chars) right after M/W.
    let idx = 2
    let phase = ''
    if (cells[2] && cells[2].length <= 2) { phase = cells[2]; idx = 3 }

    const team1 = cells[idx] || ''
    const team2 = cells[idx + 1] || ''
    if (!team1 || !team2) { skipped++; continue } // empty slot — no match

    const officials = {
      R1: cells[idx + 2] || '',
      R2: cells[idx + 3] || '',
      LJ1: cells[idx + 4] || '',
      LJ2: cells[idx + 5] || '',
    }

    const hh = String(tm[1]).padStart(2, '0')
    const time = `${hh}:${tm[2]}`
    const scheduled_time = dateISO ? `${dateISO}T${time}:00+02:00` : time

    rows.push({ time, gender, phase, team1, team2, officials, court, scheduled_time, day_number: dayNumber })
  }

  return { rows, skipped }
}

// Every distinct official surname referenced by the parsed rows.
export function collectOfficialNames(rows) {
  const set = new Set()
  for (const r of rows) {
    for (const role of OFFICIAL_ROLES) {
      const n = (r.officials[role] || '').trim()
      if (n) set.add(n)
    }
  }
  return [...set]
}

// Surnames that appear in a line-judge column at least once.
export function collectLineJudgeNames(rows) {
  const set = new Set()
  for (const r of rows) {
    for (const role of LINE_JUDGE_ROLES) {
      const n = (r.officials[role] || '').trim()
      if (n) set.add(n)
    }
  }
  return [...set]
}

/**
 * Resolve a surname to a referee record by last_name (case-insensitive; also
 * tolerates "De Rycke" vs "Derycke" by comparing with spaces removed).
 */
export function findReferee(referees, surname) {
  const want = normalizeLast(surname)
  if (!want) return null
  const wantNoSpace = want.replace(/\s+/g, '')
  return (
    referees.find((r) => normalizeLast(r.last_name) === want) ||
    referees.find((r) => normalizeLast(r.last_name).replace(/\s+/g, '') === wantNoSpace) ||
    null
  )
}
