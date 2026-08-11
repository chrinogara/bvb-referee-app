import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Trophy,
  Download,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Users,
  ClipboardList,
  Star,
  ChevronUp,
  ChevronDown,
  Pencil,
  Award,
  FileText,
  ExternalLink,
  CalendarDays,
  MessageCircle,
  Minus,
  Stethoscope,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react'

import { Header } from '../components/layout/Header'
import { Card, CardHeader, CardBody, CardTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ScoreCircle, ScoreBars } from '../components/ui/ScoreCircle'
import { toast } from '../components/ui/Toast'

import { useTournaments } from '../hooks/useTournaments'
import { useRanking } from '../hooks/useRanking'
import { evaluationService, rcReportService, mtoService, summaryNoteService, dayReportService } from '../lib/supabase'
import { trackSave } from '../lib/saveTracker'
import { CRITERIA, getGrade } from '../lib/scoring'
import { cn, formatDate, refereeName, levelColor, scoreColor } from '../lib/utils'
import {
  generateEvaluationsSummaryPDF,
  generateRcReportPDF,
  generateRefereeDayDigestPDF,
  generateRefereeMultiDayDigestPDF,
  generateRefereeTournamentDigestPDF,
  generateCoachDayReportPDF,
  generateBV15PDF,
  downloadPDF,
} from '../lib/pdf'
import { refereeDayDigest, refereeEvolution, refereeTournamentAdvice } from '../lib/report'
import { translateToEnglish, lookupRuleReference } from '../lib/anthropic'
import { LEGEND_ORDER, LEGEND_DEFAULTS, readLegendOverrides, saveLegend, resetLegend } from '../lib/criteriaLegend'
import { shareDayDigestToReferee, shareTournamentDigestToReferee } from '../lib/whatsapp'

// ─── Per-referee digest panels (evening day + end of tournament) ──────────────
function refMapFromEvals(evals) {
  // group evals by referee, keeping the joined referee object (incl. phone)
  const map = {}
  for (const e of evals) {
    const id = e.referee_id
    if (!map[id]) map[id] = { referee: e.referees || { id }, evals: [] }
    map[id].evals.push(e)
  }
  return map
}

// ─── Coach holistic comments (day + end-of-tournament) ───────────────────────
function useSummaryNotes(tournamentId) {
  const [notes, setNotes] = useState({})
  const reload = useCallback(async () => {
    if (!tournamentId) { setNotes({}); return }
    const { data } = await summaryNoteService.getForTournament(tournamentId)
    const m = {}; (data || []).forEach((n) => { m[`${n.referee_id}:${n.day_number}`] = n.comment || '' })
    setNotes(m)
  }, [tournamentId])
  useEffect(() => { reload() }, [reload])
  const save = useCallback(async (refId, dayNum, text) => {
    await trackSave(() => summaryNoteService.upsert({ referee_id: refId, tournament_id: tournamentId, day_number: dayNum, comment: text || null }))
    setNotes((prev) => ({ ...prev, [`${refId}:${dayNum}`]: text }))
  }, [tournamentId])
  return { notes, save }
}

function CoachCommentBox({ value, label, onSave, savedMessage = 'Coach comment saved', placeholder = "Coach's overall comment…" }) {
  const [text, setText] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { setText(value || ''); setDirty(false) }, [value])
  async function commit() {
    if (!dirty) return
    let finalText = text.trim()
    // Traduzione automatica IT->EN (come nelle valutazioni), silenziosa se offline/errore
    if (finalText && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      setTranslating(true)
      try {
        const en = await translateToEnglish(finalText)
        if (en && en.trim() && en.trim() !== finalText) { finalText = en.trim(); setText(finalText) }
      } catch (e) { /* mantieni originale */ }
      finally { setTranslating(false) }
    }
    setSaving(true)
    try { await onSave(finalText); setDirty(false); toast.success(savedMessage) }
    catch (e) { toast.error('Save failed: ' + (e?.message || '')) }
    finally { setSaving(false) }
  }
  return (
    <div className="mt-2">
      <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
        <Pencil size={11} /> {label}
      </div>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setDirty(true) }}
        onBlur={commit}
        rows={2}
        placeholder={placeholder}
        className="w-full text-sm rounded-lg border border-gray-300 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
      />
      {translating && <div className="text-[11px] text-gray-400 mt-0.5">Translating…</div>}
      {saving && !translating && <div className="text-[11px] text-gray-400 mt-0.5">Saving…</div>}
    </div>
  )
}

function DigestPanel({ tournament, evals }) {
  const days = useMemo(() => {
    const s = new Set(evals.map((e) => e.day_number || 1))
    return [...s].sort((a, b) => a - b)
  }, [evals])
  const [day, setDay] = useState(null)
  useEffect(() => { if (days.length && !days.includes(day)) setDay(days[0]) }, [days]) // eslint-disable-line

  const dayEvals = useMemo(() => evals.filter((e) => (e.day_number || 1) === day), [evals, day])
  const byRef = useMemo(() => refMapFromEvals(dayEvals), [dayEvals])
  const [busy, setBusy] = useState(null)
  const [openRef, setOpenRef] = useState(null)
  const { notes, save: saveNote } = useSummaryNotes(tournament?.id)

  // Day-level final note (one per day), stored on this device, added at the
  // bottom of every Day digest PDF for that day.
  const dayNoteKey = (d) => `rcDayFinalNote:${tournament?.id}:${d}`
  const readDayFinalNote = (d) => {
    try { return localStorage.getItem(dayNoteKey(d)) || '' } catch { return '' }
  }
  const [finalNote, setFinalNote] = useState('')
  useEffect(() => {
    setFinalNote(tournament?.id && day != null ? readDayFinalNote(day) : '')
  }, [tournament?.id, day]) // eslint-disable-line

  async function downloadFor(refId) {
    const { referee, evals: re } = byRef[refId]
    setBusy(refId)
    try {
      const digest = refereeDayDigest(re)
      const blob = await generateRefereeDayDigestPDF({ referee, tournament, dayNumber: day, digest, coachComment: notes[`${refId}:${day}`], finalNote: readDayFinalNote(day) })
      downloadPDF(blob, `BVB_Day${day}_${refereeName(referee).replace(/\s+/g, '_')}.pdf`)
    } catch (e) { toast.error('PDF failed: ' + e.message) } finally { setBusy(null) }
  }
  async function whatsappFor(refId) {
    const { referee, evals: re } = byRef[refId]
    const sent = await shareDayDigestToReferee({ referee, tournament, dayNumber: day, digest: refereeDayDigest(re), coachComment: notes[`${refId}:${day}`] })
    if (!sent) toast.error(`No WhatsApp number saved for ${refereeName(referee)} — add it on the Referees page.`, 7000)
  }

  async function downloadCombined(refId) {
    const referee = byRef[refId]?.referee
    if (!referee) return
    const re = evals.filter((e) => e.referee_id === refId)
    const dayNums = [...new Set(re.map((e) => e.day_number || 1))].sort((a, b) => a - b)
    const dayDigests = dayNums.map((d) => ({
      dayNumber: d,
      digest: refereeDayDigest(re.filter((e) => (e.day_number || 1) === d)),
      coachComment: notes[`${refId}:${d}`],
      finalNote: readDayFinalNote(d),
    }))
    setBusy(refId + ':all')
    try {
      const blob = await generateRefereeMultiDayDigestPDF({ referee, tournament, dayDigests })
      downloadPDF(blob, `BVB_Full_${refereeName(referee).replace(/\s+/g, '_')}.pdf`)
    } catch (e) { toast.error('PDF failed: ' + e.message) } finally { setBusy(null) }
  }

  const ids = Object.keys(byRef)
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2"><CalendarDays size={14} /> Evening digest per referee</CardTitle>
        <div className="flex gap-1">
          {days.map((d) => (
            <button key={d} onClick={() => setDay(d)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-bold', day === d ? 'bg-[#E85D26] text-white' : 'bg-gray-50 text-gray-600 border border-gray-200')}>
              Day {d}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardBody className="space-y-2">
        {ids.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">No evaluations for this day yet.</p>
        ) : ids.map((id) => {
          const { referee, evals: re } = byRef[id]
          const dig = refereeDayDigest(re)
          const isOpen = openRef === id
          return (
            <div key={id} className="bg-gray-50 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-3">
                <button className="min-w-0 flex items-center gap-2 text-left" onClick={() => setOpenRef(isOpen ? null : id)}>
                  <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 truncate">{refereeName(referee)}</span>
                    <span className="block text-xs text-gray-500">{dig.count} match{dig.count === 1 ? '' : 'es'} · day avg <b style={{ color: '#E85D26' }}>{dig.averages.overall?.toFixed(1) ?? '—'}</b></span>
                  </span>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="xs" onClick={() => downloadFor(id)} disabled={busy === id}>
                    <FileText size={12} /> {busy === id ? '…' : 'PDF'}
                  </Button>
                  <Button variant="outline" size="xs" onClick={() => downloadCombined(id)} disabled={busy === id + ':all'}>
                    <FileText size={12} /> {busy === id + ':all' ? '…' : 'D1+D2'}
                  </Button>
                  <Button variant="outline" size="xs" onClick={() => whatsappFor(id)}>
                    <MessageCircle size={12} /> WhatsApp
                  </Button>
                </div>
              </div>
              {isOpen && (
                <div className="px-3 pb-3 space-y-1.5">
                  {dig.matches.map((m, mi) => (
                    <div key={m.id || mi} className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-800 truncate">{m.label}</div>
                        <div className="text-[11px] text-gray-500">{m.role} · overall <b style={{ color: '#E85D26' }}>{m.overall?.toFixed(1) ?? '—'}</b></div>
                      </div>
                      {m.id && (
                        <Link to={`/evaluate?evalId=${m.id}`}
                          className="shrink-0 inline-flex items-center gap-1 text-xs font-bold rounded-lg border border-gray-300 px-2.5 py-1.5 text-gray-700 hover:bg-gray-100">
                          <Pencil size={12} /> Edit
                        </Link>
                      )}
                    </div>
                  ))}
                  <CoachCommentBox
                    value={notes[`${id}:${day}`]}
                    label={`Coach comment — Day ${day}`}
                    onSave={(t) => saveNote(id, day, t)}
                  />
                </div>
              )}
            </div>
          )
        })}

        {ids.length > 0 && (
          <div className="mt-2 rounded-xl border border-[#E85D26]/30 bg-orange-50 p-3">
            <CoachCommentBox
              value={finalNote}
              label={`Final note — Day ${day} (added at the bottom of every Day ${day} PDF)`}
              placeholder="Your personal closing note for this day — appears under the evaluations in the PDF…"
              savedMessage="Final note saved on this device"
              onSave={(t) => {
                setFinalNote(t)
                try { localStorage.setItem(dayNoteKey(day), t) } catch { /* ignore */ }
              }}
            />
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function EvoArrow({ d }) {
  if (d == null) return <Minus size={13} className="text-gray-400" />
  if (d > 0) return <TrendingUp size={13} className="text-emerald-500" />
  if (d < 0) return <TrendingDown size={13} className="text-red-500" />
  return <Minus size={13} className="text-gray-400" />
}

function FinalPanel({ tournament, evals }) {
  const byRef = useMemo(() => refMapFromEvals(evals), [evals])
  const [busy, setBusy] = useState(null)
  const { notes, save: saveNote } = useSummaryNotes(tournament?.id)
  const ids = Object.keys(byRef)

  async function downloadFor(refId) {
    const { referee, evals: re } = byRef[refId]
    setBusy(refId)
    try {
      const evolution = refereeEvolution(re)
      const advice = refereeTournamentAdvice(re)
      const blob = await generateRefereeTournamentDigestPDF({ referee, tournament, evolution, advice, coachComment: notes[`${refId}:0`] })
      downloadPDF(blob, `BVB_Tournament_${refereeName(referee).replace(/\s+/g, '_')}.pdf`)
    } catch (e) { toast.error('PDF failed: ' + e.message) } finally { setBusy(null) }
  }
  async function whatsappFor(refId) {
    const { referee, evals: re } = byRef[refId]
    const sent = await shareTournamentDigestToReferee({ referee, tournament, evolution: refereeEvolution(re), advice: refereeTournamentAdvice(re), coachComment: notes[`${refId}:0`] })
    if (!sent) toast.error(`No WhatsApp number saved for ${refereeName(referee)} — add it on the Referees page.`, 7000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Award size={14} /> End-of-tournament evaluation per referee</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2">
        {ids.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">No evaluations for this tournament yet.</p>
        ) : ids.map((id) => {
          const { referee, evals: re } = byRef[id]
          const evo = refereeEvolution(re)
          const d = evo.evolution?.overall
          return (
            <div key={id} className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{refereeName(referee)}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    avg <b>{evo.overall.overall?.toFixed(1) ?? '—'}</b>
                    {evo.evolution && (<><span className="text-gray-300">·</span><EvoArrow d={d} /> {d != null ? (d > 0 ? `+${d.toFixed(1)}` : d.toFixed(1)) : ''} <span className="text-gray-400">D{evo.evolution.fromDay}→D{evo.evolution.toDay}</span></>)}
                    <span className="text-gray-300">·</span> {evo.count} match{evo.count === 1 ? '' : 'es'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="xs" onClick={() => downloadFor(id)} disabled={busy === id}>
                    <FileText size={12} /> {busy === id ? '…' : 'PDF'}
                  </Button>
                  <Button variant="outline" size="xs" onClick={() => whatsappFor(id)}>
                    <MessageCircle size={12} /> WhatsApp
                  </Button>
                </div>
              </div>
              <CoachCommentBox
                value={notes[`${id}:0`]}
                label="Final coach comment"
                onSave={(t) => saveNote(id, 0, t)}
              />
            </div>
          )
        })}
      </CardBody>
    </Card>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr) {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function buildRankingFromEvals(evaluations) {
  const map = {}
  evaluations.forEach((ev) => {
    const ref = ev.referees
    if (!ref) return
    if (!map[ref.id]) {
      map[ref.id] = { ...ref, scores: [], evaluations: [] }
    }
    if (ev.overall_score != null) map[ref.id].scores.push(ev.overall_score)
    map[ref.id].evaluations.push(ev)
  })
  return Object.values(map)
    .map((r) => ({
      ...r,
      avg_score: r.scores.length ? avg(r.scores) : null,
      total_evaluations: r.scores.length,
    }))
    .sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0))
}

function computeCriteriaAvgs(evaluations) {
  const totals = {}
  const counts = {}
  CRITERIA.forEach((c) => { totals[c.key] = 0; counts[c.key] = 0 })

  evaluations.forEach((ev) => {
    CRITERIA.forEach((c) => {
      const val = ev[`score_${c.key}`]
      if (val != null) { totals[c.key] += val; counts[c.key]++ }
    })
  })

  return CRITERIA.map((c) => ({
    ...c,
    avg: counts[c.key] > 0 ? totals[c.key] / counts[c.key] : null,
    count: counts[c.key],
  })).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
}

function findMostImproved(evaluations) {
  const byRef = {}
  evaluations.forEach((ev) => {
    const ref = ev.referees
    if (!ref || ev.overall_score == null) return
    if (!byRef[ref.id]) byRef[ref.id] = { ref, scores: [] }
    byRef[ref.id].scores.push({ score: ev.overall_score, date: ev.evaluated_at || ev.created_at })
  })

  let best = null
  let bestImprovement = -Infinity

  Object.values(byRef).forEach(({ ref, scores }) => {
    if (scores.length < 2) return
    const sorted = scores.sort((a, b) => new Date(a.date) - new Date(b.date))
    const improvement = sorted[sorted.length - 1].score - sorted[0].score
    if (improvement > bestImprovement) {
      bestImprovement = improvement
      best = { ref, improvement, first: sorted[0].score, last: sorted[sorted.length - 1].score }
    }
  })

  return best
}

// ─── Podium ───────────────────────────────────────────────────────────────────

function PodiumSpot({ entry, rank }) {
  if (!entry) return <div className="flex-1" />

  const heights = { 1: 'h-24', 2: 'h-16', 3: 'h-12' }
  const colors  = { 1: 'from-amber-500/20 to-amber-500/5 border-amber-500/30', 2: 'from-gray-400/15 to-gray-400/5 border-gray-400/25', 3: 'from-orange-600/15 to-orange-600/5 border-orange-600/25' }
  const textCol = { 1: 'text-amber-400', 2: 'text-gray-700', 3: 'text-orange-500' }
  const lvlColor = levelColor(entry.ranking_level)

  return (
    <div className={cn('flex-1 flex flex-col items-center gap-2', rank === 1 ? 'order-2' : rank === 2 ? 'order-1' : 'order-3')}>
      {/* Avatar */}
      <div className={cn('w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border-2', lvlColor, rank === 1 ? 'w-16 h-16 text-base border-amber-400/60' : 'border-gray-300')}>
        {entry.first_name?.[0]}{entry.last_name?.[0]}
      </div>
      <div className="text-center min-w-0 w-full px-1">
        <p className={cn('text-xs font-semibold truncate', rank === 1 ? 'text-sm text-gray-900' : 'text-gray-700')}>
          {entry.first_name} {entry.last_name}
        </p>
        <p className={cn('font-bold text-base', textCol[rank])}>
          {entry.avg_score?.toFixed(2) ?? '—'}
        </p>
      </div>
      {/* Podium block */}
      <div className={cn('w-full rounded-t-lg bg-gradient-to-t border-t border-x', heights[rank], colors[rank])}>
        <div className={cn('flex items-start justify-center pt-2 text-lg font-black', textCol[rank])}>
          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
        </div>
      </div>
    </div>
  )
}

// ─── Day Report ───────────────────────────────────────────────────────────────
function dayCountOf(tournament) {
  if (!tournament?.start_date) return 2
  const s = new Date(tournament.start_date)
  const e = new Date(tournament.end_date || tournament.start_date)
  const n = Math.round((e - s) / 86400000) + 1
  return Math.max(1, Math.min(n, 10))
}

// Textarea che traduce in inglese su blur (come i coach comment)
function TranslatingTextarea({ value, onCommit, rows = 3, placeholder }) {
  const [text, setText] = useState(value || '')
  const [translating, setTranslating] = useState(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { setText(value || ''); setDirty(false) }, [value])
  async function commit() {
    if (!dirty) return
    let out = text.trim()
    if (out && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      setTranslating(true)
      try { const en = await translateToEnglish(out); if (en && en.trim() && en.trim() !== out) { out = en.trim(); setText(out) } }
      catch { /* keep original */ } finally { setTranslating(false) }
    }
    setDirty(false)
    onCommit(out)
  }
  return (
    <div>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setDirty(true) }} onBlur={commit} rows={rows} placeholder={placeholder}
        className="w-full text-sm rounded-lg border border-gray-300 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
      {translating && <div className="text-[11px] text-gray-400 mt-0.5">Translating…</div>}
    </div>
  )
}

function DayReportPanel({ tournament }) {
  const dayCount = dayCountOf(tournament)
  const [day, setDay] = useState(1)
  useEffect(() => { setDay(1) }, [tournament?.id])
  const [report, setReport] = useState({ went_well: '', to_improve: '', incidents: [] })
  const [loading, setLoading] = useState(false)
  const [savingPdf, setSavingPdf] = useState(false)
  const [ruleBusy, setRuleBusy] = useState(null)

  useEffect(() => {
    let alive = true
    if (!tournament?.id) { setReport({ went_well: '', to_improve: '', incidents: [] }); return }
    setLoading(true)
    dayReportService.get(tournament.id, day)
      .then(({ data }) => { if (alive) setReport(data ? { went_well: data.went_well || '', to_improve: data.to_improve || '', incidents: data.incidents || [] } : { went_well: '', to_improve: '', incidents: [] }) })
      .catch(() => { if (alive) setReport({ went_well: '', to_improve: '', incidents: [] }) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tournament?.id, day])

  async function save(next) {
    setReport(next)
    if (!tournament?.id) return
    try { await trackSave(() => dayReportService.upsert({ tournament_id: tournament.id, day_number: day, ...next })) }
    catch (e) { toast.error('Save failed: ' + (e?.message || '')) }
  }
  const withIncident = (i, key, v) => ({ ...report, incidents: report.incidents.map((it, idx) => (idx === i ? { ...it, [key]: v } : it)) })

  async function suggestRule(i) {
    const problem = (report.incidents[i]?.problem || '').trim()
    if (!problem) { toast.info('Write the problem first'); return }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { toast.error('Rule lookup needs internet'); return }
    setRuleBusy(i)
    try {
      const ref = await lookupRuleReference(problem)
      if (ref && ref.trim()) save(withIncident(i, 'rule', ref.trim()))
      else toast.info('No rule reference found')
    } catch (e) { toast.error(e.message || 'Rule lookup failed') } finally { setRuleBusy(null) }
  }

  async function downloadPdf() {
    setSavingPdf(true)
    try {
      const blob = await generateCoachDayReportPDF({ tournament, dayNumber: day, report })
      downloadPDF(blob, `BVB_DayReport_${(tournament?.name || 'tournament').replace(/\s+/g, '_')}_Day${day}.pdf`)
    } catch (e) { toast.error('PDF failed: ' + e.message) } finally { setSavingPdf(false) }
  }

  if (!tournament) return <Card><CardBody><p className="text-sm text-gray-500">Select a tournament.</p></CardBody></Card>

  return (
    <Card>
      <CardHeader className="flex items-center justify-between flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2"><ClipboardList size={14} /> Day report</CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {Array.from({ length: dayCount }, (_, k) => k + 1).map((d) => (
              <button key={d} onClick={() => setDay(d)} className={cn('px-2.5 py-1 rounded-lg text-xs font-bold', day === d ? 'bg-[#2D3270] text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-800')}>Day {d}</button>
            ))}
          </div>
          <Button variant="outline" size="xs" onClick={downloadPdf} disabled={savingPdf}><FileText size={12} /> {savingPdf ? '…' : 'PDF'}</Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {loading ? <p className="text-xs text-gray-400">Loading…</p> : (
          <>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">What went well</div>
              <TranslatingTextarea value={report.went_well} onCommit={(v) => save({ ...report, went_well: v })} rows={3} placeholder="What worked well during the day…" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">What needs improvement</div>
              <TranslatingTextarea value={report.to_improve} onCommit={(v) => save({ ...report, to_improve: v })} rows={3} placeholder="What should be fixed or improved…" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Incidents — self-refereed matches</div>
                <Button variant="outline" size="xs" onClick={() => save({ ...report, incidents: [...(report.incidents || []), { court: '', problem: '', action: '', rule: '' }] })}><Plus size={12} /> Add</Button>
              </div>
              {(report.incidents || []).length === 0 ? (
                <p className="text-xs text-gray-400">No incidents. Tap "Add" to log a problem you had to solve in a match played without a referee.</p>
              ) : (
                <div className="space-y-3">
                  {report.incidents.map((it, i) => (
                    <div key={i} className="rounded-xl border border-gray-200 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <input value={it.court || ''} onChange={(e) => setReport(withIncident(i, 'court', e.target.value))} onBlur={() => save(report)} placeholder="Court / match (e.g. C3 · 14:00)"
                          className="flex-1 text-sm rounded-lg border border-gray-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                        <button onClick={() => save({ ...report, incidents: report.incidents.filter((_, idx) => idx !== i) })} className="shrink-0 p-1.5 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-gray-400 mb-0.5">Problem</div>
                        <TranslatingTextarea value={it.problem} onCommit={(v) => save(withIncident(i, 'problem', v))} rows={2} placeholder="What happened…" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-gray-400 mb-0.5">Action taken</div>
                        <TranslatingTextarea value={it.action} onCommit={(v) => save(withIncident(i, 'action', v))} rows={2} placeholder="How you solved it…" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="text-[10px] font-bold uppercase text-gray-400">Rule reference</div>
                          <button onClick={() => suggestRule(i)} disabled={ruleBusy === i} className="flex items-center gap-1 text-[11px] font-semibold text-[#2D3270] hover:underline disabled:opacity-50">
                            <Wand2 size={12} /> {ruleBusy === i ? 'Searching…' : 'Suggest rule'}
                          </button>
                        </div>
                        <input value={it.rule || ''} onChange={(e) => setReport(withIncident(i, 'rule', e.target.value))} onBlur={() => save(report)} placeholder="e.g. Rule 9.1.2 — double touch…"
                          className="w-full text-sm rounded-lg border border-gray-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}

// ─── Score abbreviations legend editor (localStorage, applies to all PDFs) ─────
function LegendEditor() {
  const [open, setOpen] = useState(false)
  const [vals, setVals] = useState(() => readLegendOverrides())
  const [dirty, setDirty] = useState({})
  const [translating, setTranslating] = useState(null)
  function setVal(k, v) { setVals((p) => ({ ...p, [k]: v })); setDirty((d) => ({ ...d, [k]: true })) }
  async function commitField(k) {
    if (!dirty[k]) return
    let v = (vals[k] || '').trim()
    if (v && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      setTranslating(k)
      try { const en = await translateToEnglish(v); if (en && en.trim() && en.trim() !== v) { v = en.trim(); setVals((p) => ({ ...p, [k]: v })) } }
      catch { /* keep original */ } finally { setTranslating(null) }
    }
    setDirty((d) => ({ ...d, [k]: false }))
  }
  function save() {
    const clean = {}
    for (const k of LEGEND_ORDER) { const v = (vals[k] || '').trim(); if (v) clean[k] = v }
    saveLegend(clean)
    toast.success('Legend saved')
  }
  function reset() { resetLegend(); setVals(readLegendOverrides()); setDirty({}); toast.success('Legend reset to defaults') }
  return (
    <Card>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Pencil size={14} /> Score abbreviations (legend)</span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && (
        <CardBody className="space-y-2 pt-0">
          <p className="text-xs text-gray-500">Printed at the bottom of every referee PDF. If you write in Italian it is translated to English automatically when you leave the field. Leave blank to keep the default. Applies to all tournaments.</p>
          {LEGEND_ORDER.map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs font-bold text-[#2D3270]">{k}</span>
              <div className="flex-1">
                <input value={vals[k] || ''} onChange={(e) => setVal(k, e.target.value)} onBlur={() => commitField(k)} placeholder={LEGEND_DEFAULTS[k]}
                  className="w-full text-sm rounded-lg border border-gray-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                {translating === k && <div className="text-[11px] text-gray-400 mt-0.5">Translating…</div>}
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button variant="primary" size="sm" onClick={save}>Save</Button>
            <Button variant="outline" size="sm" onClick={reset}>Reset to defaults</Button>
          </div>
        </CardBody>
      )}
    </Card>
  )
}

// ─── Ranking Table Row ────────────────────────────────────────────────────────

function RankingRow({ entry, rank }) {
  const lvlColor = levelColor(entry.ranking_level)
  const grade = entry.avg_score != null ? getGrade(entry.avg_score) : null
  const repeatFaults = entry.repeat_faults ?? 0

  return (
    <tr className="border-b border-white/5 hover:bg-white/3 transition-colors">
      <td className="py-3 pl-4 pr-2 text-xs font-bold text-gray-500 w-8">
        {rank <= 3 ? (
          <span>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</span>
        ) : rank}
      </td>
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0', lvlColor)}>
            {entry.first_name?.[0]}{entry.last_name?.[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{refereeName(entry)}</p>
            {entry.last_evaluated_at && (
              <p className="text-xs text-gray-600 truncate">Last: {formatDate(entry.last_evaluated_at)}</p>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 pr-3 hidden sm:table-cell">
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded', lvlColor)}>
          {entry.ranking_level}
        </span>
      </td>
      <td className="py-3 pr-3 min-w-[100px] hidden md:table-cell">
        {entry.avg_score != null ? (
          <ScoreBars score={entry.avg_score} />
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>
      <td className="py-3 pr-3 text-center text-xs font-medium text-gray-700 hidden sm:table-cell">
        {entry.total_evaluations ?? 0}
      </td>
      <td className="py-3 pr-4 text-center">
        {repeatFaults > 0 ? (
          <span className="flex items-center gap-1 justify-center text-xs font-semibold text-[#E85D26]">
            <AlertTriangle size={11} />
            {repeatFaults}
          </span>
        ) : (
          <span className="text-gray-700 text-xs">—</span>
        )}
      </td>
      <td className="py-3 pr-4">
        {grade ? (
          <span className={cn('text-xs font-bold', grade.color)}>{entry.avg_score?.toFixed(2)}</span>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>
    </tr>
  )
}

// ─── Criteria Strengths/Weaknesses ────────────────────────────────────────────

function CriteriaBreakdown({ criteriaAvgs }) {
  return (
    <div className="space-y-2.5">
      {criteriaAvgs.map((c, i) => (
        <div key={c.key}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {i === 0 && <TrendingUp size={12} className="text-emerald-400 shrink-0" />}
              {i === criteriaAvgs.length - 1 && <TrendingDown size={12} className="text-red-400 shrink-0" />}
              {i > 0 && i < criteriaAvgs.length - 1 && <div className="w-3" />}
              <span className="text-xs text-gray-700 font-medium truncate">{c.label}</span>
              <Badge variant="default" size="xs">{c.weight}%</Badge>
            </div>
            {c.avg != null && (
              <span className={cn('text-xs font-bold font-mono', scoreColor(c.avg))}>
                {c.avg.toFixed(2)}
              </span>
            )}
          </div>
          {c.avg != null ? (
            <ScoreBars score={c.avg} />
          ) : (
            <div className="h-1.5 bg-gray-50 rounded-full" />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Reports Page ─────────────────────────────────────────────────────────────

export default function Reports() {
  const { tournaments } = useTournaments()
  const { ranking, loading: rankLoading } = useRanking()

  const [selectedTournamentId, setSelectedTournamentId] = useState('')
  const [tournamentEvals, setTournamentEvals] = useState([])
  const [loadingEvals, setLoadingEvals] = useState(false)
  const [mtoRecords, setMtoRecords] = useState([])
  const [activeSection, setActiveSection] = useState('season') // 'season' | 'tournament'

  // Load evaluations when tournament selected
  useEffect(() => {
    if (!selectedTournamentId) { setTournamentEvals([]); return }
    setLoadingEvals(true)
    evaluationService.getByTournament(selectedTournamentId).then(({ data }) => {
      setTournamentEvals(data || [])
      setLoadingEvals(false)
    })
    mtoService.getByTournament(selectedTournamentId)
      .then(({ data }) => setMtoRecords(data || []))
      .catch(() => setMtoRecords([]))
  }, [selectedTournamentId])

  async function downloadMtoPdf(rec) {
    try {
      const blob = await generateBV15PDF(rec)
      downloadPDF(blob, `BV-15_${(rec.athlete_name || 'athlete').replace(/\s+/g, '_')}.pdf`)
    } catch (e) { toast.error('PDF failed: ' + e.message) }
  }

  // Tournament ranking
  const tournamentRanking = useMemo(() => buildRankingFromEvals(tournamentEvals), [tournamentEvals])

  // Criteria averages
  const criteriaAvgs = useMemo(() => computeCriteriaAvgs(tournamentEvals), [tournamentEvals])

  // Most improved
  const mostImproved = useMemo(() => findMostImproved(tournamentEvals), [tournamentEvals])

  // Overall stats
  const tournamentStats = useMemo(() => {
    const scores = tournamentEvals.map((e) => e.overall_score).filter((s) => s != null)
    return {
      total: tournamentEvals.length,
      avgScore: scores.length ? avg(scores) : null,
      topScorer: tournamentRanking[0] || null,
    }
  }, [tournamentEvals, tournamentRanking])

  // Season export
  function exportSeasonCSV() {
    const headers = ['Rank', 'Name', 'Level', 'Avg Score', 'Total Evaluations', 'Repeat Faults']
    const rows = ranking.map((r, i) => [
      i + 1,
      refereeName(r),
      r.ranking_level || '',
      r.avg_score?.toFixed(2) ?? '',
      r.total_evaluations ?? '',
      r.repeat_faults ?? 0,
    ])

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bvb-season-ranking-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Season ranking exported')
  }

  // ── PDF 1: Referee Evaluations Summary ─────────────────────────────────────
  const [downloadingEvalSummary, setDownloadingEvalSummary] = useState(false)
  async function handleDownloadEvalSummary() {
    const tournament = tournaments.find((t) => t.id === selectedTournamentId)
    if (!tournament) return
    if (tournamentEvals.length === 0) {
      toast.error('No evaluations to summarize')
      return
    }
    setDownloadingEvalSummary(true)
    try {
      const blob = await generateEvaluationsSummaryPDF({
        tournament,
        evaluations: tournamentEvals,
      })
      const filename = `BVB_Evaluations_${tournament.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      downloadPDF(blob, filename)
      toast.success('Evaluations summary downloaded')
    } catch (err) {
      toast.error(`PDF generation failed: ${err.message}`)
    } finally {
      setDownloadingEvalSummary(false)
    }
  }

  // ── PDF 2: RC Tournament Report (from rc_reports DB row) ───────────────────
  const [downloadingRcReport, setDownloadingRcReport] = useState(false)
  async function handleDownloadRcReport() {
    const tournament = tournaments.find((t) => t.id === selectedTournamentId)
    if (!tournament) return
    setDownloadingRcReport(true)
    try {
      const { data: report } = await rcReportService.getByTournament(tournament.id)
      if (!report) {
        toast.error('Compile the RC Tournament Report first')
        return
      }
      const blob = await generateRcReportPDF(report, tournament)
      const filename = `BVB_RC_Report_${tournament.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      downloadPDF(blob, filename)
      toast.success('RC Tournament Report downloaded')
    } catch (err) {
      toast.error(`PDF generation failed: ${err.message}`)
    } finally {
      setDownloadingRcReport(false)
    }
  }

  const podiumEntries = ranking.slice(0, 3)

  return (
    <div className="flex flex-col h-full">
      <Header title="Reports" subtitle="Rankings & Analytics" />

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* Section tabs */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit">
          {[
            { id: 'season',     label: 'Season Ranking', icon: Trophy },
            { id: 'tournament', label: 'Tournament Report', icon: BarChart3 },
            { id: 'digest',     label: 'Day digest', icon: CalendarDays },
            { id: 'dayreport',  label: 'Day Report', icon: ClipboardList },
            { id: 'final',      label: 'Tournament eval', icon: Award },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
                activeSection === id
                  ? 'bg-[#2D3270] text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* ── SEASON RANKING ── */}
        {activeSection === 'season' && (
          <>
            {/* Podium */}
            {!rankLoading && ranking.length >= 2 && (
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy size={14} className="text-amber-400" />
                    Season Podium
                  </CardTitle>
                  <Badge variant="navy" size="xs">{ranking.length} referees</Badge>
                </CardHeader>
                <CardBody>
                  <div className="flex items-end gap-3 pt-2 pb-0">
                    {podiumEntries[1] && <PodiumSpot entry={podiumEntries[1]} rank={2} />}
                    {podiumEntries[0] && <PodiumSpot entry={podiumEntries[0]} rank={1} />}
                    {podiumEntries[2] && <PodiumSpot entry={podiumEntries[2]} rank={3} />}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Full ranking table */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users size={14} />
                  Full Season Ranking
                </CardTitle>
                <Button variant="outline" size="xs" onClick={exportSeasonCSV}>
                  <Download size={12} />
                  Export CSV
                </Button>
              </CardHeader>

              {rankLoading ? (
                <CardBody className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
                  ))}
                </CardBody>
              ) : ranking.length === 0 ? (
                <CardBody>
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <BarChart3 size={28} className="text-gray-700" />
                    <p className="text-sm text-gray-500">No ranking data yet</p>
                  </div>
                </CardBody>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/8">
                        <th className="py-2.5 pl-4 pr-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">#</th>
                        <th className="py-2.5 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Referee</th>
                        <th className="py-2.5 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Lvl</th>
                        <th className="py-2.5 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell min-w-[120px]">Score</th>
                        <th className="py-2.5 pr-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Evals</th>
                        <th className="py-2.5 pr-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Faults</th>
                        <th className="py-2.5 pr-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((entry, i) => (
                        <RankingRow key={entry.id} entry={entry} rank={i + 1} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {/* ── TOURNAMENT REPORT ── */}
        {activeSection === 'tournament' && (
          <>
            {/* Tournament selector */}
            <select
              value={selectedTournamentId}
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              className={cn(
                'w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5',
                'text-gray-900 text-sm appearance-none',
                'focus:outline-none focus:border-[#E85D26]/60 focus:ring-1 focus:ring-[#E85D26]/30',
                'transition-colors'
              )}
            >
              <option value="">Select tournament…</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {formatDate(t.start_date)}</option>
              ))}
            </select>

            {!selectedTournamentId && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#2D3270]/15 flex items-center justify-center">
                  <BarChart3 size={28} className="text-[#2D3270]" />
                </div>
                <p className="text-sm text-gray-500">Select a tournament to view its report</p>
              </div>
            )}

            {selectedTournamentId && (
              <>
                {/* Medical Time-Outs (BV-15) */}
                <Card className="overflow-hidden">
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><Stethoscope size={15} /> Medical Time-Outs (BV-15)</CardTitle>
                    <Badge variant={mtoRecords.length ? 'orange' : 'gray'} size="xs">{mtoRecords.length}</Badge>
                  </CardHeader>
                  <CardBody className="space-y-2">
                    {mtoRecords.length === 0 ? (
                      <p className="text-sm text-gray-500 py-2 text-center">No MTO / forfeit recorded for this tournament.</p>
                    ) : mtoRecords.map((rec) => (
                      <div key={rec.id} className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 rounded-xl">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {rec.athlete_name || '—'}
                            <span className={cn('ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded', rec.kind === 'FORFEIT' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{rec.kind === 'FORFEIT' ? 'FORFEIT' : 'MTO'}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {[rec.match_number && `Match ${rec.match_number}`, rec.court && `Court ${rec.court}`, rec.form_date].filter(Boolean).join(' · ')}
                            {rec.able_to_continue != null && (<> · <span className={rec.able_to_continue ? 'text-emerald-600' : 'text-red-600'}>{rec.able_to_continue ? 'can continue' : 'cannot continue'}</span></>)}
                          </div>
                        </div>
                        <Button variant="outline" size="xs" onClick={() => downloadMtoPdf(rec)}><FileText size={12} /> PDF</Button>
                      </div>
                    ))}
                  </CardBody>
                </Card>

                {loadingEvals ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white border border-gray-200 rounded-xl animate-pulse" />)}
                  </div>
                ) : (
                  <>
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* Total evals */}
                      <Card className="p-4 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#2D3270]/30 flex items-center justify-center shrink-0">
                          <ClipboardList size={16} className="text-[#2D3270]" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Evaluations</p>
                          <p className="text-2xl font-bold text-gray-900">{tournamentStats.total}</p>
                        </div>
                      </Card>

                      {/* Avg score */}
                      <Card className="p-4 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <TrendingUp size={16} className="text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Avg Score</p>
                          <p className={cn('text-2xl font-bold', tournamentStats.avgScore != null ? scoreColor(tournamentStats.avgScore) : 'text-gray-900')}>
                            {tournamentStats.avgScore?.toFixed(2) ?? '—'}
                          </p>
                        </div>
                      </Card>

                      {/* Top scorer */}
                      <Card className="p-4 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Trophy size={16} className="text-amber-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Top Scorer</p>
                          {tournamentStats.topScorer ? (
                            <>
                              <p className="text-sm font-bold text-gray-900 truncate">{tournamentStats.topScorer.last_name}</p>
                              <p className={cn('text-xs font-bold', scoreColor(tournamentStats.topScorer.avg_score))}>
                                {tournamentStats.topScorer.avg_score?.toFixed(2)}
                              </p>
                            </>
                          ) : (
                            <p className="text-gray-500">—</p>
                          )}
                        </div>
                      </Card>

                      {/* Most improved */}
                      <Card className="p-4 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#E85D26]/10 flex items-center justify-center shrink-0">
                          <Award size={16} className="text-[#E85D26]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Most Improved</p>
                          {mostImproved ? (
                            <>
                              <p className="text-sm font-bold text-gray-900 truncate">{mostImproved.ref.last_name}</p>
                              <p className="text-xs font-bold text-[#E85D26]">
                                +{mostImproved.improvement.toFixed(2)}
                              </p>
                            </>
                          ) : (
                            <p className="text-gray-500 text-sm">—</p>
                          )}
                        </div>
                      </Card>
                    </div>

                    {/* Two distinct PDF downloads */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Tournament Reports — Download PDFs</CardTitle>
                      </CardHeader>
                      <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* 1. Referee Evaluations Summary */}
                        <div className="flex flex-col gap-2 p-3 rounded-xl border border-gray-200 bg-gray-50">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[#2D3270]/10 flex items-center justify-center">
                              <BarChart3 size={14} className="text-[#2D3270]" />
                            </div>
                            <p className="text-sm font-semibold text-gray-900">
                              Referee Evaluations Summary
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 leading-snug">
                            All evaluations + per-referee averages and ranking for{' '}
                            <strong>{tournaments.find((t) => t.id === selectedTournamentId)?.name}</strong>.
                          </p>
                          <Button
                            variant="navy"
                            size="sm"
                            onClick={handleDownloadEvalSummary}
                            loading={downloadingEvalSummary}
                            disabled={tournamentStats.total === 0}
                          >
                            <Download size={13} /> Download evaluations PDF
                          </Button>
                        </div>

                        {/* 2. RC Tournament Report */}
                        <div className="flex flex-col gap-2 p-3 rounded-xl border border-[#E85D26]/30 bg-orange-50">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[#E85D26]/15 flex items-center justify-center">
                              <FileText size={14} className="text-[#E85D26]" />
                            </div>
                            <p className="text-sm font-semibold text-gray-900">
                              RC Tournament Report
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 leading-snug">
                            Your post-tournament report (technical, organizational, recommendations).
                            Compile it first → then download.
                          </p>
                          <div className="flex gap-2">
                            <Link
                              to={`/rc-report?tournamentId=${selectedTournamentId}`}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-white text-xs font-semibold text-gray-700 transition-colors"
                            >
                              <ExternalLink size={12} /> Compile
                            </Link>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={handleDownloadRcReport}
                              loading={downloadingRcReport}
                              className="flex-1"
                            >
                              <Download size={13} /> Download PDF
                            </Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    {tournamentStats.total === 0 ? (
                      <Card>
                        <CardBody>
                          <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <ClipboardList size={28} className="text-gray-700" />
                            <p className="text-sm text-gray-500">No evaluations recorded for this tournament</p>
                          </div>
                        </CardBody>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Criteria breakdown */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <BarChart3 size={14} />
                              Criteria Averages
                            </CardTitle>
                          </CardHeader>
                          <CardBody>
                            <CriteriaBreakdown criteriaAvgs={criteriaAvgs} />

                            {criteriaAvgs.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-white/8 grid grid-cols-2 gap-3">
                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <TrendingUp size={11} className="text-emerald-400" />
                                    <span className="text-xs font-semibold text-emerald-400">Strongest</span>
                                  </div>
                                  <p className="text-xs text-gray-700 font-medium leading-snug">{criteriaAvgs[0]?.label}</p>
                                  <p className="text-sm font-bold text-emerald-400 mt-0.5">{criteriaAvgs[0]?.avg?.toFixed(2)}</p>
                                </div>
                                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <TrendingDown size={11} className="text-red-400" />
                                    <span className="text-xs font-semibold text-red-400">Weakest</span>
                                  </div>
                                  <p className="text-xs text-gray-700 font-medium leading-snug">{criteriaAvgs[criteriaAvgs.length - 1]?.label}</p>
                                  <p className="text-sm font-bold text-red-400 mt-0.5">{criteriaAvgs[criteriaAvgs.length - 1]?.avg?.toFixed(2)}</p>
                                </div>
                              </div>
                            )}
                          </CardBody>
                        </Card>

                        {/* Tournament ranking */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Trophy size={14} className="text-amber-400" />
                              Tournament Ranking
                            </CardTitle>
                          </CardHeader>
                          <CardBody className="p-0">
                            {tournamentRanking.length === 0 ? (
                              <div className="py-8 text-center text-gray-500 text-sm">No data</div>
                            ) : (
                              <ul className="divide-y divide-gray-100">
                                {tournamentRanking.map((entry, i) => {
                                  const lvlColor = levelColor(entry.ranking_level)
                                  return (
                                    <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                                      <span className="w-5 text-xs font-bold text-gray-500 shrink-0">
                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                                      </span>
                                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0', lvlColor)}>
                                        {entry.first_name?.[0]}{entry.last_name?.[0]}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-900 truncate">{refereeName(entry)}</p>
                                        <p className="text-xs text-gray-600">{entry.total_evaluations} eval{entry.total_evaluations !== 1 ? 's' : ''}</p>
                                      </div>
                                      {entry.avg_score != null && (
                                        <span className={cn('text-sm font-bold', scoreColor(entry.avg_score))}>
                                          {entry.avg_score.toFixed(2)}
                                        </span>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </CardBody>
                        </Card>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── DAY DIGEST (per-referee evening) ── */}
        {activeSection === 'digest' && (
          <>
            <select
              value={selectedTournamentId}
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              className={cn(
                'w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5',
                'text-gray-900 text-sm appearance-none',
                'focus:outline-none focus:border-[#E85D26]/60 focus:ring-1 focus:ring-[#E85D26]/30 transition-colors'
              )}
            >
              <option value="">Select tournament…</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {formatDate(t.start_date)}</option>
              ))}
            </select>
            {!selectedTournamentId ? (
              <p className="text-sm text-gray-500 text-center py-8">Select a tournament to send evening digests.</p>
            ) : loadingEvals ? (
              <div className="h-24 bg-gray-50 rounded-xl animate-pulse" />
            ) : (
              <div className="space-y-4">
                <LegendEditor />
                <DigestPanel tournament={tournaments.find((t) => t.id === selectedTournamentId)} evals={tournamentEvals} />
              </div>
            )}
          </>
        )}

        {/* ── DAY REPORT (osservazioni giornata + problemi partite senza arbitro) ── */}
        {activeSection === 'dayreport' && (
          <>
            <select
              value={selectedTournamentId}
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              className={cn(
                'w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5',
                'text-gray-900 text-sm appearance-none',
                'focus:outline-none focus:border-[#E85D26]/60 focus:ring-1 focus:ring-[#E85D26]/30 transition-colors'
              )}
            >
              <option value="">Select tournament…</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {formatDate(t.start_date)}</option>
              ))}
            </select>
            {!selectedTournamentId ? (
              <p className="text-sm text-gray-500 text-center py-8">Select a tournament to write the day report.</p>
            ) : (
              <DayReportPanel tournament={tournaments.find((t) => t.id === selectedTournamentId)} />
            )}
          </>
        )}

        {/* ── TOURNAMENT EVALUATION (per-referee, both days + evolution) ── */}
        {activeSection === 'final' && (
          <>
            <select
              value={selectedTournamentId}
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              className={cn(
                'w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5',
                'text-gray-900 text-sm appearance-none',
                'focus:outline-none focus:border-[#E85D26]/60 focus:ring-1 focus:ring-[#E85D26]/30 transition-colors'
              )}
            >
              <option value="">Select tournament…</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {formatDate(t.start_date)}</option>
              ))}
            </select>
            {!selectedTournamentId ? (
              <p className="text-sm text-gray-500 text-center py-8">Select a tournament to build the final evaluations.</p>
            ) : loadingEvals ? (
              <div className="h-24 bg-gray-50 rounded-xl animate-pulse" />
            ) : (
              <FinalPanel tournament={tournaments.find((t) => t.id === selectedTournamentId)} evals={tournamentEvals} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
