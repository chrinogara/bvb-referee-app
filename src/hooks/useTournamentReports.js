import { useState, useEffect, useCallback, useMemo } from 'react'
import { tournamentReportService } from '../lib/supabase'
import { extractTextFromFile } from '../lib/extractText'
import { analyzeReportText } from '../lib/analyzeReport'

const SECTION_KEYS = [
  'key_points',
  'common_faults',
  'technical_focus',
  'captain_communication',
  'general_notes',
]

/**
 * Manages uploaded tournament reports and the briefing suggestions derived
 * from them. Suggestions are aggregated across ALL reports so they remain
 * available for every future briefing.
 */
export function useTournamentReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await tournamentReportService.getAll()
    if (!error) setReports(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  /**
   * Upload + extract + analyse a report file. Saved permanently in Supabase.
   * @param {File} file
   * @param {{ tournamentName?: string, reportDate?: string, tournamentId?: string }} meta
   */
  const uploadAndAnalyze = useCallback(async (file, meta = {}) => {
    setUploading(true)
    let created = null
    try {
      // 1. Extract text in the browser
      const { type, text } = await extractTextFromFile(file)

      // 2. Persist the report immediately (status: analyzing)
      const tournamentName =
        meta.tournamentName?.trim() || file.name.replace(/\.[^.]+$/, '')
      const { data: row, error: insertErr } = await tournamentReportService.create({
        tournament_id: meta.tournamentId || null,
        file_name: file.name,
        file_type: type,
        tournament_name: tournamentName,
        report_date: meta.reportDate || null,
        content_text: text,
        status: 'analyzing',
      })
      if (insertErr) throw new Error(insertErr.message)
      created = row

      // 3. Analyse with Claude → English suggestions per section
      const suggestions = await analyzeReportText(text, {
        tournamentName,
        reportDate: meta.reportDate,
      })

      // 4. Save suggestions permanently
      const { data: updated } = await tournamentReportService.update(row.id, {
        suggestions,
        status: 'analyzed',
        analyzed_at: new Date().toISOString(),
      })

      await refetch()
      return updated || row
    } catch (err) {
      // Mark the row as errored if it was created
      if (created?.id) {
        try {
          await tournamentReportService.update(created.id, {
            status: 'error',
            error_message: err.message,
          })
        } catch {
          // ignore secondary failure — surface the original error below
        }
        await refetch()
      }
      throw err
    } finally {
      setUploading(false)
    }
  }, [refetch])

  /** Re-run analysis on an existing report (e.g. after an error). */
  const reanalyze = useCallback(async (report) => {
    if (!report?.content_text) throw new Error('No text stored for this report')
    await tournamentReportService.update(report.id, { status: 'analyzing' })
    await refetch()
    try {
      const suggestions = await analyzeReportText(report.content_text, {
        tournamentName: report.tournament_name,
        reportDate: report.report_date,
      })
      await tournamentReportService.update(report.id, {
        suggestions,
        status: 'analyzed',
        analyzed_at: new Date().toISOString(),
        error_message: null,
      })
    } catch (err) {
      await tournamentReportService.update(report.id, {
        status: 'error',
        error_message: err.message,
      })
      throw err
    } finally {
      await refetch()
    }
  }, [refetch])

  const deleteReport = useCallback(async (id) => {
    await tournamentReportService.delete(id)
    await refetch()
  }, [refetch])

  /**
   * Suggestions aggregated by section across all analysed reports.
   * Shape: { key_points: [{ text, source, reportId }], ... }
   */
  const suggestionsBySection = useMemo(() => {
    const out = {}
    SECTION_KEYS.forEach((k) => { out[k] = [] })

    for (const r of reports) {
      if (r.status !== 'analyzed' || !r.suggestions) continue
      const source = [r.tournament_name, r.report_date]
        .filter(Boolean)
        .join(' — ')
      for (const key of SECTION_KEYS) {
        const items = Array.isArray(r.suggestions[key]) ? r.suggestions[key] : []
        for (const text of items) {
          if (typeof text === 'string' && text.trim()) {
            out[key].push({ text: text.trim(), source, reportId: r.id })
          }
        }
      }
    }
    return out
  }, [reports])

  const totalSuggestions = useMemo(
    () =>
      Object.values(suggestionsBySection).reduce((acc, arr) => acc + arr.length, 0),
    [suggestionsBySection]
  )

  return {
    reports,
    loading,
    uploading,
    uploadAndAnalyze,
    reanalyze,
    deleteReport,
    suggestionsBySection,
    totalSuggestions,
    refetch,
  }
}

export { SECTION_KEYS }
