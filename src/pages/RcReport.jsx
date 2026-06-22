import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  Download,
  Trash2,
  Cloud,
  Users as UsersIcon,
  Star,
  Award,
  AlertTriangle,
  Building2,
  Lightbulb,
  StickyNote,
  CheckCircle,
  X,
  Languages,
} from 'lucide-react'

import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardBody, CardTitle } from '../components/ui/Card'
import { Select, Textarea } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { toast } from '../components/ui/Toast'

import { useTournaments, useTournamentReferees } from '../hooks/useTournaments'
import { useEvaluations } from '../hooks/useEvaluations'
import { rcReportService } from '../lib/supabase'
import { translateToEnglish } from '../lib/anthropic'
import { generateRcReportPDF, downloadPDF } from '../lib/pdf'
import { CRITERIA } from '../lib/scoring'
import { cn, formatDate, formatDateTime, refereeName, refereeInitials, scoreColor } from '../lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RATING_OPTIONS = [
  { value: 'VERY_GOOD', label: 'Very Good', color: 'text-emerald-600 bg-emerald-50 border-emerald-300' },
  { value: 'GOOD',      label: 'Good',      color: 'text-blue-600 bg-blue-50 border-blue-300' },
  { value: 'BAD',       label: 'Bad',       color: 'text-red-600 bg-red-50 border-red-300' },
]

function tournamentLevelLabel(t) {
  if (!t) return '—'
  if (t.is_finals) return 'Finals / Masters'
  if (t.star_rating === 3) return '3-Star'
  if (t.star_rating === 2) return '2-Star'
  if (t.star_rating === 1) return '1-Star'
  return '—'
}

function CRITERION_SCORE_KEY(c) {
  const map = {
    positioning: 'score_positioning',
    signals: 'score_signals',
    attitude: 'score_attitude',
    captain_comm: 'score_captain_comm',
    presentation: 'score_presentation',
  }
  return map[c.key]
}

function CRITERION_REPEAT_KEY(c) {
  const map = {
    positioning: 'repeat_positioning',
    signals: 'repeat_signals',
    attitude: 'repeat_attitude',
    captain_comm: 'repeat_captain_comm',
    presentation: 'repeat_presentation',
  }
  return map[c.key]
}

// Build evaluation summary for a single referee within this tournament
function buildRefereeSummary(refId, tournamentEvals) {
  const myEvals = tournamentEvals.filter((e) => e.referee_id === refId)
  if (myEvals.length === 0) return null

  const scores = myEvals.map((e) => e.overall_score).filter((s) => s != null)
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const best = scores.length > 0 ? Math.max(...scores) : null
  const worst = scores.length > 0 ? Math.min(...scores) : null

  // Repeat faults total
  const repeatCount = myEvals.reduce(
    (acc, e) =>
      acc +
      [
        e.repeat_positioning,
        e.repeat_signals,
        e.repeat_attitude,
        e.repeat_captain_comm,
        e.repeat_presentation,
      ].filter(Boolean).length,
    0
  )

  // Best / worst criterion (by average)
  const critAverages = CRITERIA.map((c) => {
    const key = CRITERION_SCORE_KEY(c)
    const vals = myEvals.map((e) => e[key]).filter((v) => v != null)
    return {
      key: c.key,
      label: c.label,
      avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
    }
  }).filter((c) => c.avg != null)
  const bestCriterion = critAverages.length
    ? critAverages.reduce((a, b) => (a.avg >= b.avg ? a : b))
    : null
  const worstCriterion = critAverages.length
    ? critAverages.reduce((a, b) => (a.avg <= b.avg ? a : b))
    : null

  return {
    count: myEvals.length,
    avg,
    best,
    worst,
    repeatCount,
    bestCriterion,
    worstCriterion,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Read-only stat cell: shows a value computed automatically from the tournament
// data (referees assigned + their evaluations). Not editable on purpose.
function AutoStat({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center gap-1">
        {label}
        <span className="text-[9px] font-semibold text-[#2D3270] bg-[#2D3270]/10 px-1 py-px rounded">
          AUTO
        </span>
      </span>
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-lg font-bold text-[#2D3270]">
        {value}
      </div>
    </div>
  )
}

function RatingButtonGroup({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {RATING_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value === value ? '' : opt.value)}
          className={cn(
            'py-2 px-3 rounded-xl text-sm font-semibold border transition-all',
            value === opt.value
              ? `${opt.color} ring-2 ring-offset-1 ring-current/30`
              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// Drop-in replacement for <Textarea> that auto-translates whatever the user
// writes (any language) into English — on blur (silent) and via a manual
// "Translate" button. Keeps the same event-based onChange interface so it can
// replace <Textarea> directly. This keeps the final PDF always in English,
// matching the behaviour used across the rest of the app (see Evaluate page).
function TranslatingTextarea({ label, value, onChange, placeholder, rows = 3, error }) {
  const [busy, setBusy] = useState(false)
  const focusValueRef = useRef('')

  // Emit a value change using the same { target: { value } } shape as a textarea event.
  function emit(next) {
    onChange({ target: { value: next } })
  }

  async function runTranslate(text, { silent = false } = {}) {
    const t = (text ?? value ?? '').trim()
    if (!t || busy) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (!silent) toast.error('Translation needs an internet connection')
      return
    }
    setBusy(true)
    try {
      const en = await translateToEnglish(t)
      if (en && en.trim() && en.trim() !== t) emit(en.trim())
    } catch (err) {
      console.error('translate error', err)
      if (!silent) toast.error('Translation failed — please try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        {label && (
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
            {label}
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          {busy && <span className="text-[10px] text-gray-400 animate-pulse">Translating…</span>}
          <button
            type="button"
            onClick={() => runTranslate(value)}
            disabled={busy || !value?.trim()}
            title="Translate to English"
            className="text-[10px] font-bold uppercase tracking-wide text-[#E85D26] flex items-center gap-1 disabled:opacity-40"
          >
            <Languages size={13} /> Translate
          </button>
        </div>
      </div>
      <Textarea
        value={value || ''}
        onChange={onChange}
        onFocus={(e) => { focusValueRef.current = e.target.value }}
        onBlur={(e) => {
          const v = e.target.value
          // Auto-translate only if the user actually typed something new.
          if (v.trim() && v !== focusValueRef.current) runTranslate(v, { silent: true })
        }}
        placeholder={placeholder}
        rows={rows}
        error={error}
      />
    </div>
  )
}

function OrganizationalField({ label, value, note, onChangeValue, onChangeNote }) {
  const needsNote = value === 'BAD'
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
        {label}
      </label>
      <RatingButtonGroup value={value || ''} onChange={onChangeValue} />
      {needsNote && (
        <div className="pl-3 border-l-2 border-red-400 bg-red-50/40 py-2 pr-2 rounded-r-lg">
          <label className="flex items-center gap-1 text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1">
            <AlertTriangle size={10} /> Explanation required (rating: Bad)
          </label>
          <TranslatingTextarea
            value={note || ''}
            onChange={(e) => onChangeNote(e.target.value)}
            placeholder="Why was it bad? Be specific so the issue can be addressed…"
            rows={2}
          />
        </div>
      )}
    </div>
  )
}

function RefereeMultiSelect({ label, value = [], options, onChange, tournamentEvals }) {
  const [picking, setPicking] = useState(false)

  function toggle(refId) {
    const set = new Set(value)
    if (set.has(refId)) set.delete(refId)
    else set.add(refId)
    onChange([...set])
  }

  const selectedRefs = options.filter((r) => value.includes(r.id))
  const available = options.filter((r) => !value.includes(r.id))

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</label>

      {/* Selected with eval summaries */}
      {selectedRefs.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No referees selected.</p>
      ) : (
        <div className="space-y-2">
          {selectedRefs.map((r) => {
            const summary = buildRefereeSummary(r.id, tournamentEvals)
            return (
              <div
                key={r.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50"
              >
                <div className="w-9 h-9 rounded-full bg-[#2D3270]/10 flex items-center justify-center text-[#2D3270] font-bold text-xs shrink-0">
                  {refereeInitials(r)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{refereeName(r)}</span>
                    <Badge
                      variant={r.ranking_level === 'A' ? 'green' : r.ranking_level === 'B' ? 'blue' : 'yellow'}
                      size="xs"
                    >
                      Lv.{r.ranking_level}
                    </Badge>
                  </div>
                  {summary ? (
                    <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <div className="text-gray-500 text-[9px] uppercase tracking-wide">Evals</div>
                        <div className="font-bold text-gray-900">{summary.count}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[9px] uppercase tracking-wide">Avg</div>
                        <div className={cn('font-bold', scoreColor(summary.avg))}>
                          {summary.avg?.toFixed(2) ?? '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[9px] uppercase tracking-wide">Best</div>
                        <div className={cn('font-bold', scoreColor(summary.best))}>
                          {summary.best?.toFixed(1) ?? '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[9px] uppercase tracking-wide">Repeat faults</div>
                        <div
                          className={cn(
                            'font-bold',
                            summary.repeatCount > 0 ? 'text-amber-600' : 'text-gray-600'
                          )}
                        >
                          {summary.repeatCount}
                        </div>
                      </div>
                      {summary.bestCriterion && (
                        <div className="col-span-2 sm:col-span-2">
                          <div className="text-gray-500 text-[9px] uppercase tracking-wide">Strongest</div>
                          <div className="text-emerald-700 font-medium leading-tight truncate">
                            {summary.bestCriterion.label} ({summary.bestCriterion.avg.toFixed(1)})
                          </div>
                        </div>
                      )}
                      {summary.worstCriterion && (
                        <div className="col-span-2 sm:col-span-2">
                          <div className="text-gray-500 text-[9px] uppercase tracking-wide">Weakest</div>
                          <div className="text-red-700 font-medium leading-tight truncate">
                            {summary.worstCriterion.label} ({summary.worstCriterion.avg.toFixed(1)})
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-500 mt-1 italic">
                      No evaluations recorded for this tournament yet.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                  aria-label="Remove"
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Picker */}
      {!picking ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="text-xs text-[#E85D26] hover:underline font-semibold"
        >
          + Add referee
        </button>
      ) : (
        <div className="border border-gray-200 rounded-xl p-2 bg-white max-h-56 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Tap to add</span>
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              Done
            </button>
          </div>
          {available.length === 0 ? (
            <p className="text-xs text-gray-500 italic text-center py-2">
              All referees already added.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {available.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    toggle(r.id)
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600">
                    {refereeInitials(r)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 truncate block">
                      {refereeName(r)}
                    </span>
                    <span className="text-[10px] text-gray-500">Level {r.ranking_level}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Empty report template ───────────────────────────────────────────────────

const EMPTY_REPORT = {
  weather_conditions: '',
  total_referees: '',
  referees_a_level: '',
  referees_b_level: '',
  referees_c_level: '',
  observed_count: '',
  overall_performance: '',
  strengths: '',
  areas_for_improvement: '',
  top_performer_ids: [],
  followup_referee_ids: [],
  court_conditions: '',
  court_conditions_note: '',
  equipment_quality: '',
  equipment_quality_note: '',
  scheduling: '',
  scheduling_note: '',
  hospitality: '',
  hospitality_note: '',
  incidents: '',
  protests: '',
  recs_referees: '',
  recs_organizers: '',
  recs_rc_commission: '',
  final_remarks: '',
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function RcReport() {
  const [searchParams] = useSearchParams()
  const { tournaments } = useTournaments()

  const [tournamentId, setTournamentId] = useState(searchParams.get('tournamentId') || '')
  const tournament = tournaments.find((t) => t.id === tournamentId)
  const { referees: tournamentReferees } = useTournamentReferees(tournamentId)
  const { evaluations: tournamentEvals } = useEvaluations({ tournamentId })

  const [report, setReport] = useState(EMPTY_REPORT)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)

  // Auto-select closest tournament
  useEffect(() => {
    if (!tournamentId && tournaments.length > 0) {
      const now = new Date()
      const closest = [...tournaments].sort(
        (a, b) =>
          Math.abs(new Date(a.start_date) - now) - Math.abs(new Date(b.start_date) - now)
      )[0]
      if (closest) setTournamentId(closest.id)
    }
  }, [tournaments, tournamentId])

  // Load report
  const loadReport = useCallback(async () => {
    if (!tournamentId) return
    setLoading(true)
    const { data } = await rcReportService.getByTournament(tournamentId)
    if (data) {
      setReport({
        ...EMPTY_REPORT,
        ...data,
        top_performer_ids: data.top_performer_ids || [],
        followup_referee_ids: data.followup_referee_ids || [],
      })
      setLastSavedAt(data.updated_at)
    } else {
      setReport(EMPTY_REPORT)
      setLastSavedAt(null)
    }
    setDirty(false)
    setLoading(false)
  }, [tournamentId])

  useEffect(() => { loadReport() }, [loadReport])

  function setField(key, value) {
    setReport((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  // Team stats computed automatically from the tournament's referees and their
  // evaluations — quantity, level breakdown (A/B/C) and how many were evaluated.
  const teamStats = useMemo(() => {
    const level = (r) => String(r?.ranking_level || '').trim().toUpperCase()
    const evaluatedIds = new Set(
      tournamentEvals.map((e) => e.referee_id).filter(Boolean)
    )
    return {
      total: tournamentReferees.length,
      levelA: tournamentReferees.filter((r) => level(r) === 'A').length,
      levelB: tournamentReferees.filter((r) => level(r) === 'B').length,
      levelC: tournamentReferees.filter((r) => level(r) === 'C').length,
      evaluated: evaluatedIds.size,
    }
  }, [tournamentReferees, tournamentEvals])

  // Validate: BAD rating must have a note
  const validationErrors = useMemo(() => {
    const errs = []
    const fields = [
      { key: 'court_conditions',  noteKey: 'court_conditions_note',  label: 'Court Conditions' },
      { key: 'equipment_quality', noteKey: 'equipment_quality_note', label: 'Equipment Quality' },
      { key: 'scheduling',        noteKey: 'scheduling_note',        label: 'Scheduling' },
      { key: 'hospitality',       noteKey: 'hospitality_note',       label: 'Hospitality' },
    ]
    for (const f of fields) {
      if (report[f.key] === 'BAD' && !report[f.noteKey]?.trim()) {
        errs.push(`${f.label}: explanation required when rating is "Bad"`)
      }
    }
    return errs
  }, [report])

  async function handleSave() {
    if (!tournamentId) {
      toast.error('Select a tournament first')
      return
    }
    if (validationErrors.length > 0) {
      toast.error(validationErrors[0])
      return
    }
    setSaving(true)
    try {
      const payload = {
        tournament_id: tournamentId,
        ...report,
        // Tournament level is computed from tournament, store the label
        tournament_level: tournamentLevelLabel(tournament),
        // Refereeing team stats are computed automatically from the tournament data
        total_referees: teamStats.total,
        referees_a_level: teamStats.levelA,
        referees_b_level: teamStats.levelB,
        referees_c_level: teamStats.levelC,
        observed_count: teamStats.evaluated,
      }
      for (const k of ['total_referees', 'referees_a_level', 'referees_b_level', 'referees_c_level', 'observed_count']) {
        payload[k] = payload[k] === '' || payload[k] == null ? null : Number(payload[k])
      }
      delete payload.id
      delete payload.created_at
      delete payload.updated_at

      const { data, error } = await rcReportService.upsert(payload)
      if (error) throw new Error(error.message)
      setLastSavedAt(data.updated_at)
      setDirty(false)
      toast.success('RC Report saved')
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDownload() {
    if (!tournamentId || !tournament) {
      toast.error('Select a tournament first')
      return
    }
    if (dirty) {
      toast.error('Save first, then download')
      return
    }
    setDownloading(true)
    try {
      // Enrich the report data with referee details for PDF
      const enriched = {
        ...report,
        tournament_level: tournamentLevelLabel(tournament),
        // Refereeing team stats are computed automatically from the tournament data
        total_referees: teamStats.total,
        referees_a_level: teamStats.levelA,
        referees_b_level: teamStats.levelB,
        referees_c_level: teamStats.levelC,
        observed_count: teamStats.evaluated,
        top_performers_details: report.top_performer_ids
          .map((id) => {
            const r = tournamentReferees.find((x) => x.id === id)
            const s = buildRefereeSummary(id, tournamentEvals)
            return r ? { referee: r, summary: s } : null
          })
          .filter(Boolean),
        followup_referees_details: report.followup_referee_ids
          .map((id) => {
            const r = tournamentReferees.find((x) => x.id === id)
            const s = buildRefereeSummary(id, tournamentEvals)
            return r ? { referee: r, summary: s } : null
          })
          .filter(Boolean),
      }
      const blob = await generateRcReportPDF(enriched, tournament)
      const filename = `BVB_RC_Report_${tournament.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      downloadPDF(blob, filename)
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error(`PDF failed: ${err.message}`)
    } finally {
      setDownloading(false)
    }
  }

  async function handleClear() {
    if (!confirm('Delete the entire RC report for this tournament? This cannot be undone.')) return
    await rcReportService.delete(tournamentId)
    setReport(EMPTY_REPORT)
    setLastSavedAt(null)
    setDirty(false)
    toast('Report cleared', 'info')
  }

  const filledCount = Object.values(report).filter((v) => {
    if (Array.isArray(v)) return v.length > 0
    return v !== '' && v != null
  }).length
  const totalFields = Object.keys(EMPTY_REPORT).length

  return (
    <div className="flex flex-col h-full">
      <Header
        title="RC Post-Tournament Report"
        subtitle={
          tournament
            ? `${tournament.name} — ${formatDate(tournament.start_date)}`
            : 'Compile the RC report for the selected tournament'
        }
        actions={
          <Link
            to="/reports"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-gray-100 text-xs text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={12} /> Back
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full pb-24">
        {/* Tournament selector + progress */}
        <Card>
          <CardBody className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <Select
              label="Tournament"
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
            >
              <option value="">— Select —</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({formatDate(t.start_date)})
                </option>
              ))}
            </Select>
            <div className="flex gap-2 items-center">
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Progress</p>
                <p className="text-sm font-bold text-gray-900">
                  {filledCount} / {totalFields} fields
                </p>
              </div>
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#E85D26] transition-all"
                  style={{ width: `${(filledCount / totalFields) * 100}%` }}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {tournament && (
          <>
            {/* 1. Tournament Context (level is AUTO) */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Cloud size={16} className="text-[#2D3270]" />
                  <CardTitle>Tournament Context</CardTitle>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Tournament</div>
                    <div className="text-sm font-bold text-gray-900">{tournament.name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Level (auto)</div>
                    <div className="text-sm font-bold text-[#2D3270] flex items-center gap-1">
                      {tournamentLevelLabel(tournament)}
                      {tournament.star_rating && (
                        <span className="flex">
                          {Array.from({ length: tournament.star_rating }).map((_, i) => (
                            <Star key={i} size={10} className="fill-amber-400 text-amber-400" />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Dates</div>
                    <div className="text-sm font-bold text-gray-900">
                      {formatDate(tournament.start_date)} → {formatDate(tournament.end_date)}
                    </div>
                  </div>
                </div>
                <TranslatingTextarea
                  label="Weather Conditions"
                  value={report.weather_conditions}
                  onChange={(e) => setField('weather_conditions', e.target.value)}
                  placeholder="e.g. sunny days 1-2, heavy rain day 3, strong wind in afternoons…"
                  rows={3}
                />
              </CardBody>
            </Card>

            {/* 2. Refereeing Team */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UsersIcon size={16} className="text-blue-600" />
                  <CardTitle>Refereeing Team</CardTitle>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <p className="text-[11px] text-gray-500">
                  Computed automatically from the referees assigned to this tournament and their evaluations.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <AutoStat label="Total Refs" value={teamStats.total} />
                  <AutoStat label="Level A" value={teamStats.levelA} />
                  <AutoStat label="Level B" value={teamStats.levelB} />
                  <AutoStat label="Level C" value={teamStats.levelC} />
                  <AutoStat label="Evaluated" value={teamStats.evaluated} />
                </div>
              </CardBody>
            </Card>

            {/* 3. Overall Performance */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Award size={16} className="text-emerald-600" />
                  <CardTitle>Overall Performance</CardTitle>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2 block">
                    Global Rating
                  </label>
                  <RatingButtonGroup
                    value={report.overall_performance}
                    onChange={(v) => setField('overall_performance', v)}
                  />
                </div>
                <TranslatingTextarea
                  label="Strengths Observed"
                  value={report.strengths}
                  onChange={(e) => setField('strengths', e.target.value)}
                  rows={4}
                />
                <TranslatingTextarea
                  label="Areas for Improvement"
                  value={report.areas_for_improvement}
                  onChange={(e) => setField('areas_for_improvement', e.target.value)}
                  rows={4}
                />
              </CardBody>
            </Card>

            {/* 4. Individual Highlights (multi-select referees + auto eval summary) */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-amber-600" />
                  <CardTitle>Individual Highlights</CardTitle>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <RefereeMultiSelect
                  label="Top Performers"
                  value={report.top_performer_ids}
                  options={tournamentReferees}
                  onChange={(v) => setField('top_performer_ids', v)}
                  tournamentEvals={tournamentEvals}
                />
                <RefereeMultiSelect
                  label="Referees Needing Follow-up"
                  value={report.followup_referee_ids}
                  options={tournamentReferees}
                  onChange={(v) => setField('followup_referee_ids', v)}
                  tournamentEvals={tournamentEvals}
                />
              </CardBody>
            </Card>

            {/* 5. Organizational Aspects (dropdowns + mandatory note if BAD) */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-cyan-600" />
                  <CardTitle>Organizational Aspects</CardTitle>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <OrganizationalField
                  label="Court Conditions"
                  value={report.court_conditions}
                  note={report.court_conditions_note}
                  onChangeValue={(v) => setField('court_conditions', v)}
                  onChangeNote={(v) => setField('court_conditions_note', v)}
                />
                <OrganizationalField
                  label="Equipment Quality"
                  value={report.equipment_quality}
                  note={report.equipment_quality_note}
                  onChangeValue={(v) => setField('equipment_quality', v)}
                  onChangeNote={(v) => setField('equipment_quality_note', v)}
                />
                <OrganizationalField
                  label="Scheduling"
                  value={report.scheduling}
                  note={report.scheduling_note}
                  onChangeValue={(v) => setField('scheduling', v)}
                  onChangeNote={(v) => setField('scheduling_note', v)}
                />
                <OrganizationalField
                  label="Hospitality"
                  value={report.hospitality}
                  note={report.hospitality_note}
                  onChangeValue={(v) => setField('hospitality', v)}
                  onChangeNote={(v) => setField('hospitality_note', v)}
                />
              </CardBody>
            </Card>

            {/* 6. Incidents & Protests */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-600" />
                  <CardTitle>Incidents &amp; Protests</CardTitle>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <TranslatingTextarea
                  label="Notable Incidents"
                  value={report.incidents}
                  onChange={(e) => setField('incidents', e.target.value)}
                  rows={3}
                />
                <TranslatingTextarea
                  label="Protests Lodged"
                  value={report.protests}
                  onChange={(e) => setField('protests', e.target.value)}
                  rows={3}
                />
              </CardBody>
            </Card>

            {/* 7. Recommendations */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lightbulb size={16} className="text-orange-600" />
                  <CardTitle>Recommendations</CardTitle>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <TranslatingTextarea
                  label="For the Referees"
                  value={report.recs_referees}
                  onChange={(e) => setField('recs_referees', e.target.value)}
                  rows={3}
                />
                <TranslatingTextarea
                  label="For the Organizers"
                  value={report.recs_organizers}
                  onChange={(e) => setField('recs_organizers', e.target.value)}
                  rows={3}
                />
                <TranslatingTextarea
                  label="For the RC Commission"
                  value={report.recs_rc_commission}
                  onChange={(e) => setField('recs_rc_commission', e.target.value)}
                  rows={3}
                />
              </CardBody>
            </Card>

            {/* 8. Final Remarks */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <StickyNote size={16} className="text-gray-600" />
                  <CardTitle>Final Remarks</CardTitle>
                </div>
              </CardHeader>
              <CardBody>
                <TranslatingTextarea
                  label="Closing Notes"
                  value={report.final_remarks}
                  onChange={(e) => setField('final_remarks', e.target.value)}
                  rows={4}
                />
              </CardBody>
            </Card>

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <Card className="border-red-300 bg-red-50">
                <CardBody className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <p className="font-semibold text-red-700 mb-1">
                      Validation errors — fix before saving:
                    </p>
                    <ul className="space-y-0.5 text-xs text-red-700">
                      {validationErrors.map((e, i) => (
                        <li key={i}>• {e}</li>
                      ))}
                    </ul>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Action bar */}
            <Card>
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  {loading
                    ? 'Loading…'
                    : lastSavedAt
                    ? `Last saved: ${formatDateTime(lastSavedAt)}`
                    : 'Not yet saved'}
                  {dirty && <Badge variant="amber" size="xs" className="ml-2">Unsaved</Badge>}
                </div>
                <div className="flex gap-2">
                  {lastSavedAt && (
                    <Button variant="ghost" size="sm" onClick={handleClear}>
                      <Trash2 size={13} /> Clear
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleDownload}
                    loading={downloading}
                    disabled={dirty || !lastSavedAt}
                    title={dirty ? 'Save first, then download' : 'Download PDF'}
                  >
                    <Download size={14} /> Download PDF
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSave}
                    loading={saving}
                    disabled={!dirty || validationErrors.length > 0}
                  >
                    <Save size={14} /> Save
                  </Button>
                </div>
              </CardBody>
            </Card>
          </>
        )}

        {!tournament && (
          <Card>
            <CardBody className="text-center py-10 text-sm text-gray-500">
              Select a tournament to begin compiling the RC report.
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
