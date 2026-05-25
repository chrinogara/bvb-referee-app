import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users,
  ClipboardList,
  Trophy,
  TrendingUp,
  ChevronRight,
  CalendarDays,
  Star,
  AlertCircle,
  Plus,
  BarChart3,
  AlertTriangle,
  X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Header } from '../components/layout/Header'
import { alertService } from '../lib/supabase'
import { Card, CardHeader, CardBody, CardTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'

import { useReferees } from '../hooks/useReferees'
import { useEvaluations } from '../hooks/useEvaluations'
import { useRanking } from '../hooks/useRanking'
import { useTournaments } from '../hooks/useTournaments'

import {
  cn,
  formatDate,
  refereeName,
  roleColor,
  scoreColor,
} from '../lib/utils'
import { getGrade } from '../lib/scoring'

// ─── helpers ─────────────────────────────────────────────────────────────────

function tournamentStatus(t) {
  const now = new Date()
  const start = new Date(t.start_date)
  const end = new Date(t.end_date)
  if (now < start) return 'UPCOMING'
  if (now > end) return 'PAST'
  return 'ONGOING'
}

function statusBadge(status) {
  switch (status) {
    case 'UPCOMING': return <Badge variant="navy">{status}</Badge>
    case 'ONGOING':  return <Badge variant="orange">{status}</Badge>
    case 'PAST':     return <Badge variant="default">{status}</Badge>
    default:         return null
  }
}

function starRating(count = 0) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      size={12}
      className={i < count ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}
    />
  ))
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <Card className="p-4 flex items-start gap-3">
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          accent || 'bg-[#2D3270]/10'
        )}
      >
        <Icon size={20} className="text-[#2D3270]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5 truncate">{sub}</p>}
      </div>
    </Card>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { referees } = useReferees()
  const { evaluations } = useEvaluations()
  const { ranking } = useRanking()
  const { tournaments } = useTournaments()

  // Nearest upcoming tournament
  const upcomingTournament = useMemo(() => {
    const now = new Date()
    return tournaments
      .filter((t) => new Date(t.start_date) > now)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0] || null
  }, [tournaments])

  // Season avg score from ranking
  const seasonAvg = useMemo(() => {
    const valid = ranking.filter((r) => r.avg_score != null)
    if (!valid.length) return null
    const sum = valid.reduce((acc, r) => acc + r.avg_score, 0)
    return (sum / valid.length).toFixed(2)
  }, [ranking])

  // Last 5 evaluations (sorted newest first)
  const recentEvals = useMemo(
    () =>
      [...evaluations]
        .sort((a, b) => new Date(b.created_at || b.match_date) - new Date(a.created_at || a.match_date))
        .slice(0, 5),
    [evaluations]
  )

  // Tournaments sorted chronologically
  const sortedTournaments = useMemo(
    () => [...tournaments].sort((a, b) => new Date(a.start_date) - new Date(b.start_date)),
    [tournaments]
  )

  // ── Risk Alerts ─────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState([])
  useEffect(() => {
    alertService.getActive().then(({ data }) => setAlerts(data || []))
  }, [])

  async function acknowledgeAlert(id) {
    await alertService.acknowledge(id)
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" subtitle="Belgian Beach Tour 2026" />

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* ── Risk Alerts Banner ── */}
        {alerts.length > 0 && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-400" />
                <CardTitle className="text-red-400">
                  Referee Risk Alerts ({alerts.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardBody className="space-y-1.5">
              {alerts.slice(0, 5).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {a.referees ? refereeName(a.referees) : 'Unknown'}
                      <span className="text-red-300/80 font-normal ml-2 text-xs">
                        avg {a.triggered_avg?.toFixed(1)} · {a.tournaments?.name}
                      </span>
                    </div>
                    {a.notes && (
                      <p className="text-xs text-red-300/60 mt-0.5 truncate">{a.notes}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => acknowledgeAlert(a.id)}
                    className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                    aria-label="Acknowledge"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {alerts.length > 5 && (
                <p className="text-xs text-red-300/60 text-center pt-1">
                  + {alerts.length - 5} more
                </p>
              )}
            </CardBody>
          </Card>
        )}

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={Users}
            label="Total Referees"
            value={referees.length}
            sub="registered this season"
          />
          <StatCard
            icon={CalendarDays}
            label="Next Tournament"
            value={upcomingTournament ? upcomingTournament.name : '—'}
            sub={upcomingTournament ? formatDate(upcomingTournament.start_date) : 'No upcoming events'}
            accent="bg-[#E85D26]/15"
          />
          <StatCard
            icon={ClipboardList}
            label="Total Evaluations"
            value={evaluations.length}
            sub="across all tournaments"
          />
          <StatCard
            icon={TrendingUp}
            label="Season Avg Score"
            value={seasonAvg != null ? seasonAvg : '—'}
            sub="weighted overall score"
            accent="bg-emerald-500/10"
          />
        </div>

        {/* ── Quick Actions ── */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Link
              to="/briefing"
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-[#E85D26]/40 hover:bg-orange-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#E85D26]/10 flex items-center justify-center group-hover:bg-[#E85D26]/15 transition-colors">
                <BarChart3 size={18} className="text-[#E85D26]" />
              </div>
              <span className="text-xs font-semibold text-gray-700">Briefing</span>
            </Link>
            <Link
              to="/assignments"
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-[#2D3270]/40 hover:bg-blue-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#2D3270]/10 flex items-center justify-center">
                <CalendarDays size={18} className="text-[#2D3270]" />
              </div>
              <span className="text-xs font-semibold text-gray-700">Assignments</span>
            </Link>
            <Link
              to="/live-courts"
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <AlertCircle size={18} className="text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-gray-700">Live Courts</span>
            </Link>
            <Link
              to="/evaluate"
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <Plus size={18} className="text-purple-600" />
              </div>
              <span className="text-xs font-semibold text-gray-700">New Evaluation</span>
            </Link>
          </CardBody>
        </Card>

        {/* ── Recent Evaluations ── */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Recent Evaluations</CardTitle>
            <Link
              to="/evaluate"
              className="text-xs text-[#E85D26] hover:text-[#C44D1E] font-medium transition-colors flex items-center gap-1"
            >
              + New <ChevronRight size={12} />
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            {recentEvals.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-sm">
                No evaluations yet.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentEvals.map((ev) => {
                  const ref = ev.referees
                  const grade = getGrade(ev.overall_score)
                  const dateStr = ev.created_at
                    ? formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })
                    : formatDate(ev.match_date)

                  return (
                    <li
                      key={ev.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/referees/${ref?.id}`)}
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-[#2D3270]/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-[#2D3270]">
                          {ref
                            ? `${ref.first_name?.[0] || ''}${ref.last_name?.[0] || ''}`
                            : '??'}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {ref ? refereeName(ref) : 'Unknown Referee'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {ev.tournaments?.name || '—'} · {dateStr}
                        </p>
                      </div>

                      {/* Role badge */}
                      {ev.role && (
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                            roleColor(ev.role)
                          )}
                        >
                          {ev.role}
                        </span>
                      )}

                      {/* Score */}
                      <div className="text-right shrink-0">
                        <span
                          className={cn(
                            'text-base font-bold',
                            scoreColor(ev.overall_score)
                          )}
                        >
                          {ev.overall_score?.toFixed(1) ?? '—'}
                        </span>
                        <p className={cn('text-[10px] font-semibold', grade.color)}>
                          {grade.grade}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* ── Tournament Timeline ── */}
        <Card>
          <CardHeader>
            <CardTitle>Tournament Timeline</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {sortedTournaments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No tournaments configured.</p>
            ) : (
              sortedTournaments.map((t, idx) => {
                const status = tournamentStatus(t)
                const isOngoing = status === 'ONGOING'

                return (
                  <div
                    key={t.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-xl border transition-colors',
                      isOngoing
                        ? 'border-[#E85D26]/30 bg-[#E85D26]/5'
                        : 'border-white/8 bg-white/3 hover:bg-gray-50'
                    )}
                  >
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center pt-1 gap-1 shrink-0">
                      <div
                        className={cn(
                          'w-3 h-3 rounded-full border-2',
                          isOngoing
                            ? 'bg-[#E85D26] border-[#E85D26]'
                            : status === 'PAST'
                            ? 'bg-gray-600 border-gray-600'
                            : 'bg-[#2D3270] border-[#7B85C9]'
                        )}
                      />
                      {idx < sortedTournaments.length - 1 && (
                        <div className="w-px h-6 bg-gray-100" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                        {statusBadge(status)}
                        {t.is_finals && (
                          <Badge variant="amber" size="xs">Finals</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(t.start_date)}
                        {t.end_date && t.end_date !== t.start_date
                          ? ` – ${formatDate(t.end_date)}`
                          : ''}
                      </p>
                      {/* Star rating */}
                      {t.star_rating != null && (
                        <div className="flex items-center gap-0.5 mt-1">
                          {starRating(t.star_rating)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </CardBody>
        </Card>

        {/* ── Quick Actions ── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 px-1">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => navigate('/evaluate')}
              className="flex items-center gap-4 p-4 rounded-xl bg-[#E85D26]/10 border border-[#E85D26]/20 hover:bg-[#E85D26]/20 transition-colors text-left group"
            >
              <div className="w-11 h-11 rounded-xl bg-[#E85D26]/20 flex items-center justify-center shrink-0 group-hover:bg-[#E85D26]/30 transition-colors">
                <Plus size={22} className="text-[#E85D26]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">New Evaluation</p>
                <p className="text-xs text-gray-500 mt-0.5">Score a referee match</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/referees')}
              className="flex items-center gap-4 p-4 rounded-xl bg-[#2D3270]/20 border border-[#2D3270]/40 hover:bg-[#2D3270]/30 transition-colors text-left group"
            >
              <div className="w-11 h-11 rounded-xl bg-[#2D3270]/30 flex items-center justify-center shrink-0 group-hover:bg-[#2D3270]/50 transition-colors">
                <Users size={22} className="text-[#2D3270]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">View Rankings</p>
                <p className="text-xs text-gray-500 mt-0.5">Season leaderboard</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/reports')}
              className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors text-left group"
            >
              <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-white/12 transition-colors">
                <BarChart3 size={22} className="text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Reports</p>
                <p className="text-xs text-gray-500 mt-0.5">Analytics &amp; exports</p>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
