// Legenda delle sigle dei punteggi usate nei PDF di valutazione.
// I default sono modificabili manualmente dall'utente (salvati sul dispositivo)
// e valgono per TUTTI i tornei.

export const LEGEND_ORDER = ['OVERALL', 'POS', 'SIG', 'ATT', 'CAP', 'PRE']

export const LEGEND_DEFAULTS = {
  OVERALL: 'Overall score — weighted average of the five criteria',
  POS: 'Positioning & Court Coverage',
  SIG: 'Official Signals & Three-Step Protocol',
  ATT: 'Attitude & Player Management',
  CAP: 'Captain Communication',
  PRE: 'Presentation & Critical Situations',
}

const LS_KEY = 'bvbCriteriaLegend'

// Returns the effective legend: user override if set, otherwise the default.
export function readLegend() {
  let ov = {}
  try { ov = JSON.parse((typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY)) || '{}') } catch { ov = {} }
  const out = {}
  for (const k of LEGEND_ORDER) {
    const v = ov && typeof ov[k] === 'string' ? ov[k].trim() : ''
    out[k] = v || LEGEND_DEFAULTS[k]
  }
  return out
}

// Returns only the raw overrides (empty string where not overridden) — for the editor.
export function readLegendOverrides() {
  let ov = {}
  try { ov = JSON.parse((typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY)) || '{}') } catch { ov = {} }
  const out = {}
  for (const k of LEGEND_ORDER) out[k] = ov && typeof ov[k] === 'string' ? ov[k] : ''
  return out
}

export function saveLegend(obj) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj || {})) } catch { /* ignore */ }
}

export function resetLegend() {
  try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
}
