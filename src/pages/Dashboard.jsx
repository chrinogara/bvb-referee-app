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
  AlertTriangle,
  X,
  Plus,
  BarChart3,
  ClipboardCheck,
  BookOpen,
  Monitor,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Header } from '../components/layout/Header'
import { alertService } from '../lib/supabase'

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
  const s = new Date(t.start_date)
  const e = new Date(t.end_date || t.start_date)
  if (s <= now && e >= now) return 'ONGOING'
  if (e < now) return 'PAST'
  return 'UPCOMING'
}

function statusChip(status) {
  const map = {
    UPCOMING: { bg: 'bg-[#2D3270]/10', text: 'text-[#2D3270]' },
    ONGOING:  { bg: 'bg-[#E85D26]/15', text: 'text-[#E85D26]' },
    PAST:     { bg: 'bg-gray-100',     text: 'text-gray-500' },
  }
  const c = map[status] || map.PAST
  return <span className={cn('text-[10px] font-bold rounded-full px-2 py-1', c.bg, c.text)}>{status}</span>
}

function starRating(count) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star key={i} size={12} className={i < count ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
  ))
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-3">
      <div className="flex items-center gap-2">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', accent || 'bg-[#2D3270]/10')}>
          <Icon size={18} className="text-[#2D3270]" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 leading-tight">{label}</span>
      </div>
      <div className="font-display text-2xl font-bold mt-1.5 leading-none truncate text-gray-900">{value}</div>
      {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

// ─── Big action button ─────────────────────────────────────────────────────────

function BigButton({ to, icon: Icon, title, sub, gradient }) {
  return (
    <Link
      to={to}
      className="rounded-2xl p-4 text-white shadow-md active:scale-[.98] transition flex flex-col aspect-[5/4]"
      style={{ background: gradient }}
    >
      <Icon size={30} strokeWidth={2} />
      <div className="mt-auto">
        <div className="font-display text-2xl font-bold uppercase leading-none">{title}</div>
        <div className="text-white/80 text-sm font-medium mt-1">{sub}</div>
      </div>
    </Link>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { referees } = useReferees()
  const { evaluations } = useEvaluations()
  const { ranking } = useRanking()
  const { tournaments } = useTournaments()

  const upcomingTournament = useMemo(() => {
    const now = new Date()
    return tournaments
      .filter((t) => new Date(t.start_date) > now)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0] || null
  }, [tournaments])

  const seasonAvg = useMemo(() => {
    const valid = ranking.filter((r) => r.avg_score != null)
    if (!valid.length) return null
    const sum = valid.reduce((acc, r) => acc + r.avg_score, 0)
    return (sum / valid.length).toFixed(2)
  }, [ranking])

  const recentEvals = useMemo(
    () =>
      [...evaluations]
        .sort((a, b) => new Date(b.created_at || b.match_date) - new Date(a.created_at || a.match_date))
        .slice(0, 5),
    [evaluations]
  )

  const sortedTournaments = useMemo(
    () => [...tournaments].sort((a, b) => new Date(a.start_date) - new Date(b.start_date)),
    [tournaments]
  )

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

      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24 lg:pb-6">

        {/* ── Risk Alerts ── */}
        {alerts.length > 0 && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="font-display text-base font-bold uppercase tracking-wide text-red-600">
                Referee Risk Alerts ({alerts.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {alerts.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-red-200">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {a.referees ? refereeName(a.referees) : 'Unknown'}
                      <span className="text-red-500/80 font-normal ml-2 text-xs">
                        avg {a.triggered_avg?.toFixed(1)} · {a.tournaments?.name}
                      </span>
                    </div>
                    {a.notes && <p className="text-xs text-red-400 mt-0.5 truncate">{a.notes}</p>}
                  </div>
                  <button type="button" onClick={() => acknowledgeAlert(a.id)} className="p-1.5 rounded hover:bg-red-100 text-red-500" aria-label="Acknowledge">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Two big buttons ── */}
        <div className="grid grid-cols-2 gap-3">
          <BigButton
            to="/tournaments"
            icon={Trophy}
            title="Tornei"
            sub={`${tournaments.length || 0} in stagione →`}
            gradient="linear-gradient(135deg, #2D3270, #3D4490)"
          />
          <BigButton
            to="/evaluate"
            icon={ClipboardCheck}
            title="Valutazioni"
            sub="New / history →"
            gradient="linear-gradient(135deg, #E85D26, #C44D1E)"
          />
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Total Referees" value={referees.length} sub="registered this season" />
          <StatCard
            icon={CalendarDays}
            label="Next Tournament"
            value={upcomingTournament ? upcomingTournament.name : '—'}
            sub={upcomingTournament ? formatDate(upcomingTournament.start_date) : 'No upcoming events'}
            accent="bg-[#E85D26]/15"
          />
          <StatCard icon={ClipboardList} label="Total Evaluations" value={evaluations.length} sub="across all tournaments" />
          <StatCard icon={TrendingUp} label="Season Avg Score" value={seasonAvg != null ? seasonAvg : '—'} sub="weighted overall score" accent="bg-emerald-500/10" />
        </div>

        {/* ── Quick actions ── */}
        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-gray-600 mb-2">Azioni rapide</h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              { to: '/briefing',    icon: BookOpen,    label: 'Briefing' },
              { to: '/assignments', icon: CalendarDays, label: 'Assignments' },
              { to: '/live-courts', icon: Monitor,     label: 'Live Courts' },
              { to: '/assistant',   icon: BarChart3,   label: 'Rules AI' },
            ].map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to} className="rounded-2xl bg-white border border-gray-200 shadow-sm py-3 flex flex-col items-center gap-1 active:bg-gray-50">
                <Icon size={22} className="text-[#2D3270]" />
                <span className="text-[11px] font-semibold text-gray-600 text-center leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Recent evaluations ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-gray-600">Valutazioni recenti</h2>
            <Link to="/evaluate" className="text-sm font-semibold text-[#E85D26] flex items-center gap-1">+ New <ChevronRight size={14} /></Link>
          </div>
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            {recentEvals.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">No evaluations yet.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentEvals.map((ev) => {
                  const ref = ev.referees
                  const grade = getGrade(ev.overall_score)
                  const dateStr = ev.created_at
                    ? formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })
                    : formatDate(ev.match_date)
                  return (
                    <li key={ev.id} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 cursor-pointer" onClick={() => navigate(`/referees/${ref?.id}`)}>
                      <div className="w-10 h-10 rounded-xl bg-[#2D3270]/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-[#2D3270]">
                          {ref ? `${ref.first_name?.[0] || ''}${ref.last_name?.[0] || ''}` : '??'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-gray-900 truncate">{ref ? refereeName(ref) : 'Unknown Referee'}</p>
                        <p className="text-xs text-gray-400 truncate">{ev.tournaments?.name || '—'} · {dateStr}</p>
                      </div>
                      {ev.role && (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', roleColor(ev.role))}>{ev.role}</span>
                      )}
                      <div className="text-right shrink-0">
                        <span className={cn('font-display text-xl font-bold', scoreColor(ev.overall_score))}>{ev.overall_score?.toFixed(1) ?? '—'}</span>
                        <p className={cn('text-[10px] font-semibold', grade.color)}>{grade.grade}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ── Tournament timeline ── */}
        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-gray-600 mb-2">Calendario tornei</h2>
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-3">
            {sortedTournaments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No tournaments configured.</p>
            ) : (
              sortedTournaments.map((t, idx) => {
                const status = tournamentStatus(t)
                return (
                  <Link key={t.id} to={`/tournaments/${t.id}`} className="flex items-center gap-3 py-2 active:bg-gray-50 rounded-lg -mx-1 px-1">
                    <div className="flex flex-col items-center shrink-0">
                      <span className={cn('w-3 h-3 rounded-full', status === 'ONGOING' ? 'bg-[#E85D26]' : status === 'PAST' ? 'bg-gray-300' : 'bg-[#2D3270]')} />
                      {idx < sortedTournaments.length - 1 && <span className="w-0.5 h-6 bg-gray-200" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold text-gray-900 truncate">{t.name}</p>
                        {t.is_finals && <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">Finals</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(t.start_date)}{t.end_date && t.end_date !== t.start_date ? ` – ${formatDate(t.end_date)}` : ''}
                      </p>
                      {t.star_rating != null && <div className="flex items-center gap-0.5 mt-1">{starRating(t.star_rating)}</div>}
                    </div>
                    {statusChip(status)}
                  </Link>
                )
              })
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
