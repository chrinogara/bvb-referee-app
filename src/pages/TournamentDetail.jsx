import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Trophy,
  Calendar,
  MapPin,
  Star,
  Users,
  Plus,
  ChevronRight,
  Clock,
  Edit2,
  Check,
  FileText,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardBody, CardTitle } from '../components/ui/Card'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { useTournaments, useTournamentReferees } from '../hooks/useTournaments'
import { useReferees } from '../hooks/useReferees'
import { useEvaluations } from '../hooks/useEvaluations'
import { generateCommentsRecapPDF, generateGroupSummaryPDF, collectEvalComments, downloadPDF, sharePDFWhatsApp } from '../lib/pdf'
import { summarizeGroupFeedback } from '../lib/anthropic'
import { matchService, courtAssignmentService } from '../lib/supabase'
import {
  cn,
  formatDate,
  formatDateTime,
  formatTime,
  refereeName,
  levelColor,
  seriesColor,
  roleColor,
  tournamentDuration,
  isUpcoming,
  isOngoing,
  isPast,
} from '../lib/utils'
import { getGradeColor, getGradeBg } from '../lib/scoring'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function StarRating({ rating }) {
  if (!rating) return null
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: rating }).map((_, i) => (
        <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
      ))}
      {Array.from({ length: 3 - rating }).map((_, i) => (
        <Star key={i} size={13} className="text-gray-600" />
      ))}
    </span>
  )
}

function formatDateRange(start, end) {
  if (!start) return '—'
  const s = new Date(start)
  const e = new Date(end)
  const startDay = s.getDate()
  const endDay = e.getDate()
  const month = s.toLocaleString('en-GB', { month: 'short' })
  const year = s.getFullYear()
  if (startDay === endDay) return `${startDay} ${month} ${year}`
  return `${startDay}–${endDay} ${month} ${year}`
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Referees', 'Courts', 'Evaluations']

function TabBar({ active, onChange }) {
  return (
    <div className="flex border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto scrollbar-none">
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            'flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px',
            active === tab
              ? 'border-[#E85D26] text-[#E85D26]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────

function OverviewTab({ tournament, refereesCount, matchesCount, evaluationsCount, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [regulations, setRegulations] = useState(tournament.regulations || '')
  const [saving, setSaving] = useState(false)

  async function saveRegulations() {
    setSaving(true)
    try {
      await onUpdate(tournament.id, { regulations })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Main info card */}
      <Card>
        <CardHeader>
          <CardTitle>Tournament Info</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2D3270]/30 flex items-center justify-center flex-shrink-0">
              <Trophy size={18} className="text-[#2D3270]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-gray-900">{tournament.name}</h2>
                {tournament.is_finals && (
                  <Badge variant="orange" size="xs">FINALS</Badge>
                )}
              </div>
              <StarRating rating={tournament.star_rating} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <InfoRow icon={<Calendar size={14} className="text-gray-500" />} label="Dates">
              {formatDateRange(tournament.start_date, tournament.end_date)}
              <span className="ml-2 text-gray-500 text-xs">({tournamentDuration(tournament)})</span>
            </InfoRow>
            {tournament.location && (
              <InfoRow icon={<MapPin size={14} className="text-gray-500" />} label="Location">
                {tournament.location}
              </InfoRow>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Referees" value={refereesCount} color="text-blue-600" />
        <StatCard label="Assignments" value={matchesCount} color="text-emerald-600" />
        <StatCard label="Evaluations" value={evaluationsCount} color="text-[#E85D26]" />
      </div>

      {/* Regulations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Regulations / Notes</CardTitle>
            {!editing && (
              <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>
                <Edit2 size={13} />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {editing ? (
            <div className="flex flex-col gap-3">
              <Textarea
                rows={5}
                value={regulations}
                onChange={(e) => setRegulations(e.target.value)}
                placeholder="Add tournament regulations, notes or reminders..."
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setRegulations(tournament.regulations || '') }}>
                  Cancel
                </Button>
                <Button size="sm" loading={saving} onClick={saveRegulations}>
                  <Check size={14} />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className={cn('text-sm leading-relaxed', regulations ? 'text-gray-700' : 'text-gray-600 italic')}>
              {regulations || 'No regulations added yet.'}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function InfoRow({ icon, label, children }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <span className="text-sm text-gray-700">{children}</span>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <Card>
      <CardBody className="p-3 text-center">
        <p className={cn('text-2xl font-bold tabular-nums', color)}>{value ?? '—'}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </CardBody>
    </Card>
  )
}

// ─── REFEREES TAB ─────────────────────────────────────────────────────────────

function AssignRefereeModal({ open, onClose, allReferees, assigned, onAssign }) {
  const [search, setSearch] = useState('')
  const [assigning, setAssigning] = useState(null)

  const assignedIds = new Set((assigned || []).map((r) => r.id))
  const available = allReferees.filter(
    (r) =>
      !assignedIds.has(r.id) &&
      (search === '' ||
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(search.toLowerCase()))
  )

  async function handleAssign(r) {
    setAssigning(r.id)
    try {
      await onAssign(r.id)
    } finally {
      setAssigning(null)
    }
  }

  function handleClose() {
    setSearch('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Assign Referee" size="md">
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Search referee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
          {available.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">
              {search ? 'No referees match your search.' : 'All referees are already assigned.'}
            </p>
          )}
          {available.map((r) => (
            <button
              key={r.id}
              onClick={() => handleAssign(r)}
              disabled={assigning === r.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-750 border border-white/5 hover:border-gray-300 text-left transition-colors disabled:opacity-60"
            >
              <div className="w-8 h-8 rounded-full bg-[#2D3270]/10 flex items-center justify-center text-xs font-semibold text-[#2D3270] flex-shrink-0">
                {r.first_name?.[0]}{r.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{refereeName(r)}</p>
                {r.nationality && <p className="text-xs text-gray-500">{r.nationality}</p>}
              </div>
              {r.ranking_level && (
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', levelColor(r.ranking_level))}>
                  {r.ranking_level}
                </span>
              )}
              {assigning === r.id && (
                <span className="w-4 h-4 border-2 border-[#E85D26] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function RefereesTab({ tournamentId, assigned, allReferees, onAssign, onRemove }) {
  const [showAssign, setShowAssign] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{assigned.length} referee{assigned.length !== 1 ? 's' : ''} assigned</p>
        <Button size="sm" onClick={() => setShowAssign(true)}>
          <Plus size={14} />
          Assign Referee
        </Button>
      </div>

      {assigned.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center">
            <Users size={20} className="text-gray-600" />
          </div>
          <p className="text-sm text-gray-500">No referees assigned yet.</p>
          <Button size="sm" onClick={() => setShowAssign(true)}>
            <Plus size={14} />
            Assign Referee
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {assigned.map((r) => (
            <Card key={r.id}>
              <CardBody className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#2D3270]/10 flex items-center justify-center text-xs font-semibold text-[#2D3270] flex-shrink-0">
                    {r.first_name?.[0]}{r.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{refereeName(r)}</p>
                    {r.nationality && <p className="text-xs text-gray-500">{r.nationality}</p>}
                  </div>
                  {r.ranking_level && (
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', levelColor(r.ranking_level))}>
                      {r.ranking_level}
                    </span>
                  )}
                  <Button
                    size="xs"
                    variant="danger"
                    onClick={() => onRemove(r.id)}
                  >
                    Remove
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <AssignRefereeModal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        allReferees={allReferees}
        assigned={assigned}
        onAssign={async (id) => {
          await onAssign(id)
          setShowAssign(false)
        }}
      />
    </div>
  )
}

// ─── MATCHES TAB ──────────────────────────────────────────────────────────────

const EMPTY_MATCH_FORM = {
  match_number: '',
  court: '',
  scheduled_time: '',
  day_number: '1',
  round: '',
  series: 'PRO',
  gender: 'M',
  is_final: false,
  team1: '',
  team2: '',
}

function AddMatchModal({ open, onClose, tournamentId, onCreated }) {
  const [form, setForm] = useState(EMPTY_MATCH_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { data, error: err } = await matchService.create({
        ...form,
        tournament_id: tournamentId,
        match_number: form.match_number ? parseInt(form.match_number, 10) : null,
        day_number: form.day_number ? parseInt(form.day_number, 10) : null,
        scheduled_time: form.scheduled_time || null,
      })
      if (err) throw new Error(err.message)
      onCreated(data)
      setForm(EMPTY_MATCH_FORM)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create match.')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setForm(EMPTY_MATCH_FORM)
    setError('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Match" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Match #" name="match_number" type="number" value={form.match_number} onChange={handleChange} placeholder="e.g. 42" />
          <Input label="Court" name="court" value={form.court} onChange={handleChange} placeholder="e.g. Center" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Scheduled Time" name="scheduled_time" type="datetime-local" value={form.scheduled_time} onChange={handleChange} />
          <Input label="Day #" name="day_number" type="number" min="1" value={form.day_number} onChange={handleChange} />
        </div>
        <Input label="Round" name="round" value={form.round} onChange={handleChange} placeholder="e.g. Quarterfinal" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Series" name="series" value={form.series} onChange={handleChange}>
            <option value="PRO">PRO</option>
            <option value="CHALLENGE">CHALLENGE</option>
          </Select>
          <Select label="Gender" name="gender" value={form.gender} onChange={handleChange}>
            <option value="M">M</option>
            <option value="F">F</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Team 1" name="team1" value={form.team1} onChange={handleChange} placeholder="e.g. BRA" />
          <Input label="Team 2" name="team2" value={form.team2} onChange={handleChange} placeholder="e.g. GER" />
        </div>

        {/* is_final checkbox */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div className="relative">
            <input type="checkbox" name="is_final" checked={form.is_final} onChange={handleChange} className="sr-only" />
            <div className={cn(
              'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
              form.is_final ? 'bg-[#E85D26] border-[#E85D26]' : 'border-gray-300 bg-gray-50'
            )}>
              {form.is_final && (
                <svg className="w-3 h-3 text-gray-900" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-gray-700">Final match</span>
        </label>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={handleClose} className="flex-1" type="button">Cancel</Button>
          <Button type="submit" loading={saving} className="flex-1">Add Match</Button>
        </div>
      </form>
    </Modal>
  )
}

function MatchCard({ match }) {
  return (
    <Card>
      <CardBody className="p-3">
        <div className="flex items-start gap-3">
          {/* Match number */}
          <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 border border-white/8">
            <span className="text-xs font-bold text-gray-700">
              {match.match_number ?? '—'}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Teams */}
            {(match.team1 || match.team2) ? (
              <p className="text-sm font-semibold text-gray-900 truncate">
                {match.team1 || '?'} <span className="text-gray-500 font-normal">vs</span> {match.team2 || '?'}
              </p>
            ) : (
              <p className="text-sm font-semibold text-gray-500">Match {match.match_number ?? '—'}</p>
            )}

            {/* Badges row */}
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', seriesColor(match.series))}>
                {match.series}
              </span>
              <Badge variant="default" size="xs">{match.gender}</Badge>
              {match.is_final && <Badge variant="orange" size="xs">FINAL</Badge>}
              {match.round && <span className="text-xs text-gray-500">{match.round}</span>}
            </div>

            {/* Time + court */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {match.scheduled_time && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={11} className="text-gray-500" />
                  {formatDateTime(match.scheduled_time)}
                </span>
              )}
              {match.court && (
                <span className="text-xs text-gray-500">Court {match.court}</span>
              )}
              {match.day_number && (
                <span className="text-xs text-gray-600">Day {match.day_number}</span>
              )}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

// ─── COURTS TAB (read-only summary of assignments per day + link) ────────────
function CourtsTab({ tournament }) {
  const tournamentId = tournament.id
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [dayNumber, setDayNumber] = useState(1)

  // Tournament config
  const courts = useMemo(() => {
    if (Array.isArray(tournament.courts) && tournament.courts.length > 0) return tournament.courts
    return ['Court 1', 'Court 2', 'Court 3', 'Court 4']
  }, [tournament])

  const rotationPattern = tournament.rotation_pattern || 'M1-M2-PAUSE-M3'
  const sessions = useMemo(
    () => rotationPattern.split('-').map((t) => t.trim().toUpperCase()),
    [rotationPattern]
  )

  const dayOptions = useMemo(() => {
    const days =
      Math.ceil(
        (new Date(tournament.end_date) - new Date(tournament.start_date)) / 86400000
      ) + 1
    return Array.from({ length: Math.max(1, days) }, (_, i) => i + 1)
  }, [tournament])

  useEffect(() => {
    if (!tournamentId) return
    setLoading(true)
    courtAssignmentService
      .getByDay(tournamentId, dayNumber)
      .then(({ data }) => {
        setAssignments(data || [])
        setLoading(false)
      })
  }, [tournamentId, dayNumber])

  return (
    <div className="flex flex-col gap-4">
      {/* Info banner */}
      <Card>
        <CardBody className="flex items-start gap-3 text-sm">
          <div className="w-9 h-9 rounded-xl bg-[#E85D26]/10 flex items-center justify-center shrink-0">
            <Users size={16} className="text-[#E85D26]" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Courts &amp; Rotation</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Referees are assigned to <strong>courts</strong> (not individual matches),
              following the <strong className="text-[#2D3270]">{rotationPattern}</strong> rotation.
            </p>
          </div>
          <Link
            to={`/assignments?tournamentId=${tournamentId}`}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E85D26] text-white text-xs font-semibold hover:bg-[#C44D1E] transition-colors"
          >
            Manage
            <ChevronRight size={12} />
          </Link>
        </CardBody>
      </Card>

      {/* Courts config preview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {courts.map((c) => (
          <div
            key={c}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs"
          >
            <MapPin size={12} className="text-[#E85D26]" />
            <span className="font-semibold text-gray-900">{c}</span>
          </div>
        ))}
      </div>

      {/* Day selector */}
      <div className="flex gap-2 flex-wrap">
        {dayOptions.map((d) => (
          <button
            key={d}
            onClick={() => setDayNumber(d)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
              dayNumber === d
                ? 'bg-[#2D3270] border-[#2D3270] text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
            )}
          >
            Day {d}
          </button>
        ))}
      </div>

      {/* Assignments grid (read-only preview) */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Day {dayNumber} — assignments</CardTitle>
          <span className="text-xs text-gray-500">
            {assignments.length} slot{assignments.length !== 1 ? 's' : ''} filled
          </span>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          {loading ? (
            <div className="text-sm text-gray-500 text-center py-6">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 py-2 pl-2">
                    Court
                  </th>
                  {sessions.map((t, i) => (
                    <th
                      key={i}
                      className={cn(
                        'text-left text-[10px] font-bold uppercase tracking-wider py-2 px-2',
                        t === 'PAUSE' ? 'text-amber-600' : 'text-gray-500'
                      )}
                    >
                      {t === 'PAUSE' ? '⏸ Pause' : `M${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courts.map((court) => (
                  <tr key={court} className="border-b border-gray-100">
                    <td className="py-2 pl-2 font-semibold text-gray-900 text-xs">{court}</td>
                    {sessions.map((t, i) => {
                      if (t === 'PAUSE') {
                        return (
                          <td key={i} className="py-2 px-2 text-amber-600/60 italic text-xs">
                            —
                          </td>
                        )
                      }
                      const a = assignments.find(
                        (x) => x.court === court && x.session_order === i + 1
                      )
                      const ref = a?.referees
                      return (
                        <td key={i} className="py-2 px-2">
                          {ref ? (
                            <span className="inline-flex items-center gap-1 text-xs">
                              <span className="font-medium text-gray-900">{ref.last_name}</span>
                              <span className="text-[9px] text-gray-500">Lv.{ref.ranking_level}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && assignments.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-2">No assignments yet for Day {dayNumber}.</p>
              <Link
                to={`/assignments?tournamentId=${tournamentId}`}
                className="inline-flex items-center gap-1 text-xs text-[#E85D26] hover:underline font-semibold"
              >
                Open Assignments to check-in referees and auto-assign
                <ChevronRight size={12} />
              </Link>
            </div>
          )}
        </CardBody>
      </Card>

      {/* CTA full workflow */}
      <Link
        to={`/assignments?tournamentId=${tournamentId}`}
        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#E85D26]/30 bg-orange-50 text-[#E85D26] text-sm font-semibold hover:bg-orange-100 transition-colors"
      >
        Manage assignments interactively
        <ChevronRight size={14} />
      </Link>
    </div>
  )
}

// ─── EVALUATIONS TAB ──────────────────────────────────────────────────────────

function EvaluationsTab({ tournamentId, tournament }) {
  const { evaluations, loading } = useEvaluations({ tournamentId })
  const [genning, setGenning] = useState(false)
  const [genningGroup, setGenningGroup] = useState(false)

  async function makeRecapPdf() {
    setGenning(true)
    try {
      const blob = await generateCommentsRecapPDF({ tournament, evaluations })
      const fname = `Comments_recap_${(tournament?.name || 'tournament').replace(/\s+/g, '_')}.pdf`
      if (navigator.share && navigator.canShare) {
        try { await sharePDFWhatsApp(blob, fname); return } catch { /* fall back to download */ }
      }
      downloadPDF(blob, fname)
    } catch (e) {
      console.error('recap pdf failed', e)
    } finally {
      setGenning(false)
    }
  }

  async function makeGroupPdf() {
    setGenningGroup(true)
    try {
      // Anonymised observations grouped by day (no names).
      const byDayMap = new Map()
      for (const ev of evaluations) {
        const obs = collectEvalComments(ev).map((c) => (c.label ? `${c.label}: ${c.text}` : c.text))
        if (!obs.length) continue
        const day = ev.day_number || 0
        if (!byDayMap.has(day)) byDayMap.set(day, [])
        byDayMap.get(day).push(...obs)
      }
      const days = [...byDayMap.entries()].sort((a, b) => a[0] - b[0])
      const byDay = await Promise.all(days.map(async ([day, obs]) => {
        let text = ''
        try { text = await summarizeGroupFeedback(obs) } catch (e) { console.error('group summary AI failed', e) }
        if (!text) text = obs.map((o) => `- ${o}`).join('\n') // fallback: anonymised bullets
        return { key: String(day), label: day ? `Day ${day}` : 'Overall', text }
      }))
      const blob = await generateGroupSummaryPDF({ tournament, byDay })
      const fname = `Group_debrief_${(tournament?.name || 'tournament').replace(/\s+/g, '_')}.pdf`
      if (navigator.share && navigator.canShare) {
        try { await sharePDFWhatsApp(blob, fname); return } catch { /* fall back to download */ }
      }
      downloadPDF(blob, fname)
    } catch (e) {
      console.error('group pdf failed', e)
    } finally {
      setGenningGroup(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{evaluations.length} evaluation{evaluations.length !== 1 ? 's' : ''}</p>
        <Link to={`/evaluate?tournamentId=${tournamentId}`}>
          <Button size="sm">
            <Plus size={14} />
            New Evaluation
          </Button>
        </Link>
      </div>

      {loading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-white animate-pulse" />
          ))}
        </div>
      )}

      {!loading && evaluations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <p className="text-sm text-gray-500">No evaluations recorded yet.</p>
          <Link to={`/evaluate?tournamentId=${tournamentId}`}>
            <Button size="sm">
              <Plus size={14} />
              New Evaluation
            </Button>
          </Link>
        </div>
      )}

      {!loading && evaluations.length > 0 && (
        <div className="flex flex-col gap-2">
          {evaluations.map((ev) => (
            <EvaluationCard key={ev.id} evaluation={ev} />
          ))}
        </div>
      )}

      {!loading && evaluations.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <button
            type="button"
            onClick={makeRecapPdf}
            disabled={genning}
            className="w-full py-3 rounded-xl bg-[#2D3270] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <FileText size={16} />
            {genning ? 'Generating…' : 'Comments recap (PDF) — by day'}
          </button>
          <button
            type="button"
            onClick={makeGroupPdf}
            disabled={genningGroup}
            className="w-full py-3 rounded-xl border border-[#2D3270] text-[#2D3270] text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Users size={16} />
            {genningGroup ? 'Generating…' : 'Group debrief (PDF) — no names'}
          </button>
        </div>
      )}
    </div>
  )
}

function EvaluationCard({ evaluation }) {
  const referee = evaluation.referees
  const gradeColor = evaluation.grade ? getGradeColor(evaluation.grade) : 'text-gray-500'
  const gradeBg   = evaluation.grade ? getGradeBg(evaluation.grade)   : 'bg-gray-400/10'
  const score = evaluation.overall_score

  return (
    <Link to={`/evaluate?evalId=${evaluation.id}`} className="block active:opacity-80">
    <Card className="hover:border-gray-300 transition-colors">
      <CardBody className="p-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-[#2D3270]/10 flex items-center justify-center text-xs font-semibold text-[#2D3270] flex-shrink-0">
            {referee?.first_name?.[0]}{referee?.last_name?.[0]}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-900 truncate">
                  {referee ? refereeName(referee) : 'Unknown Referee'}
                </p>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {evaluation.role && (
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', roleColor(evaluation.role))}>
                      {evaluation.role}
                    </span>
                  )}
                  {evaluation.day_number && (
                    <span className="text-xs text-gray-500">Day {evaluation.day_number}</span>
                  )}
                  {evaluation.evaluated_at && (
                    <span className="text-xs text-gray-600">{formatDate(evaluation.evaluated_at)}</span>
                  )}
                </div>
              </div>

              {/* Score + grade */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {score != null && (
                  <span className={cn('text-lg font-bold tabular-nums leading-none', gradeColor)}>
                    {score.toFixed(1)}
                  </span>
                )}
                {evaluation.grade && (
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', gradeBg, gradeColor)}>
                    {evaluation.grade}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
    </Link>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function TournamentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Overview')

  const { tournaments, loading: tLoading, update } = useTournaments()
  const { referees: assigned, loading: rLoading, assign, remove } = useTournamentReferees(id)
  const { referees: allReferees } = useReferees()
  const { evaluations } = useEvaluations({ tournamentId: id })

  const tournament = tournaments.find((t) => String(t.id) === String(id))

  // Court-assignment count (across all days)
  const [assignmentCount, setAssignmentCount] = useState(0)
  useEffect(() => {
    if (!id) return
    // Aggregate across days — query without day filter via base service
    import('../lib/supabase').then(({ supabase }) => {
      supabase
        .from('court_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', id)
        .then(({ count }) => setAssignmentCount(count || 0))
    })
  }, [id])

  if (tLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header title="Tournament" />
        <div className="flex-1 flex items-center justify-center">
          <span className="w-8 h-8 border-2 border-[#E85D26] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header title="Tournament" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-6">
          <Trophy size={32} className="text-gray-600" />
          <p className="text-gray-900 font-medium">Tournament not found</p>
          <Button variant="outline" onClick={() => navigate('/tournaments')}>
            Back to Tournaments
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        title={tournament.name}
        subtitle={tournament.location || 'Tournament Detail'}
      />

      <TabBar active={activeTab} onChange={setActiveTab} />

      <main className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full">
        {activeTab === 'Overview' && (
          <OverviewTab
            tournament={tournament}
            refereesCount={assigned.length}
            matchesCount={assignmentCount}
            evaluationsCount={evaluations.length}
            onUpdate={update}
          />
        )}

        {activeTab === 'Referees' && (
          <RefereesTab
            tournamentId={id}
            assigned={assigned}
            allReferees={allReferees}
            onAssign={assign}
            onRemove={remove}
          />
        )}

        {activeTab === 'Courts' && (
          <CourtsTab tournament={tournament} />
        )}

        {activeTab === 'Evaluations' && (
          <EvaluationsTab tournamentId={id} tournament={tournament} />
        )}
      </main>
    </div>
  )
}
