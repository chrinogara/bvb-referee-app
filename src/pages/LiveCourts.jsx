import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Play,
  Pause,
  Clock,
  Monitor,
  Users as UsersIcon,
} from 'lucide-react'

import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { toast } from '../components/ui/Toast'

import { useTournaments } from '../hooks/useTournaments'
import {
  courtAssignmentService,
  liveMatchService,
} from '../lib/supabase'
import { useAppStore } from '../store/appStore'
import { cn, refereeName, refereeInitials, formatTime } from '../lib/utils'

// ─── Single court SVG component ──────────────────────────────────────────────
//
// FIVB Beach Volleyball court (view from above):
//   16m long × 8m wide, net at the center splits into two 8×8 squares
//
// Referee positions:
//   R1 — on the chair, ABOVE the net, on one side (typically right of scorer's table)
//   R2 — on the GROUND, BELOW the net, opposite side from R1
//   LJ1 — diagonal corner from R1 (back-left of side A)
//   LJ2 — diagonal corner from LJ1 (back-right of side B)
//
function CourtCanvas({ court, assignments, liveMatch, onToggleMatch, onEditStartTime, rankingById }) {
  // Pull referee for each role
  const r1 = assignments.find((a) => a.role === 'R1')
  const r2 = assignments.find((a) => a.role === 'R2')
  const lj1 = assignments.find((a) => a.role === 'LJ1')
  const lj2 = assignments.find((a) => a.role === 'LJ2')

  const isActive = !!liveMatch?.is_active

  return (
    <Card className="overflow-hidden">
      {/* Header: court name + status LED */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2.5 border-b border-gray-200',
        isActive ? 'bg-emerald-50' : 'bg-gray-50'
      )}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{court}</span>
          {isActive ? (
            <span className="relative flex items-center gap-1">
              <span className="relative flex w-2.5 h-2.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider ml-0.5">
                LIVE
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                IDLE
              </span>
            </span>
          )}
        </div>
        {liveMatch?.start_time && (
          <span className="text-xs font-mono text-gray-600 flex items-center gap-1">
            <Clock size={11} />
            {formatTime(liveMatch.start_time)}
          </span>
        )}
      </div>

      {/* Court area — with internal padding so pins stay INSIDE the card boundary */}
      <div className="relative bg-gradient-to-br from-[#F4DEB3] to-[#E8C988] aspect-[1/1.35] overflow-hidden">
        {/* SVG court — sits in the centre with ~15% margin on every side for pin space */}
        <svg
          viewBox="0 0 100 200"
          className="absolute top-[8%] left-[15%] w-[70%] h-[84%]"
          preserveAspectRatio="none"
        >
          <rect x="2" y="2" width="96" height="196" fill="none" stroke="#1E3A8A" strokeWidth="1.2" />
          <line x1="0" y1="100" x2="100" y2="100" stroke="#1E3A8A" strokeWidth="2.2" />
          {[...Array(16)].map((_, i) => (
            <line
              key={i}
              x1={i * 6.5 + 2}
              y1="97"
              x2={i * 6.5 + 2}
              y2="103"
              stroke="#1E3A8A"
              strokeWidth="0.4"
              opacity="0.6"
            />
          ))}
          <circle cx="2" cy="100" r="2" fill="#1E3A8A" />
          <circle cx="98" cy="100" r="2" fill="#1E3A8A" />
          <text x="50" y="28" textAnchor="middle" fontSize="6" fill="#1E3A8A" opacity="0.22" fontFamily="monospace">
            SIDE A
          </text>
          <text x="50" y="178" textAnchor="middle" fontSize="6" fill="#1E3A8A" opacity="0.22" fontFamily="monospace">
            SIDE B
          </text>
        </svg>

        {/* Referee pins — positioned inside the sand area but outside the SVG court */}
        {/* LJ1 — top-left corner (just outside top-left of SVG court) */}
        <RefereePin
          referee={lj1}
          ranking={lj1 && rankingById[lj1.referee_id]}
          role="LJ1"
          style={{ top: '5%', left: '5%' }}
          colorClass="bg-cyan-100 border-cyan-500 text-cyan-800"
        />
        {/* R1 — net level, RIGHT side (chair) */}
        <RefereePin
          referee={r1}
          ranking={r1 && rankingById[r1.referee_id]}
          role="R1"
          style={{ top: '50%', right: '4%' }}
          colorClass="bg-purple-100 border-purple-500 text-purple-800"
          anchor="right"
          big
        />
        {/* R2 — net level, LEFT side (ground) */}
        <RefereePin
          referee={r2}
          ranking={r2 && rankingById[r2.referee_id]}
          role="R2"
          style={{ top: '50%', left: '4%' }}
          colorClass="bg-blue-100 border-blue-500 text-blue-800"
          anchor="left"
          big
        />
        {/* LJ2 — bottom-right corner (diagonal of LJ1) */}
        <RefereePin
          referee={lj2}
          ranking={lj2 && rankingById[lj2.referee_id]}
          role="LJ2"
          style={{ bottom: '5%', right: '5%' }}
          colorClass="bg-cyan-100 border-cyan-500 text-cyan-800"
        />
      </div>

      {/* Footer: actions */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50">
        <Button
          variant={isActive ? 'danger' : 'success'}
          size="xs"
          onClick={() => onToggleMatch(court, !isActive)}
        >
          {isActive ? (
            <>
              <Pause size={12} /> Stop
            </>
          ) : (
            <>
              <Play size={12} /> Start
            </>
          )}
        </Button>
        <button
          type="button"
          onClick={() => onEditStartTime(liveMatch, court)}
          className="text-xs text-gray-600 hover:text-gray-900 underline disabled:opacity-40"
          disabled={!liveMatch}
        >
          Edit time
        </button>
      </div>
    </Card>
  )
}

// ─── Referee pin (positioned absolutely on the court) ────────────────────────
function RefereePin({ referee, ranking, role, style, colorClass, big = false, anchor }) {
  const isLow = ranking?.avg_score != null && ranking.avg_score < 3.0
  // anchor: which side the style coordinate is anchored to (so we know
  // how to NOT use transform that would push the pin out)
  const sizeClass = big ? 'w-9 h-9 text-[10px]' : 'w-7 h-7 text-[9px]'

  if (!referee) {
    return (
      <div
        className="absolute flex flex-col items-center gap-0.5"
        style={style}
      >
        <div
          className={cn(
            'flex items-center justify-center rounded-full',
            'bg-white/70 border-2 border-dashed border-gray-400 text-gray-500',
            'font-semibold',
            sizeClass
          )}
        >
          {role}
        </div>
      </div>
    )
  }

  const name = referee.referees
    ? `${referee.referees.first_name?.[0] || ''}${referee.referees.last_name?.[0] || ''}`
    : '??'
  const lastName = referee.referees?.last_name || ''

  return (
    <div className="absolute" style={style}>
      <div className="flex flex-col items-center gap-0.5">
        <div
          className={cn(
            'flex items-center justify-center rounded-full border-2 font-bold shadow-md',
            sizeClass,
            isLow ? 'bg-red-100 border-red-500 text-red-800 ring-2 ring-red-300' : colorClass
          )}
          title={`${role}: ${referee.referees ? refereeName(referee.referees) : '—'}${
            ranking?.avg_score != null ? ` · avg ${ranking.avg_score.toFixed(1)}` : ''
          }`}
        >
          {name}
        </div>
        <div className="bg-white/95 px-1 py-px rounded text-[9px] font-bold text-gray-700 shadow-sm whitespace-nowrap leading-none">
          {role}
        </div>
        {lastName && (
          <div className="bg-white/90 px-1 rounded text-[8px] text-gray-600 shadow-sm whitespace-nowrap leading-tight max-w-[60px] truncate">
            {lastName}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Edit start time modal ───────────────────────────────────────────────────
function StartTimeModal({ open, onClose, liveMatch, onSave }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    if (liveMatch?.start_time) {
      const d = new Date(liveMatch.start_time)
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
      setTime(local)
    } else {
      setTime('')
    }
  }, [liveMatch])

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} title="Edit match start time" size="sm">
      <div className="space-y-3">
        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          Start time
        </label>
        <input
          type="datetime-local"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E85D26] focus:ring-2 focus:ring-[#E85D26]/20"
        />
        <Button
          variant="primary"
          size="md"
          onClick={() => onSave(new Date(time).toISOString())}
          className="w-full"
          disabled={!time}
        >
          Save
        </Button>
      </div>
    </Modal>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function LiveCourts() {
  const [searchParams] = useSearchParams()
  const { tournaments } = useTournaments()
  const { sandboxMode } = useAppStore()

  const [tournamentId, setTournamentId] = useState(searchParams.get('tournamentId') || '')
  const [dayNumber, setDayNumber] = useState(1)
  const [sessionOrder, setSessionOrder] = useState(1)
  const [assignments, setAssignments] = useState([])
  const [liveMatches, setLiveMatches] = useState([])
  const [editingLive, setEditingLive] = useState(null)
  const [editCourt, setEditCourt] = useState(null)

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

  const tournament = tournaments.find((t) => t.id === tournamentId)
  const courts = useMemo(() => {
    if (!tournament) return []
    if (Array.isArray(tournament.courts) && tournament.courts.length > 0) return tournament.courts
    return ['Court 1', 'Court 2', 'Court 3', 'Court 4']
  }, [tournament])

  const loadData = useCallback(async () => {
    if (!tournamentId) return
    const [{ data: a }, { data: l }] = await Promise.all([
      courtAssignmentService.getByDay(tournamentId, dayNumber),
      liveMatchService.getAllForDay(tournamentId, dayNumber),
    ])
    setAssignments(a || [])
    setLiveMatches(l || [])
  }, [tournamentId, dayNumber])

  useEffect(() => { loadData() }, [loadData])

  // Poll every 5s so multi-device live view stays in sync
  useEffect(() => {
    if (!tournamentId) return
    const id = setInterval(loadData, 5000)
    return () => clearInterval(id)
  }, [loadData, tournamentId])

  // Build court-keyed data for the current session
  const courtData = useMemo(() => {
    const data = {}
    for (const c of courts) {
      const sessAssigns = assignments.filter(
        (a) => a.court === c && a.session_order === sessionOrder
      )
      const live = liveMatches.find(
        (l) => l.court === c && l.session_order === sessionOrder
      )
      data[c] = { assignments: sessAssigns, liveMatch: live }
    }
    return data
  }, [courts, assignments, liveMatches, sessionOrder])

  async function handleToggleMatch(court, start) {
    try {
      const existing = liveMatches.find(
        (l) => l.court === court && l.session_order === sessionOrder
      )
      if (start) {
        const { data, error } = await liveMatchService.startMatch({
          tournamentId,
          dayNumber,
          court,
          sessionOrder,
          startTime: new Date().toISOString(),
          isTest: sandboxMode,
        })
        if (error) {
          console.error('[startMatch error]', error)
          toast.error(`Start failed: ${error.message}`)
          return
        }
        toast.success(`${court} match started`)
      } else if (existing) {
        const { error } = await liveMatchService.stopMatch(existing.id)
        if (error) {
          console.error('[stopMatch error]', error)
          toast.error(`Stop failed: ${error.message}`)
          return
        }
        toast(`${court} match stopped`, 'info')
      } else {
        toast.error('No active match to stop')
        return
      }
      await loadData()
    } catch (err) {
      console.error('[handleToggleMatch exception]', err)
      toast.error(`Action failed: ${err.message || 'Unknown error'}`)
    }
  }

  function handleEditStartTime(liveMatch, court) {
    if (!liveMatch) {
      toast.error('Start the match first')
      return
    }
    setEditingLive(liveMatch)
    setEditCourt(court)
  }

  async function handleSaveStartTime(newTime) {
    if (!editingLive) return
    await liveMatchService.updateStartTime(editingLive.id, newTime)
    setEditingLive(null)
    await loadData()
    toast.success('Start time updated')
  }

  const dayOptions = useMemo(() => {
    if (!tournament) return [1]
    const days =
      Math.ceil(
        (new Date(tournament.end_date) - new Date(tournament.start_date)) / 86400000
      ) + 1
    return Array.from({ length: Math.max(1, days) }, (_, i) => i + 1)
  }, [tournament])

  const sessionOptions = useMemo(() => {
    const pattern = tournament?.rotation_pattern || 'M1-M2-PAUSE-M3'
    return pattern.split('-').map((t, i) => ({
      value: i + 1,
      label: t.trim().toUpperCase() === 'PAUSE' ? `M${i + 1} (Pause)` : `M${i + 1}`,
      isPause: t.trim().toUpperCase() === 'PAUSE',
    }))
  }, [tournament])

  // Build ranking lookup (for low-feedback warning rings)
  const [rankingById, setRankingById] = useState({})
  useEffect(() => {
    import('../lib/supabase').then(({ rankingService }) => {
      rankingService.getAll().then(({ data }) => {
        const m = {}
        for (const r of data || []) m[r.id] = r
        setRankingById(m)
      })
    })
  }, [])

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Live Courts"
        subtitle={
          tournament
            ? `${tournament.name} — Day ${dayNumber}, Session M${sessionOrder}`
            : 'Real-time court view'
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-7xl mx-auto w-full">
        {/* Selectors */}
        <Card>
          <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Tournament"
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
            >
              <option value="">— Select —</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select label="Day" value={dayNumber} onChange={(e) => setDayNumber(Number(e.target.value))}>
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  Day {d}
                </option>
              ))}
            </Select>
            <Select
              label="Session"
              value={sessionOrder}
              onChange={(e) => setSessionOrder(Number(e.target.value))}
            >
              {sessionOptions.map((s) => (
                <option key={s.value} value={s.value} disabled={s.isPause}>
                  {s.label}
                </option>
              ))}
            </Select>
          </CardBody>
        </Card>

        {/* Legend */}
        <Card>
          <CardBody className="flex items-center justify-around flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-purple-100 border-2 border-purple-500 flex items-center justify-center text-[9px] font-bold text-purple-800">
                R1
              </span>
              <span className="text-gray-600">1st Referee (chair)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center text-[9px] font-bold text-blue-800">
                R2
              </span>
              <span className="text-gray-600">2nd Referee (ground)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-cyan-100 border-2 border-cyan-400 flex items-center justify-center text-[9px] font-bold text-cyan-800">
                LJ
              </span>
              <span className="text-gray-600">Line Judges (diagonals)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-gray-600">Match LIVE</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-red-100 border-2 border-red-500 flex items-center justify-center text-[8px] font-bold text-red-800">
                ⚠
              </span>
              <span className="text-gray-600">Low feedback</span>
            </span>
          </CardBody>
        </Card>

        {/* 4-court grid */}
        {tournament && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {courts.map((c) => (
              <CourtCanvas
                key={c}
                court={c}
                assignments={courtData[c]?.assignments || []}
                liveMatch={courtData[c]?.liveMatch}
                onToggleMatch={handleToggleMatch}
                onEditStartTime={handleEditStartTime}
                rankingById={rankingById}
              />
            ))}
          </div>
        )}

        {tournament && courts.length === 0 && (
          <Card>
            <CardBody className="text-center py-10 text-sm text-gray-500">
              No courts configured. Go to Assignments → Config to set them up.
            </CardBody>
          </Card>
        )}
      </div>

      <StartTimeModal
        open={!!editingLive}
        onClose={() => setEditingLive(null)}
        liveMatch={editingLive}
        onSave={handleSaveStartTime}
      />
    </div>
  )
}
