import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Calendar,
  Users,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Download,
  Trash2,
  Plus,
  Minus,
  RotateCw,
  MessageCircle,
  Copy,
  Clock,
} from 'lucide-react'

import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardBody, CardTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { toast } from '../components/ui/Toast'

import { useTournaments, useTournamentReferees } from '../hooks/useTournaments'
import { useRanking } from '../hooks/useRanking'
import {
  supabase,
  courtAssignmentService,
  attendanceService,
  tournamentService,
  alertService,
} from '../lib/supabase'
import { autoAssign, ROTATION_PRESETS } from '../lib/rotation'
import {
  buildDesignationMessage,
  buildPersonalMessage,
  shareToWhatsApp,
  copyDesignationMessage,
} from '../lib/whatsapp'
import { generateDesignationPDF, downloadPDF } from '../lib/pdf'
import { cn, refereeName, refereeInitials, formatDate } from '../lib/utils'
import { checkConsecutiveMatches, getAssignmentSummary } from '../lib/validationPause'

// ─── Sub-components ───────────────────────────────────────────────────────────

function RefereeChip({ referee, present, onToggle, riskScore }) {
  const isLowFeedback = riskScore != null && riskScore < 3.0
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'relative flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all duration-150',
        present
          ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
          : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400'
      )}
    >
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
          present ? 'bg-emerald-500/30 text-emerald-300' : 'bg-gray-100 text-gray-500'
        )}
      >
        {refereeInitials(referee)}
      </div>
      <span className="font-medium truncate">{refereeName(referee)}</span>
      <Badge
        variant={
          referee.ranking_level === 'A'
            ? 'green'
            : referee.ranking_level === 'B'
            ? 'blue'
            : 'yellow'
        }
        size="xs"
      >
        {referee.ranking_level}
      </Badge>
      {isLowFeedback && (
        <span
          title={`Low avg score: ${riskScore.toFixed(1)}`}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center"
        >
          <AlertTriangle size={9} className="text-gray-900" />
        </span>
      )}
      {present && (
        <CheckCircle size={14} className="text-emerald-400 ml-auto shrink-0" />
      )}
    </button>
  )
}

function CourtSessionGrid({
  courts,
  assignments,
  pattern,
  refsById,
  rankingById,
  onReassign,
  onSwap,
  conflicts,
}) {
  const tokens = pattern.split('-').map((t) => t.trim().toUpperCase())

  const isConflict = (refereeId, sessionOrder) =>
    conflicts.some(
      (c) => c.referee_id === refereeId && c.session_order === sessionOrder
    )

  function handleDragStart(e, assignment) {
    if (!assignment) return
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(assignment))
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e, targetCourt, targetSession) {
    e.preventDefault()
    try {
      const dragged = JSON.parse(e.dataTransfer.getData('application/json'))
      if (!dragged) return
      if (dragged.court === targetCourt && dragged.session_order === targetSession)
        return
      onSwap?.(dragged, { court: targetCourt, session_order: targetSession })
    } catch {}
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left text-xs font-bold uppercase tracking-wider text-gray-500 py-2 pl-2 min-w-20">
              Court
            </th>
            {tokens.map((t, i) => (
              <th
                key={i}
                className={cn(
                  'text-left text-xs font-bold uppercase tracking-wider py-2 px-2 min-w-32',
                  t === 'PAUSE' ? 'text-amber-400' : 'text-gray-500'
                )}
              >
                {t === 'PAUSE' ? '⏸ Pause' : `M${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {courts.map((court) => (
            <tr key={court} className="border-b border-white/5">
              <td className="py-3 pl-2 min-w-20">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-[#E85D26]" />
                  <span className="font-semibold text-gray-900">{court}</span>
                </div>
              </td>
              {tokens.map((t, i) => {
                const sessionOrder = i + 1
                if (t === 'PAUSE') {
                  return (
                    <td key={i} className="py-3 px-2 min-w-32 text-amber-400/60 italic text-xs">
                      —
                    </td>
                  )
                }
                const a = assignments.find(
                  (x) => x.court === court && x.session_order === sessionOrder
                )
                const ref = a?.referees || refsById[a?.referee_id]
                const ranking = ref ? rankingById[ref.id] : null
                const isLow = ranking?.avg_score != null && ranking.avg_score < 3.0
                const hasConflict = a && isConflict(a.referee_id, sessionOrder)
                return (
                  <td
                    key={i}
                    className="py-2 px-2 min-w-32"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, court, sessionOrder)}
                  >
                    {ref ? (
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => handleDragStart(e, a)}
                        onClick={() => onReassign?.(court, sessionOrder)}
                        className={cn(
                          'w-full text-left px-2 py-1.5 rounded-lg border text-xs transition-colors cursor-grab active:cursor-grabbing',
                          hasConflict
                            ? 'bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/40'
                            : isLow
                            ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/60'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-400'
                        )}
                        title={hasConflict ? 'CONFLICT: same referee on multiple courts this session' : 'Click to edit or drag to move'}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900 truncate">
                            {ref.last_name}
                          </span>
                          {hasConflict && (
                            <AlertTriangle size={11} className="text-amber-400 shrink-0" />
                          )}
                          {!hasConflict && isLow && (
                            <AlertTriangle size={11} className="text-red-400 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {ref.first_name} · Lv.{ref.ranking_level}
                        </div>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onReassign?.(court, sessionOrder)}
                        className="w-full px-2 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors"
                      >
                        + Assign
                      </button>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ManualAssignModal({
  open,
  onClose,
  court,
  sessionOrder,
  presentRefs,
  rankingById,
  currentAssignment,
  onSave,
  onRemove,
  allAssignments
}) {
  const [pauseWarnings, setPauseWarnings] = useState({})

  useEffect(() => {
    const warnings = {}
    for (const r of presentRefs) {
      const result = checkConsecutiveMatches(allAssignments || [], r.id, court, sessionOrder)
      if (result.isViolation) {
        warnings[r.id] = result
      }
    }
    setPauseWarnings(warnings)
  }, [presentRefs, allAssignments, court, sessionOrder])

  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={`${court} — Session ${sessionOrder}`} size="md">
      <div className="space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Select referee</p>
        {Object.keys(pauseWarnings).length > 0 && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-xs text-amber-600 font-medium">⚠️ Pause Alert Active</p>
            <p className="text-xs text-amber-600/80 mt-1">Some referees have 3+ consecutive matches. Consider giving them a break.</p>
          </div>
        )}
        <div className="max-h-96 overflow-y-auto space-y-1.5">
          {presentRefs.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">
              No referees marked as present.
            </p>
          )}
          {presentRefs.map((r) => {
            const ranking = rankingById[r.id]
            const isLow = ranking?.avg_score != null && ranking.avg_score < 3.0
            const isCurrent = currentAssignment?.referee_id === r.id
            const hasWarning = pauseWarnings[r.id]
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSave(r.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
                  hasWarning
                    ? 'bg-amber-500/10 border-amber-500/40'
                    : isCurrent
                    ? 'bg-[#E85D26]/15 border-[#E85D26]/40'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-400'
                )}
              >
                <div className="w-8 h-8 rounded-full bg-[#2D3270]/10 flex items-center justify-center text-xs font-bold text-[#2D3270]">
                  {refereeInitials(r)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {refereeName(r)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Level {r.ranking_level}
                    {ranking?.avg_score != null && ` · avg ${ranking.avg_score.toFixed(1)}`}
                    {ranking?.total_evaluations > 0 && ` · ${ranking.total_evaluations} evals`}
                  </div>
                </div>
                {hasWarning && (
                  <Badge variant="orange" size="xs">
                    <Clock size={9} /> Rest
                  </Badge>
                )}
                {isLow && (
                  <Badge variant="red" size="xs">
                    <AlertTriangle size={9} /> Low
                  </Badge>
                )}
                {isCurrent && <CheckCircle size={16} className="text-[#E85D26]" />}
              </button>
            )
          })}
        </div>
        {currentAssignment && (
          <Button variant="danger" size="md" onClick={onRemove} className="w-full">
            <Trash2 size={14} /> Remove assignment
          </Button>
        )}
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Designations() {
  const [searchParams] = useSearchParams()
  const { tournaments } = useTournaments()

  const [tournamentId, setTournamentId] = useState(
    searchParams.get('tournamentId') || ''
  )
  const [dayNumber, setDayNumber] = useState(1)
  const [sectionNumber, setSectionNumber] = useState(1)

  useEffect(() => {
    if (!tournamentId && tournaments.length > 0) {
      const now = new Date()
      const closest = [...tournaments].sort(
        (a, b) =>
          Math.abs(new Date(a.start_date) - now) -
          Math.abs(new Date(b.start_date) - now)
      )[0]
      if (closest) setTournamentId(closest.id)
    }
  }, [tournaments, tournamentId])

  const tournament = tournaments.find((t) => t.id === tournamentId)
  const { referees: assignedReferees } = useTournamentReferees(tournamentId)
  const { ranking } = useRanking()

  const courts = useMemo(() => {
    if (!tournament) return []
    if (Array.isArray(tournament.courts) && tournament.courts.length > 0) {
      return tournament.courts
    }
    return ['Court 1', 'Court 2', 'Court 3', 'Court 4']
  }, [tournament])

  const sectionsPerDay = useMemo(() => {
    return tournament?.sections_per_day || 1
  }, [tournament])

  const sectionOptions = useMemo(
    () => Array.from({ length: sectionsPerDay }, (_, i) => i + 1),
    [sectionsPerDay]
  )

  const rotationPattern = tournament?.rotation_pattern || 'M1-M2-PAUSE-M3'

  // Attendance
  const [attendanceMap, setAttendanceMap] = useState({})

  const loadAttendance = useCallback(async () => {
    if (!tournamentId) return
    const { data } = await attendanceService.getForTournament(tournamentId)
    const map = {}
    for (const row of data || []) map[row.referee_id] = row.attendance || {}
    setAttendanceMap(map)
  }, [tournamentId])

  useEffect(() => { loadAttendance() }, [loadAttendance])

  const isPresent = (refId) => Boolean(attendanceMap[refId]?.[String(dayNumber)])

  const presentRefs = useMemo(
    () => assignedReferees.filter((r) => isPresent(r.id)),
    [assignedReferees, attendanceMap, dayNumber] // eslint-disable-line
  )

  async function togglePresence(refId) {
    const current = isPresent(refId)
    await attendanceService.setPresent(tournamentId, refId, dayNumber, !current)
    setAttendanceMap((prev) => {
      const refAtt = { ...(prev[refId] || {}) }
      const k = String(dayNumber)
      if (current) delete refAtt[k]
      else refAtt[k] = new Date().toISOString()
      return { ...prev, [refId]: refAtt }
    })
  }

  // Assignments
  const [assignments, setAssignments] = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)

  const loadAssignments = useCallback(async () => {
    if (!tournamentId) return
    setLoadingAssignments(true)
    const { data } = await supabase
      .from('court_assignments')
      .select('*, referees(*)')
      .eq('tournament_id', tournamentId)
      .eq('day_number', dayNumber)
      .eq('section_number', sectionNumber)
      .order('court')
      .order('session_order')
    setAssignments(data || [])
    setLoadingAssignments(false)
  }, [tournamentId, dayNumber, sectionNumber])

  useEffect(() => { loadAssignments() }, [loadAssignments])

  const rankingById = useMemo(() => {
    const m = {}
    for (const r of ranking) m[r.id] = r
    return m
  }, [ranking])

  const refsById = useMemo(() => {
    const m = {}
    for (const r of assignedReferees) m[r.id] = r
    return m
  }, [assignedReferees])

  const riskyAssigned = useMemo(() => {
    const risky = []
    for (const a of assignments) {
      const rk = rankingById[a.referee_id]
      if (rk?.avg_score != null && rk.avg_score < 3.0) {
        risky.push({ ...a, ranking: rk })
      }
    }
    return risky
  }, [assignments, rankingById])

  // Conflict detection: same referee on multiple courts in the same session
  const conflicts = useMemo(() => {
    const bySession = {}
    for (const a of assignments) {
      const key = `${a.referee_id}|${a.session_order}`
      if (!bySession[key]) bySession[key] = []
      bySession[key].push(a)
    }
    const out = []
    for (const arr of Object.values(bySession)) {
      if (arr.length > 1) out.push(...arr)
    }
    return out
  }, [assignments])

  // Trigger alert records (best-effort, ignore duplicates)
  useEffect(() => {
    if (!tournamentId || riskyAssigned.length === 0) return
    const seen = new Set()
    for (const r of riskyAssigned) {
      const key = `${r.referee_id}|${tournamentId}`
      if (seen.has(key)) continue
      seen.add(key)
      alertService
        .create({
          referee_id: r.referee_id,
          tournament_id: tournamentId,
          triggered_avg: r.ranking.avg_score,
          notes: `Designated to ${r.court} M${r.session_order} despite avg ${r.ranking.avg_score.toFixed(1)}`,
        })
        .catch(() => {})
    }
  }, [riskyAssigned.length, tournamentId]) // eslint-disable-line

  // Auto-assign
  const [autoAssigning, setAutoAssigning] = useState(false)
  async function handleAutoAssign() {
    if (presentRefs.length === 0) {
      toast.error('Mark referees as present first')
      return
    }
    setAutoAssigning(true)
    try {
      await supabase
        .from('court_assignments')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('day_number', dayNumber)
        .eq('section_number', sectionNumber)
      const { assignments: newAssign, warnings } = autoAssign({
        presentReferees: presentRefs,
        courts,
        pattern: rotationPattern,
      })
      const rows = newAssign.map((a) => ({
        tournament_id: tournamentId,
        referee_id: a.referee_id,
        day_number: dayNumber,
        section_number: sectionNumber,
        court: a.court,
        session_order: a.session_order,
        role: a.role,
      }))
      if (rows.length > 0) await supabase.from('court_assignments').insert(rows)
      warnings.forEach((w) => toast(w, 'info', 4000))
      toast.success(`✅ ${rows.length} assignments created`)
      await loadAssignments()
    } catch (err) {
      console.error(err)
      toast.error('Auto-assign failed')
    } finally {
      setAutoAssigning(false)
    }
  }

  // Manual assign modal
  const [modalState, setModalState] = useState(null)

  async function handleReassign(refereeId) {
    if (!modalState) return
    const existing = assignments.find(
      (a) => a.court === modalState.court && a.session_order === modalState.sessionOrder
    )
    try {
      if (existing) {
        await supabase
          .from('court_assignments')
          .update({ referee_id: refereeId })
          .eq('id', existing.id)
      } else {
        await supabase.from('court_assignments').insert({
          tournament_id: tournamentId,
          referee_id: refereeId,
          day_number: dayNumber,
          section_number: sectionNumber,
          court: modalState.court,
          session_order: modalState.sessionOrder,
          role: 'R1',
        })
      }
      setModalState(null)
      await loadAssignments()
      toast.success('Updated')
    } catch (err) {
      console.error(err)
      toast.error('Update failed')
    }
  }

  // Drag-and-drop swap (or move into empty slot)
  async function handleSwap(dragged, target) {
    const targetAssignment = assignments.find(
      (a) => a.court === target.court && a.session_order === target.session_order
    )
    try {
      if (targetAssignment) {
        // Swap: dragged → target.position, target → dragged.position
        await courtAssignmentService.update(dragged.id, {
          court: target.court,
          session_order: target.session_order,
        })
        await courtAssignmentService.update(targetAssignment.id, {
          court: dragged.court,
          session_order: dragged.session_order,
        })
        toast.success('Swapped')
      } else {
        // Move: dragged → empty slot
        await courtAssignmentService.update(dragged.id, {
          court: target.court,
          session_order: target.session_order,
        })
        toast.success('Moved')
      }
      await loadAssignments()
    } catch (err) {
      console.error(err)
      toast.error('Move failed — possibly duplicate constraint')
    }
  }

  async function handleRemove() {
    if (!modalState) return
    const existing = assignments.find(
      (a) => a.court === modalState.court && a.session_order === modalState.sessionOrder
    )
    if (existing) {
      await courtAssignmentService.delete(existing.id)
      await loadAssignments()
      toast('Removed', 'info')
    }
    setModalState(null)
  }

  async function handleClear() {
    if (!confirm(`Clear ALL assignments for this section (Day ${dayNumber}, Section ${sectionNumber})?`)) return
    await supabase
      .from('court_assignments')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('day_number', dayNumber)
      .eq('section_number', sectionNumber)
    await loadAssignments()
    toast('Cleared', 'info')
  }

  // Share actions
  const [hasSentBefore, setHasSentBefore] = useState(false)

  function handleWhatsApp() {
    if (assignments.length === 0) {
      toast.error('No assignments to share')
      return
    }
    const msg = buildDesignationMessage({
      tournament,
      dayNumber,
      assignments,
      isUpdate: hasSentBefore,
      rotationPattern,
    })
    shareToWhatsApp(msg)
    setHasSentBefore(true)
    toast.success('WhatsApp opened')
  }

  async function handleCopy() {
    if (assignments.length === 0) return
    const msg = buildDesignationMessage({
      tournament,
      dayNumber,
      assignments,
      isUpdate: hasSentBefore,
      rotationPattern,
    })
    const ok = await copyDesignationMessage(msg)
    if (ok) toast.success('Copied to clipboard')
    else toast.error('Copy failed')
  }

  // Personal DM per referee
  function handlePersonalDM(referee) {
    const msg = buildPersonalMessage({
      referee,
      tournament,
      dayNumber,
      assignments,
    })
    if (referee.phone) {
      // Open with specific phone number
      const phone = referee.phone.replace(/[^0-9+]/g, '').replace(/^\+/, '')
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      // No phone — generic share
      shareToWhatsApp(msg)
    }
  }

  // History view
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyData, setHistoryData] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  async function openHistory() {
    if (!tournamentId) return
    setHistoryOpen(true)
    setHistoryLoading(true)
    // Load all assignments for this tournament across all days
    try {
      const { data } = await supabase
        .from('court_assignments')
        .select('*, referees(*)')
        .eq('tournament_id', tournamentId)
        .order('day_number')
        .order('court')
        .order('session_order')
      setHistoryData(data || [])
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handlePDF() {
    if (assignments.length === 0) {
      toast.error('No assignments — generate them first')
      return
    }
    try {
      const blob = await generateDesignationPDF({
        tournament,
        dayNumber,
        assignments,
        rotationPattern,
      })
      const filename = `BVB_Designations_${tournament?.name.replace(/\s+/g, '_')}_Day${dayNumber}_${new Date().toISOString().slice(0, 10)}.pdf`
      downloadPDF(blob, filename)
      toast.success('PDF downloaded')
    } catch (err) {
      console.error(err)
      toast.error('PDF generation failed')
    }
  }

  const dayOptions = useMemo(() => {
    if (!tournament) return [1]
    const days =
      Math.ceil(
        (new Date(tournament.end_date) - new Date(tournament.start_date)) / 86400000
      ) + 1
    return Array.from({ length: Math.max(1, days) }, (_, i) => i + 1)
  }, [tournament])

  // Config modal
  const [configOpen, setConfigOpen] = useState(false)
  const [configCourts, setConfigCourts] = useState([])
  const [configPattern, setConfigPattern] = useState('')
  const [configSectionsPerDay, setConfigSectionsPerDay] = useState(1)
  const [configMatchesInput, setConfigMatchesInput] = useState(1)

  function openConfig() {
    setConfigCourts(courts)
    setConfigPattern(rotationPattern)
    setConfigSectionsPerDay(sectionsPerDay)
    const matchCount = rotationPattern.split('-').filter((t) => t.toUpperCase() !== 'PAUSE').length
    setConfigMatchesInput(matchCount)
    setConfigOpen(true)
  }

  async function saveConfig() {
    await tournamentService.update(tournamentId, {
      courts: configCourts,
      rotation_pattern: configPattern,
      sections_per_day: configSectionsPerDay,
    })
    setConfigOpen(false)
    toast.success('Config saved — reloading')
    setTimeout(() => window.location.reload(), 500)
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Assignments"
        subtitle={
          tournament
            ? `${tournament.name} — Day ${dayNumber}${sectionsPerDay > 1 ? ` · Section ${sectionNumber}/${sectionsPerDay}` : ''}`
            : 'Select a tournament to begin'
        }
        actions={
          <Button variant="ghost" size="sm" onClick={openConfig} disabled={!tournament}>
            ⚙ Config
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-6xl mx-auto w-full">
        {/* Tournament + Day + Section selector */}
        <Card>
          <CardBody className="space-y-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Day"
                value={dayNumber}
                onChange={(e) => setDayNumber(Number(e.target.value))}
              >
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    Day {d}
                  </option>
                ))}
              </Select>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-600">Section (Time Slot)</label>
                <div className="flex gap-2 flex-wrap">
                  {sectionOptions.map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setSectionNumber(sec)}
                      className={cn(
                        'flex-1 min-w-20 py-2 px-3 rounded-lg border font-medium text-sm transition-all',
                        sectionNumber === sec
                          ? 'bg-[#E85D26]/15 border-[#E85D26]/40 text-[#E85D26]'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-400'
                      )}
                    >
                      <Clock size={14} className="inline mr-1" />
                      Part {sec}
                    </button>
                  ))}
                  {sectionsPerDay < 6 && (
                    <button
                      type="button"
                      onClick={openConfig}
                      title="Add a new round/section"
                      className="py-2 px-3 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 hover:border-emerald-500/60 hover:bg-emerald-500/10 text-emerald-600 font-medium text-sm transition-all"
                    >
                      <Plus size={14} /> Add Round
                    </button>
                  )}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Conflict banner */}
        {conflicts.length > 0 && (
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardBody className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-amber-400 mb-1">
                  ⚠ Double-booking detected
                </p>
                <p className="text-xs text-amber-300/80">
                  {Array.from(new Set(conflicts.map((c) => c.referee_id))).length} referee(s)
                  assigned to multiple courts in the same session. Drag to swap, or click to re-assign.
                </p>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Risk alert banner */}
        {riskyAssigned.length > 0 && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardBody className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-red-400 mb-1">
                  ⚠ Low-feedback referees designated
                </p>
                <ul className="space-y-0.5 text-red-300/80 text-xs">
                  {riskyAssigned.slice(0, 5).map((r) => {
                    const ref = refsById[r.referee_id]
                    return (
                      <li key={r.id}>
                        • {ref ? refereeName(ref) : '—'} → {r.court} M{r.session_order} (avg{' '}
                        {r.ranking.avg_score.toFixed(1)})
                      </li>
                    )
                  })}
                </ul>
                <p className="text-xs text-red-300/60 mt-2 italic">
                  Consider re-assigning or providing extra mentoring.
                </p>
              </div>
            </CardBody>
          </Card>
        )}

        {tournament && (
          <>
            {/* Check-in */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[#E85D26]" />
                  <CardTitle>
                    Check-in ({presentRefs.length} / {assignedReferees.length})
                  </CardTitle>
                </div>
                <span className="text-xs text-gray-500">Tap to mark present</span>
              </CardHeader>
              <CardBody>
                {assignedReferees.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No referees assigned to this tournament.{' '}
                    <a
                      href={`/tournaments/${tournamentId}`}
                      className="text-[#E85D26] hover:underline"
                    >
                      Assign referees →
                    </a>
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {assignedReferees.map((r) => (
                      <RefereeChip
                        key={r.id}
                        referee={r}
                        present={isPresent(r.id)}
                        onToggle={() => togglePresence(r.id)}
                        riskScore={rankingById[r.id]?.avg_score}
                      />
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Assignment grid */}
            <Card>
              <CardHeader className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-[#E85D26]" />
                  <CardTitle>Court Assignments</CardTitle>
                  <Badge variant="navy" size="xs">{rotationPattern}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAutoAssign}
                    loading={autoAssigning}
                    disabled={presentRefs.length === 0}
                  >
                    <RotateCw size={14} /> Auto-assign
                  </Button>
                  {assignments.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleClear}>
                      <Trash2 size={14} /> Clear
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                {loadingAssignments ? (
                  <p className="text-center text-gray-500 py-6 text-sm">Loading…</p>
                ) : (
                  <CourtSessionGrid
                    courts={courts}
                    assignments={assignments}
                    pattern={rotationPattern}
                    refsById={refsById}
                    rankingById={rankingById}
                    conflicts={conflicts}
                    onReassign={(court, sessionOrder) =>
                      setModalState({ court, sessionOrder })
                    }
                    onSwap={handleSwap}
                  />
                )}
              </CardBody>
            </Card>

            {/* Share & Export */}
            <Card>
              <CardHeader>
                <CardTitle>Share & Export</CardTitle>
              </CardHeader>
              <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button
                  variant="success"
                  size="md"
                  onClick={handleWhatsApp}
                  disabled={assignments.length === 0}
                  className="w-full"
                >
                  <MessageCircle size={16} />
                  {hasSentBefore ? 'Re-send via WhatsApp' : 'Send via WhatsApp'}
                </Button>
                <Button
                  variant="navy"
                  size="md"
                  onClick={handleCopy}
                  disabled={assignments.length === 0}
                  className="w-full"
                >
                  <Copy size={16} /> Copy text
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={handlePDF}
                  disabled={assignments.length === 0}
                  className="w-full"
                >
                  <Download size={16} /> Download PDF
                </Button>
              </CardBody>
            </Card>

            {/* Personal DMs to referees */}
            {assignments.length > 0 && (
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>Personal Messages</CardTitle>
                  <span className="text-xs text-gray-500">
                    Send individual assignments via WhatsApp
                  </span>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.from(
                      new Set(assignments.map((a) => a.referee_id))
                    ).map((refId) => {
                      const ref = refsById[refId]
                      if (!ref) return null
                      const refAssignments = assignments
                        .filter((a) => a.referee_id === refId)
                        .sort((a, b) => a.session_order - b.session_order)
                      return (
                        <button
                          key={refId}
                          type="button"
                          onClick={() => handlePersonalDM(ref)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#2D3270]/10 flex items-center justify-center text-xs font-bold text-[#2D3270] shrink-0">
                            {refereeInitials(ref)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {refereeName(ref)}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {refAssignments
                                .map((a) => `M${a.session_order}→${a.court.replace('Court ', 'C')}`)
                                .join(' · ')}
                            </div>
                          </div>
                          <MessageCircle size={14} className="text-emerald-400 shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-3 italic">
                    Tip: Add phone numbers to referee profiles to open WhatsApp directly with the contact.
                  </p>
                </CardBody>
              </Card>
            )}

            {/* History view */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>History</CardTitle>
                <Button variant="ghost" size="sm" onClick={openHistory}>
                  View all days →
                </Button>
              </CardHeader>
              <CardBody>
                <p className="text-xs text-gray-500">
                  See all past assignments for {tournament.name} across the {dayOptions.length} day(s) of the tournament.
                </p>
              </CardBody>
            </Card>
          </>
        )}
      </div>

      {/* History modal */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={`${tournament?.name || ''} — Full History`} size="xl">
        {historyLoading ? (
          <p className="text-center text-gray-500 py-6 text-sm">Loading…</p>
        ) : historyData.length === 0 ? (
          <p className="text-center text-gray-500 py-6 text-sm">
            No historical assignments for this tournament yet.
          </p>
        ) : (
          <div className="space-y-4">
            {Array.from(new Set(historyData.map((h) => h.day_number))).sort((a, b) => a - b).map((d) => {
              const dayRows = historyData.filter((h) => h.day_number === d)
              const dayCourts = Array.from(new Set(dayRows.map((r) => r.court))).sort()
              return (
                <div key={d}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="orange" size="md">Day {d}</Badge>
                    <span className="text-xs text-gray-500">{dayRows.length} assignments</span>
                  </div>
                  <div className="space-y-1">
                    {dayCourts.map((court) => {
                      const sessions = dayRows
                        .filter((r) => r.court === court)
                        .sort((a, b) => a.session_order - b.session_order)
                      return (
                        <div
                          key={court}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs"
                        >
                          <MapPin size={11} className="text-[#E85D26]" />
                          <span className="font-semibold text-gray-900 w-20">{court}</span>
                          <span className="flex-1 text-gray-700">
                            {sessions
                              .map(
                                (s) =>
                                  `M${s.session_order}: ${
                                    s.referees ? refereeName(s.referees) : '—'
                                  }`
                              )
                              .join(' · ')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>

      <ManualAssignModal
        open={!!modalState}
        onClose={() => setModalState(null)}
        court={modalState?.court}
        sessionOrder={modalState?.sessionOrder}
        presentRefs={presentRefs}
        rankingById={rankingById}
        allAssignments={assignments}
        currentAssignment={
          modalState
            ? assignments.find(
                (a) =>
                  a.court === modalState.court &&
                  a.session_order === modalState.sessionOrder
              )
            : null
        }
        onSave={handleReassign}
        onRemove={handleRemove}
      />

      <Modal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Tournament Configuration"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 block">
              Sections per day
            </label>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={configSectionsPerDay}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val)) {
                      setConfigSectionsPerDay(Math.max(1, Math.min(6, val)));
                    }
                  }}
                  onBlur={() => {
                    if (!configSectionsPerDay || isNaN(configSectionsPerDay)) {
                      setConfigSectionsPerDay(1);
                    }
                  }}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <button
                type="button"
                onClick={() => setConfigSectionsPerDay(Math.min(6, configSectionsPerDay + 1))}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 hover:bg-emerald-500/10 hover:border-emerald-500/40 text-xs font-medium text-gray-600"
              >
                <Plus size={14} /> Add
              </button>
              {configSectionsPerDay > 1 && (
                <button
                  type="button"
                  onClick={() => setConfigSectionsPerDay(Math.max(1, configSectionsPerDay - 1))}
                  className="px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 hover:bg-red-500/10 hover:border-red-500/40 text-xs font-medium text-gray-600"
                >
                  <Minus size={14} />
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Set how many time slots (primo tempo, secondo tempo, etc.) exist for each day
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Courts
            </p>
            <div className="space-y-2">
              {configCourts.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={c}
                    onChange={(e) => {
                      const copy = [...configCourts]
                      copy[i] = e.target.value
                      setConfigCourts(copy)
                    }}
                    className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setConfigCourts(configCourts.filter((_, j) => j !== i))
                    }
                    className="p-2 rounded-lg hover:bg-red-500/20 text-red-400"
                  >
                    <Minus size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setConfigCourts([
                    ...configCourts,
                    `Court ${configCourts.length + 1}`,
                  ])
                }
                className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
              >
                <Plus size={12} className="inline mr-1" /> Add court
              </button>
            </div>
          </div>

          <Select
            label="Rotation pattern (preset)"
            value={configPattern}
            onChange={(e) => setConfigPattern(e.target.value)}
          >
            {ROTATION_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.value} — {p.label}
              </option>
            ))}
            <option value="__custom__">Custom — enter manually below</option>
          </Select>

          {/* Custom pattern editor — series of N matches with optional pauses */}
          <div className="space-y-2 p-3 rounded-xl border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Custom pattern editor
              </label>
              <span className="text-[10px] text-gray-500">
                Build series of matches manually
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Number of matches per court:</label>
              <input
                type="number"
                min="1"
                max="20"
                value={configMatchesInput}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  if (!isNaN(val)) {
                    const n = Math.max(1, Math.min(20, val))
                    setConfigMatchesInput(n)
                    // Build pattern: M1, M2, PAUSE, M3, M4, PAUSE, M5...
                    const tokens = []
                    for (let i = 1; i <= n; i++) {
                      tokens.push(`M${i}`)
                      if (i % 2 === 0 && i < n) tokens.push('PAUSE')
                    }
                    setConfigPattern(tokens.join('-'))
                  }
                }}
                onBlur={() => {
                  if (!configMatchesInput || isNaN(configMatchesInput)) {
                    setConfigMatchesInput(1)
                  }
                }}
                className="w-16 bg-white border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-900 text-center"
              />
              <span className="text-xs text-gray-500">+ pause every 2 matches</span>
            </div>
            <input
              type="text"
              value={configPattern}
              onChange={(e) => setConfigPattern(e.target.value.toUpperCase())}
              placeholder="e.g. M1-M2-PAUSE-M3-M4-M5-PAUSE-M6"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-900"
            />
            <p className="text-[10px] text-gray-500 leading-snug">
              Tokens: <code>M1</code>, <code>M2</code>… (matches) and <code>PAUSE</code>. The pattern
              applies to every court. Each token is one session order.
            </p>
          </div>

          <Button variant="primary" size="md" onClick={saveConfig} className="w-full">
            Save configuration
          </Button>
        </div>
      </Modal>
    </div>
  )
}
