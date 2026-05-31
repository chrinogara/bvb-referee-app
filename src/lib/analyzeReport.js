import { supabase } from './supabase'

/**
 * Analyse a tournament report's extracted text via the `analyze-tournament-report`
 * Edge Function. Claude extracts useful briefing situations and returns
 * professional ENGLISH suggestions mapped to the 5 briefing sections.
 *
 * @param {string} text - extracted report text (any language)
 * @param {object} [meta] - { tournamentName, reportDate }
 * @returns {Promise<{ key_points: string[], common_faults: string[],
 *   technical_focus: string[], captain_communication: string[],
 *   general_notes: string[] }>}
 */
export async function analyzeReportText(text, meta = {}) {
  const empty = {
    key_points: [],
    common_faults: [],
    technical_focus: [],
    captain_communication: [],
    general_notes: [],
  }

  if (!text || text.trim().length < 20) return empty

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000) // analysis can be slow

    const { data, error } = await supabase.functions.invoke('analyze-tournament-report', {
      body: {
        text,
        tournamentName: meta.tournamentName || '',
        reportDate: meta.reportDate || '',
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (error) {
      // FunctionsHttpError exposes the raw Response on `error.context`.
      // Surface the real HTTP status + body so the failure is diagnosable
      // instead of the opaque "non-2xx status code" message.
      let detail = error.message || 'Edge Function error'
      const res = error.context
      if (res && typeof res.status === 'number') {
        let bodyText = ''
        try {
          bodyText = await res.clone().text()
        } catch {
          /* body may already be consumed */
        }
        detail = `HTTP ${res.status}${bodyText ? ` — ${bodyText.slice(0, 300)}` : ''}`
      }
      console.error('Analyze function error:', detail)
      throw new Error(detail)
    }

    const suggestions = data?.suggestions
    if (!suggestions || typeof suggestions !== 'object') return empty

    // Guarantee all 5 keys exist as arrays.
    return { ...empty, ...suggestions }
  } catch (err) {
    console.error('Report analysis failed:', err.message)
    throw err
  }
}
