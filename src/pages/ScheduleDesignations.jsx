import { useState, useEffect, useMemo, useCallback } from 'react'
import { CalendarRange, Wand2, MessageCircle, Trophy, AlertTriangle, Users } from 'lucide-react'

import { Header } from '../components/layout/Header'
import { toast } from '../components/ui/Toast'

import { useTournaments } from '../hooks/useTournaments'
import { useTournamentRanking } from '../hooks/useRanking'
import { matchService, attendanceService, designationService } from '../lib/supabase'
import { trackSave } from '../lib/saveTracker'
import { autoAssignSchedule, findSlotConflicts } from '../lib/scheduleAssign'
import { shareScheduleGeneral, shareRefereeSchedule } from '../lib/whatsapp'
import { refereeName } from '../lib/utils'

const NAVY = '#2D3270'
const ORANGE = '#E85D26'
const SECTION = 1

function serShort(m) { return m.series === 'PRO' ? 'PRO' : 'CH' }
function genLabel(m) { return m.gender === 'M' ? 'Heren' : 'Dames' }
function matchTag(m) { return `${serShort(m)} ${genLabel(m)} ${m.round || ''}`.trim() }
function hhmm(t) {
  if (!t) return '—'
  try { return new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }) }
  catch { return String(t).slice(11, 16) }
}
function byTime(a, b) {
  const ta = a.scheduled_time || '', tb = b.scheduled_time || ''
  if (ta !== tb) return ta < tb ? -1 : 1
  return (a.match_number || 0) - (b.match_number || 0)
}

export default function ScheduleDesignations() {
  const { tournaments } = useTournaments()
  const [tournamentId, setTournamentId] = useState('')
  useEffect(() => { if (!tournamentId && tournaments[0]) setTournamentId(tournaments[0].id) }, [tournaments]) // eslint-disable-line
  const tournament = tournaments.find((t) => t.id === tournamentId)
  const { ranking } = useTournamentRanking(tournamentId)

  // ── Matches ────────────────────────────────────────────────────────────────
  const [allMatches, setAllMatches] = useState([])
  const [loadingM, setLoadingM] = useState(false)
  const loadMatches = useCallback(async () => {
    if (!tournamentId) { setAllMatches([]); return }
    setLoadingM(true)
    const { data } = await matchService.getByTournament(tournamentId)
    setAllMatches(data || [])
    setLoadingM(false)
  }, [tournamentId])
  useEffect(() => { loadMatches() }, [loadMatches])

  const days = useMemo(
    () => [...new Set(allMatches.map((m) => m.day_number || 1))].sort((a, b) => a - b),
    [allMatches]
  )
  const [day, setDay] = useState(null)
  useEffect(() => { if (days.length && !days.includes(day)) setDay(days[days.length - 1]) }, [days]) // eslint-disable-line

  const matches = useMemo(
    () => allMatches.filter((m) => (m.day_number || 1) === day).sort(byTime),
    [allMatches, day]
  )

  // ── Referees + presence ──────────────────────────────────────────────────────
  const [attRows, setAttRows] = useState([])
  const loadAtt = useCallback(async () => {
    if (!tournamentId) { setAttRows([]); return }
    const { data } = await attendanceService.getForTournament(tournamentId)
    setAttRows(data || [])
  }, [tournamentId])
  useEffect(() => { loadAtt() }, [loadAtt])

  const allRefs = useMemo(() => attRows.map((r) => r.referees).filter(Boolean), [attRows])
  const presentRefs = useMemo(() => {
    const key = `${day}_${SECTION}`
    return attRows.filter((r) => r.attendance?.[key]).map((r) => r.referees).filter(Boolean)
  }, [attRows, day])
  const usingPresent = presentRefs.length > 0
  const roster = usingPresent ? presentRefs : allRefs

  const avgById = useMemo(() => {
    const m = {}; (ranking || []).forEach((r) => { m[r.id] = r.avg_score ?? -1 }); return m
  }, [ranking])
  const rankedRoster = useMemo(
    () => [...roster].sort((a, b) => (avgById[b.id] ?? -1) - (avgById[a.id] ?? -1) || refereeName(a).localeCompare(refereeName(b))),
    [roster, avgById]
  )
  const refById = useMemo(() => { const m = {}; allRefs.forEach((r) => { m[r.id] = r }); return m }, [allRefs])
  const rosterByName = useMemo(() => [...roster].sort((a, b) => refereeName(a).localeCompare(refereeName(b))), [roster])

  // ── Existing designations ────────────────────────────────────────────────────
  const [assignMap, setAssignMap] = useState({})
  const loadDes = useCallback(async () => {
    if (!tournamentId) { setAssignMap({}); return }
    const { data } = await designationService.getByTournament(tournamentId)
    const m = {}; (data || []).forEach((d) => { if (d.role === 'R1' && d.match_id) m[d.match_id] = d.referee_id })
    setAssignMap(m)
  }, [tournamentId])
  useEffect(() => { loadDes() }, [loadDes])

  const conflicts = useMemo(() => findSlotConflicts(matches, assignMap), [matches, assignMap])
  const workload = useMemo(() => {
    const w = {}; matches.forEach((m) => { const r = assignMap[m.id]; if (r) w[r] = (w[r] || 0) + 1 }); return w
  }, [matches, assignMap])
  const refNameById = useMemo(() => {
    const m = {}; matches.forEach((mt) => { const r = assignMap[mt.id]; if (r && refById[r]) m[mt.id] = refereeName(refById[r]) }); return m
  }, [matches, assignMap, refById])

  // ── Actions ──────────────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false)
  async function generate() {
    if (!matches.length) { toast.error('Nessuna partita per questa giornata — carica prima il calendario'); return }
    if (!rankedRoster.length) { toast.error('Nessun arbitro disponibile'); return }
    setBusy(true)
    try {
      const a = autoAssignSchedule(matches, rankedRoster)
      const rows = matches.filter((m) => a[m.id]).map((m) => ({ match_id: m.id, referee_id: a[m.id], role: 'R1' }))
      await trackSave(() => Promise.all(rows.map((row) => designationService.upsert(row))))
      setAssignMap(a)
      toast.success(`Designazioni generate (${rows.length} partite)`)
    } catch (e) { toast.error('Errore: ' + (e?.message || '')) } finally { setBusy(false) }
  }

  async function setRef(matchId, refId) {
    const prev = assignMap[matchId]
    setAssignMap((m) => ({ ...m, [matchId]: refId || undefined }))
    try {
      if (refId) await trackSave(() => designationService.upsert({ match_id: matchId, referee_id: refId, role: 'R1' }))
    } catch (e) {
      setAssignMap((m) => ({ ...m, [matchId]: prev }))
      toast.error('Errore salvataggio: ' + (e?.message || ''))
    }
  }

  function sendGeneral() {
    if (!matches.length) return
    shareScheduleGeneral({ tournamentName: tournament?.name, dayLabel: `Day ${day}`, matches, refNameById })
  }
  function sendIndividual(ref) {
    const mine = matches.filter((m) => assignMap[m.id] === ref.id).sort(byTime)
    if (!mine.length) { toast.error('Nessuna partita per questo arbitro'); return }
    shareRefereeSchedule({ referee: ref, tournamentName: tournament?.name, dayLabel: `Day ${day}`, matches: mine })
  }

  // ── Render helpers ────────────────────────────────────────────────────────────
  const slots = useMemo(() => {
    const out = []; let curr = null
    for (const m of matches) {
      const t = m.scheduled_time || ''
      if (t !== curr) { curr = t; out.push({ time: m.scheduled_time, items: [] }) }
      out[out.length - 1].items.push(m)
    }
    return out
  }, [matches])

  const refsWithMatches = useMemo(
    () => rosterByName.filter((r) => matches.some((m) => assignMap[m.id] === r.id)),
    [rosterByName, matches, assignMap]
  )

  return (
    <div className="flex flex-col h-full">
      <Header title="Schedule Designations" subtitle={tournament?.name} />

      <div className="flex-1 overflow-y-auto pb-28">
        {/* Selectors */}
        <div style={{ background: `linear-gradient(135deg, ${NAVY}, #1f2350)` }} className="text-white px-4 pt-3 pb-3">
          <div className="flex gap-2">
            <select
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white"
            >
              {tournaments.map((t) => <option key={t.id} value={t.id} className="text-gray-900">{t.name}</option>)}
            </select>
            <select
              value={day ?? ''}
              onChange={(e) => setDay(Number(e.target.value))}
              className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white"
            >
              {days.map((d) => <option key={d} value={d} className="text-gray-900">Day {d}</option>)}
            </select>
          </div>
          <div className="mt-2 text-xs text-white/70 flex items-center gap-1.5">
            <Users size={12} /> {roster.length} arbitri {usingPresent ? 'presenti' : '(tutti — presenza non impostata)'} · {matches.length} partite
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={generate}
              disabled={busy || !matches.length || !rankedRoster.length}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: ORANGE }}
            >
              <Wand2 size={16} /> {busy ? 'Genero…' : 'Genera designazioni'}
            </button>
            <button
              onClick={sendGeneral}
              disabled={!matches.length}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border border-gray-300 text-gray-700 disabled:opacity-50"
            >
              <MessageCircle size={16} /> WhatsApp generale
            </button>
          </div>

          {conflicts.size > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle size={16} /> {conflicts.size} conflitto/i: stesso arbitro su due campi nella stessa fascia. Correggi dai menù in rosso.
            </div>
          )}

          {!matches.length && (
            <div className="text-sm text-gray-500 p-4 rounded-xl bg-gray-50 border border-gray-200">
              {loadingM ? 'Carico…' : 'Nessuna partita per questa giornata. Carica il calendario nella tabella matches.'}
            </div>
          )}

          {/* Matches grouped by time slot */}
          {slots.map((slot) => (
            <div key={slot.time}>
              <div className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-1.5">{hhmm(slot.time)}</div>
              <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {slot.items.map((m) => {
                  const conflict = conflicts.has(m.id)
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                          {m.is_final && <Trophy size={13} style={{ color: ORANGE }} />}
                          C{m.court} · #{m.match_number} <span className="text-gray-500 font-normal">{matchTag(m)}</span>
                        </div>
                        <div className="text-xs text-gray-400 truncate">{m.team1} vs {m.team2}</div>
                      </div>
                      <select
                        value={assignMap[m.id] || ''}
                        onChange={(e) => setRef(m.id, e.target.value)}
                        className={`shrink-0 w-36 rounded-lg border px-2 py-1.5 text-sm ${conflict ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-300'}`}
                      >
                        <option value="">— arbitro —</option>
                        {rosterByName.map((r) => <option key={r.id} value={r.id}>{refereeName(r)}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Workload */}
          {refsWithMatches.length > 0 && (
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-1.5">Workload + WhatsApp individuale</div>
              <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {refsWithMatches.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3">
                    <span className="flex-1 text-sm font-semibold text-gray-900 truncate">{refereeName(r)}</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: NAVY }}>{workload[r.id] || 0}</span>
                    <button
                      onClick={() => sendIndividual(r)}
                      className="inline-flex items-center gap-1 text-xs font-bold rounded-lg border border-gray-300 px-2.5 py-1.5 text-gray-700 hover:bg-gray-100"
                    >
                      <MessageCircle size={12} /> WhatsApp
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
