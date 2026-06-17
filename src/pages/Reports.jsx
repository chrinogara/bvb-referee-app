import { useState, useMemo, useEffect } from 'react'
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
  Award,
  FileText,
  ExternalLink,
  CalendarDays,
  MessageCircle,
  Minus,
} from 'lucide-react'

import { Header } from '../components/layout/Header'
import { Card, CardHeader, CardBody, CardTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ScoreCircle, ScoreBars } from '../components/ui/ScoreCircle'
import { toast } from '../components/ui/Toast'

import { useTournaments } from '../hooks/useTournaments'
import { useRanking } from '../hooks/useRanking'
import { evaluationService, rcReportService } from '../lib/supabase'
import { CRITERIA, getGrade } from '../lib/scoring'
import { cn, formatDate, refereeName, levelColor, scoreColor } from '../lib/utils'
import {
  generateEvaluationsSummaryPDF,
  generateRcReportPDF,
  generateRefereeDayDigestPDF,
  generateRefereeTournamentDigestPDF,
  downloadPDF,
} from '../lib/pdf'
import { refereeDayDigest, refereeEvolution, refereeTournamentAdvice } from '../lib/report'
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

  async function downloadFor(refId) {
    const { referee, evals: re } = byRef[refId]
    setBusy(refId)
    try {
      const digest = refereeDayDigest(re)
      const blob = await generateRefereeDayDigestPDF({ referee, tournament, dayNumber: day, digest })
      downloadPDF(blob, `BVB_Day${day}_${refereeName(referee).replace(/\s+/g, '_')}.pdf`)
    } catch (e) { toast.error('PDF failed: ' + e.message) } finally { setBusy(null) }
  }
  function whatsappFor(refId) {
    const { referee, evals: re } = byRef[refId]
    shareDayDigestToReferee({ referee, tournament, dayNumber: day, digest: refereeDayDigest(re) })
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
          return (
            <div key={id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{refereeName(referee)}</div>
                <div className="text-xs text-gray-500">{dig.count} match{dig.count === 1 ? '' : 'es'} · day avg <b style={{ color: '#E85D26' }}>{dig.averages.overall?.toFixed(1) ?? '—'}</b></div>
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
          )
        })}
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
  const ids = Object.keys(byRef)

  async function downloadFor(refId) {
    const { referee, evals: re } = byRef[refId]
    setBusy(refId)
    try {
      const evolution = refereeEvolution(re)
      const advice = refereeTournamentAdvice(re)
      const blob = await generateRefereeTournamentDigestPDF({ referee, tournament, evolution, advice })
      downloadPDF(blob, `BVB_Tournament_${refereeName(referee).replace(/\s+/g, '_')}.pdf`)
    } catch (e) { toast.error('PDF failed: ' + e.message) } finally { setBusy(null) }
  }
  function whatsappFor(refId) {
    const { referee, evals: re } = byRef[refId]
    shareTournamentDigestToReferee({ referee, tournament, evolution: refereeEvolution(re), advice: refereeTournamentAdvice(re) })
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
            <div key={id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
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
  const [activeSection, setActiveSection] = useState('season') // 'season' | 'tournament'

  // Load evaluations when tournament selected
  useEffect(() => {
    if (!selectedTournamentId) { setTournamentEvals([]); return }
    setLoadingEvals(true)
    evaluationService.getByTournament(selectedTournamentId).then(({ data }) => {
      setTournamentEvals(data || [])
      setLoadingEvals(false)
    })
  }, [selectedTournamentId])

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
              <DigestPanel tournament={tournaments.find((t) => t.id === selectedTournamentId)} evals={tournamentEvals} />
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
