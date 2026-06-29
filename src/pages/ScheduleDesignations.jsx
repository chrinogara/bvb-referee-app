import { useState, useEffect, useMemo, useCallback } from 'react'
import { CalendarRange, Wand2, MessageCircle, Trophy, AlertTriangle, Users, RotateCcw, Send } from 'lucide-react'

import { Header } from '../components/layout/Header'
import { toast } from '../components/ui/Toast'

import { useTournaments } from '../hooks/useTournaments'
import { useTournamentRanking } from '../hooks/useRanking'
import { matchService, attendanceService, designationService } from '../lib/supabase'
import { trackSave } from '../lib/saveTracker'
import { autoAssignSchedule, autoAssignSlot, findSlotConflicts, needsTwoRefs } from '../lib/scheduleAssign'
import { ensureWolvertemReferees, loadWolvertemMatches, computeWolvertemRefCount } from '../lib/wolvertemSetup'
import { shareScheduleGeneral, shareSlotSchedule, shareRefereeSchedule, shareSlotScheduleToPhone } from '../lib/whatsapp'
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

// Tournament manager phone (per tournament, saved on device)
function managerKey(tid) { return `bvbManagerPhone:${tid}` }
function getManagerPhone(tid) { try { return (tid && localStorage.getItem(managerKey(tid))) || '' } catch { return '' } }
function setManagerPhoneLS(tid, v) { try { localStorage.setItem(managerKey(tid), v || '') } catch { /* ignore */ } }

export default function ScheduleDesignations() {
  const { tournaments } = useTournaments()
  const [tournamentId, setTournamentId] = useState('')
  useEffect(() => { if (!tournamentId && tournaments[0]) setTournamentId(tournaments[0].id) }, [tournaments]) // eslint-disable-line
  const tournament = tournaments.find((t) => t.id === tournamentId)
  const { ranking } = useTournamentRanking(tournamentId)
  const [managerPhone, setManagerPhone] = useState('')
  useEffect(() => { setManagerPhone(getManagerPhone(tournamentId)) }, [tournamentId])

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

  const matches = useMemo(() => {
    const wolv = /wolvertem/i.test(tournament?.name || '')
    return allMatches
      .filter((m) => (m.day_number || 1) === day)
      .map((m) => (m.referees_needed != null ? m : (wolv ? { ...m, referees_needed: computeWolvertemRefCount(m) } : m)))
      .sort(byTime)
  }, [allMatches, day, tournament])
  const dayNeedsRefs = useMemo(() => matches.some((m) => m.referees_needed !== 0), [matches])

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
  const isWolvertem = /wolvertem/i.test(tournament?.name || '')
  const needsSetup = isWolvertem && (allRefs.length < 6 || allMatches.length === 0)

  const avgById = useMemo(() => {
    const m = {}; (ranking || []).forEach((r) => { m[r.id] = r.avg_score ?? -1 }); return m
  }, [ranking])
  const rankInfo = useMemo(() => {
    const m = {}; (ranking || []).forEach((r) => { m[r.id] = { avg: r.avg_score, count: r.total_evaluations || 0 } }); return m
  }, [ranking])
  const rankedRoster = useMemo(
    () => [...roster].sort((a, b) => (avgById[b.id] ?? -1) - (avgById[a.id] ?? -1) || refereeName(a).localeCompare(refereeName(b))),
    [roster, avgById]
  )
  const refById = useMemo(() => { const m = {}; allRefs.forEach((r) => { m[r.id] = r }); return m }, [allRefs])
  const rosterByName = useMemo(() => [...roster].sort((a, b) => refereeName(a).localeCompare(refereeName(b))), [roster])

  // ── Existing designations ────────────────────────────────────────────────────
  const [assignMap, setAssignMap] = useState({})
  const [assignR2, setAssignR2] = useState({})
  const loadDes = useCallback(async () => {
    if (!tournamentId) { setAssignMap({}); setAssignR2({}); return }
    const { data } = await designationService.getByTournament(tournamentId)
    const m = {}, m2 = {}
    ;(data || []).forEach((d) => {
      if (!d.match_id) return
      if (d.role === 'R2') m2[d.match_id] = d.referee_id
      else m[d.match_id] = d.referee_id
    })
    setAssignMap(m); setAssignR2(m2)
  }, [tournamentId])
  useEffect(() => { loadDes() }, [loadDes])

  const conflicts = useMemo(() => findSlotConflicts(matches, assignMap), [matches, assignMap])
  const workload = useMemo(() => {
    const w = {}
    matches.forEach((m) => {
      const r1 = assignMap[m.id]; if (r1) w[r1] = (w[r1] || 0) + 1
      const r2 = assignR2[m.id]; if (r2) w[r2] = (w[r2] || 0) + 1
    })
    return w
  }, [matches, assignMap, assignR2])
  const refNameById = useMemo(() => {
    const m = {}; matches.forEach((mt) => { const r = assignMap[mt.id]; if (r && refById[r]) m[mt.id] = refereeName(refById[r]) }); return m
  }, [matches, assignMap, refById])
  const ref2NameById = useMemo(() => {
    const m = {}; matches.forEach((mt) => { const r = assignR2[mt.id]; if (r && refById[r]) m[mt.id] = refereeName(refById[r]) }); return m
  }, [matches, assignR2, refById])

  // ── Actions ──────────────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false)
  const [slotBusy, setSlotBusy] = useState(null)
  const [fixing, setFixing] = useState(false)
  async function fixWolvertem() {
    if (!tournamentId) return
    setFixing(true)
    try {
      const { linked } = await ensureWolvertemReferees(tournamentId)
      const added = await loadWolvertemMatches(tournamentId)
      await Promise.all([loadAtt(), loadMatches()])
      toast.success(`Wolvertem pronto: ${linked} arbitri${added ? `, ${added} partite caricate` : ''}`)
    } catch (e) { toast.error('Errore: ' + (e?.message || '')) } finally { setFixing(false) }
  }
  async function generate() {
    if (!matches.length) { toast.error('Nessuna partita per questa giornata — carica prima il calendario'); return }
    if (!rankedRoster.length) { toast.error('Nessun arbitro disponibile'); return }
    setBusy(true)
    try {
      const { r1, r2 } = autoAssignSchedule(matches, rankedRoster)
      const rows = []
      matches.forEach((m) => {
        if (r1[m.id]) rows.push({ match_id: m.id, referee_id: r1[m.id], role: 'R1' })
        if (r2[m.id]) rows.push({ match_id: m.id, referee_id: r2[m.id], role: 'R2' })
      })
      await trackSave(() => Promise.all(rows.map((row) => designationService.upsert(row))))
      setAssignMap(r1); setAssignR2(r2)
      const two = Object.keys(r2).length
      toast.success(`Designazioni generate (${Object.keys(r1).length} partite${two ? `, ${two} con 2° arbitro` : ''})`)
    } catch (e) { toast.error('Errore: ' + (e?.message || '')) } finally { setBusy(false) }
  }

  async function generateSlot(slotKey) {
    if (!rankedRoster.length) { toast.error('Nessun arbitro disponibile'); return }
    const slotMatches = matches.filter((m) => (m.scheduled_time || `m${m.match_number}`) === slotKey)
    if (!slotMatches.length) return
    setSlotBusy(slotKey)
    try {
      const { r1, r2 } = autoAssignSlot(matches, slotKey, rankedRoster, assignMap, assignR2)
      const rows = []
      slotMatches.forEach((m) => {
        if (r1[m.id]) rows.push({ match_id: m.id, referee_id: r1[m.id], role: 'R1' })
        if (r2[m.id]) rows.push({ match_id: m.id, referee_id: r2[m.id], role: 'R2' })
      })
      await trackSave(() => Promise.all(rows.map((row) => designationService.upsert(row))))
      setAssignMap((prev) => ({ ...prev, ...r1 }))
      setAssignR2((prev) => ({ ...prev, ...r2 }))
      toast.success(`Fascia ${hhmm(slotMatches[0].scheduled_time)} · ${rows.length} designazioni`)
    } catch (e) { toast.error('Errore: ' + (e?.message || '')) } finally { setSlotBusy(null) }
  }

  const [confirmReset, setConfirmReset] = useState(false)
  async function resetDay() {
    if (!matches.length) return
    if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 4000); return }
    setConfirmReset(false)
    setBusy(true)
    try {
      await trackSave(() => designationService.deleteByMatches(matches.map((m) => m.id)))
      setAssignMap((prev) => { const next = { ...prev }; matches.forEach((m) => { delete next[m.id] }); return next })
      setAssignR2((prev) => { const next = { ...prev }; matches.forEach((m) => { delete next[m.id] }); return next })
      toast.success(`Designazioni Day ${day} azzerate`)
    } catch (e) { toast.error('Errore: ' + (e?.message || '')) } finally { setBusy(false) }
  }

  async function setRef(matchId, refId) {    const prev = assignMap[matchId]
    setAssignMap((m) => ({ ...m, [matchId]: refId || undefined }))
    try {
      if (refId) await trackSave(() => designationService.upsert({ match_id: matchId, referee_id: refId, role: 'R1' }))
    } catch (e) {
      setAssignMap((m) => ({ ...m, [matchId]: prev }))
      toast.error('Errore salvataggio: ' + (e?.message || ''))
    }
  }

  async function setRef2(matchId, refId) {
    const prev = assignR2[matchId]
    setAssignR2((m) => ({ ...m, [matchId]: refId || undefined }))
    try {
      if (refId) await trackSave(() => designationService.upsert({ match_id: matchId, referee_id: refId, role: 'R2' }))
    } catch (e) {
      setAssignR2((m) => ({ ...m, [matchId]: prev }))
      toast.error('Errore salvataggio: ' + (e?.message || ''))
    }
  }

  function sendGeneral() {
    if (!matches.length) return
    shareScheduleGeneral({ tournamentName: tournament?.name, dayLabel: `Day ${day}`, matches, refNameById, ref2NameById })
  }
  function sendSlot(slot) {
    if (!slot?.items?.length) return
    shareSlotSchedule({ tournamentName: tournament?.name, dayLabel: `Day ${day}`, slotTime: slot.time, matches: slot.items, refNameById, ref2NameById })
  }
  function sendSlotToManager(slot) {
    if (!slot?.items?.length) return
    let phone = managerPhone
    if (!phone) {
      const v = window.prompt('Numero WhatsApp del responsabile del torneo (es. +32...)')
      if (!v || !v.trim()) return
      phone = v.trim(); setManagerPhone(phone); setManagerPhoneLS(tournamentId, phone)
    }
    shareSlotScheduleToPhone({ tournamentName: tournament?.name, dayLabel: `Day ${day}`, slotTime: slot.time, matches: slot.items, refNameById, ref2NameById }, phone)
  }
  function sendIndividual(ref) {
    const mine = matches
      .filter((m) => assignMap[m.id] === ref.id || assignR2[m.id] === ref.id)
      .sort(byTime)
      .map((m) => {
        if (!needsTwoRefs(m)) return m
        const isR1 = assignMap[m.id] === ref.id
        const partnerId = isR1 ? assignR2[m.id] : assignMap[m.id]
        const partner = partnerId && refById[partnerId] ? refereeName(refById[partnerId]) : null
        return { ...m, _role: isR1 ? 'R1' : 'R2', _partner: partner }
      })
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
    () => rosterByName.filter((r) => matches.some((m) => assignMap[m.id] === r.id || assignR2[m.id] === r.id)),
    [rosterByName, matches, assignMap, assignR2]
  )

  // Workload a barre: TUTTI gli arbitri presenti, ordinati per n° partite (desc).
  const workloadBars = useMemo(() => {
    const rows = roster.map((r) => ({ r, n: workload[r.id] || 0 }))
    rows.sort((a, b) => (b.n - a.n) || refereeName(a.r).localeCompare(refereeName(b.r)))
    const max = Math.max(1, ...rows.map((x) => x.n))
    return { rows, max }
  }, [roster, workload])

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
          {needsSetup && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-sm">
              <div className="flex-1 flex items-center gap-2">
                <AlertTriangle size={16} /> Configurazione Wolvertem incompleta. Tocca per caricare i 6 arbitri (con numeri WhatsApp) e le partite di sabato e domenica.
              </div>
              <button
                onClick={fixWolvertem}
                disabled={fixing}
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                style={{ background: ORANGE }}
              >
                <Users size={16} /> {fixing ? 'Configuro…' : 'Configura Wolvertem'}
              </button>
            </div>
          )}

          {/* Actions */}
          {!dayNeedsRefs ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 text-sm">
              <Users size={16} /> Giornata auto-arbitrata — nessuna designazione richiesta.
            </div>
          ) : (
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
            <button
              onClick={resetDay}
              disabled={busy || !matches.length}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border disabled:opacity-50 ${confirmReset ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-300'}`}
            >
              <RotateCcw size={16} /> {confirmReset ? 'Confermi? Azzera' : 'Reset designazioni'}
            </button>
          </div>
          )}

          {dayNeedsRefs && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 shrink-0">
                <Send size={14} /> Responsabile torneo
              </div>
              <input
                value={managerPhone}
                onChange={(e) => setManagerPhone(e.target.value)}
                placeholder="+32… (numero WhatsApp)"
                className="flex-1 text-sm rounded-lg border border-gray-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                onClick={() => { setManagerPhoneLS(tournamentId, managerPhone.trim()); setManagerPhone(managerPhone.trim()); toast.success(managerPhone.trim() ? 'Numero responsabile salvato' : 'Numero rimosso') }}
                className="shrink-0 inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-sm font-bold text-white"
                style={{ background: NAVY }}
              >
                Salva
              </button>
            </div>
          )}

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

          {/* Classifica cumulata torneo (base meritocratica per le finali) */}
          {rankedRoster.length > 0 && (
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-1.5">
                Classifica cumulata torneo · {usingPresent ? 'presenti' : 'tutti'}
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {rankedRoster.map((r, i) => {
                  const info = rankInfo[r.id]
                  const top = i < 4
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-5 text-sm font-bold tabular-nums" style={{ color: top ? ORANGE : '#9ca3af' }}>{i + 1}</span>
                      <span className="flex-1 text-sm font-semibold text-gray-900 truncate flex items-center gap-1.5">
                        {top && <Trophy size={12} style={{ color: ORANGE }} />}
                        {refereeName(r)}
                      </span>
                      <span className="text-xs tabular-nums text-gray-500">
                        {info && info.avg != null ? `${info.avg.toFixed(1)} · ${info.count} val.` : 'no val.'}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 text-[11px] text-gray-400">
                I primi 4 (🏆) sono i candidati alle finali, in base alla media cumulata sull'intero torneo (Day 1 + Day 2).
              </div>
            </div>
          )}

          {/* Matches grouped by time slot */}
          {slots.map((slot) => (
            <div key={slot.time}>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <div className="text-sm font-bold uppercase tracking-wide text-gray-600">{hhmm(slot.time)}</div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => generateSlot(slot.time)}
                    disabled={slotBusy === slot.time || !rankedRoster.length}
                    className="inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2.5 py-1.5 text-white disabled:opacity-50"
                    style={{ background: ORANGE }}
                  >
                    <Wand2 size={12} /> {slotBusy === slot.time ? '…' : 'Genera'}
                  </button>
                  <button
                    onClick={() => sendSlot(slot)}
                    className="inline-flex items-center gap-1 text-xs font-bold rounded-lg border border-gray-300 px-2.5 py-1.5 text-gray-700 hover:bg-gray-100"
                  >
                    <MessageCircle size={12} /> WhatsApp
                  </button>
                  <button
                    onClick={() => sendSlotToManager(slot)}
                    title="Invia questo gruppo al responsabile del torneo"
                    className="inline-flex items-center gap-1 text-xs font-bold rounded-lg border px-2.5 py-1.5 text-white"
                    style={{ background: NAVY, borderColor: NAVY }}
                  >
                    <Send size={12} /> Responsabile
                  </button>
                </div>
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {slot.items.map((m) => {
                  const conflict = conflicts.has(m.id)
                  const selfRef = m.referees_needed === 0
                  const two = needsTwoRefs(m)
                  const r2Dup = two && assignR2[m.id] && assignR2[m.id] === assignMap[m.id]
                  const opts = (
                    <>
                      <option value="">— arbitro —</option>
                      {rosterByName.map((r) => {
                        const info = rankInfo[r.id]
                        const suffix = info && info.avg != null ? ` · ${info.avg.toFixed(1)}` : ''
                        return <option key={r.id} value={r.id}>{refereeName(r)}{suffix}</option>
                      })}
                    </>
                  )
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                          {m.is_final && <Trophy size={13} style={{ color: ORANGE }} />}
                          C{m.court} · #{m.match_number} <span className="text-gray-500 font-normal">{matchTag(m)}</span>
                        </div>
                        <div className="text-xs text-gray-400 truncate">{m.team1} vs {m.team2}</div>
                      </div>
                      {selfRef ? (
                        <span className="shrink-0 text-[11px] font-semibold text-gray-400 bg-gray-100 rounded-lg px-2.5 py-1.5">Auto-arbitrata</span>
                      ) : two ? (
                        <div className="shrink-0 flex flex-col gap-1 items-end">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-gray-400 w-4 text-right">R1</span>
                            <select
                              value={assignMap[m.id] || ''}
                              onChange={(e) => setRef(m.id, e.target.value)}
                              className={`w-36 min-w-0 rounded-lg border px-2 py-1.5 text-sm ${conflict ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-300'}`}
                            >{opts}</select>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-gray-400 w-4 text-right">R2</span>
                            <select
                              value={assignR2[m.id] || ''}
                              onChange={(e) => setRef2(m.id, e.target.value)}
                              className={`w-36 min-w-0 rounded-lg border px-2 py-1.5 text-sm ${r2Dup ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-300'}`}
                            >{opts}</select>
                          </div>
                        </div>
                      ) : (
                        <select
                          value={assignMap[m.id] || ''}
                          onChange={(e) => setRef(m.id, e.target.value)}
                          className={`shrink-0 w-36 rounded-lg border px-2 py-1.5 text-sm ${conflict ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-300'}`}
                        >{opts}</select>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Referee workload (barre) — aggiornato in tempo reale ad ogni designazione */}
          {roster.length > 0 && (
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">
                Referee workload · {matches.length} partite
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-3 space-y-2">
                {workloadBars.rows.map(({ r, n }) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className="w-28 text-sm font-semibold shrink-0 truncate">{refereeName(r)}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(n / workloadBars.max) * 100}%`, background: NAVY }} />
                    </div>
                    <span className="text-sm font-bold tabular-nums w-6 text-right">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workload */}
          {refsWithMatches.length > 0 && (
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-1.5">WhatsApp individuale</div>
              <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {refsWithMatches.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{refereeName(r)}</div>
                      {rankInfo[r.id]?.avg != null && (
                        <div className="text-[11px] text-gray-400">media {rankInfo[r.id].avg.toFixed(1)} · {rankInfo[r.id].count} val.</div>
                      )}
                    </div>
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
