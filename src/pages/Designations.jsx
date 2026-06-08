import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shuffle, Plus, Minus, MessageCircle, Copy, Download, Coffee, Trophy, Star } from 'lucide-react'

import { Header } from '../components/layout/Header'
import { toast } from '../components/ui/Toast'

import { useTournaments, useTournamentReferees } from '../hooks/useTournaments'
import { useTournamentRanking } from '../hooks/useRanking'
import { supabase, courtAssignmentService, attendanceService } from '../lib/supabase'
import {
  buildDesignationMessage,
  buildPersonalMessage,
  shareToWhatsApp,
  copyDesignationMessage,
} from '../lib/whatsapp'
import { useDocLanguage } from '../context/LanguageGate'
import { generateDesignationPDF, downloadPDF } from '../lib/pdf'
import { refereeName } from '../lib/utils'

// ─── Brand ──────────────────────────────────────────────────────────────────
const NAVY = '#2D3270'
const NAVY2 = '#3D4490'
const ORANGE = '#E85D26'

// ─── Finals (sentinel, come nel modello esistente) ──────────────────────────
const FINALS_COURT_NAMES = ["Women's Final", "Men's Final"]
const FINALS_SESSION_ORDER = 99
const FINALS_SECTION_NUMBER = 1
const FINALS_ROLES = ['R1', 'R2']

const MAX_CONSEC = 3 // tetto massimo giri consecutivi (decisione concordata)

// ─── Algoritmo rotazione GIRONI (2 ON / 2 OFF sfalsato + rimescolato) ────────
// Decisione concordata: ogni arbitro lavora 2 giri di fila, poi riposa
// (stile Heraklion), 1 arbitro per campo, 4 lavorano / 4 riposano (se >= 8),
// tetto MAX_CONSEC=3 solo come sicurezza, rotazione campi, bench rimescolato/
// bilanciato (chi ha riposato di più / ha meno match entra prima).
const STINT = 2 // giri consecutivi prima della pausa (2 ON / 2 OFF)
function generateGiri(refIds, nCourts, nGiri) {
  const REFS = [...refIds]
  const NC = Math.min(nCourts, REFS.length)
  const consec = {}, rested = {}, total = {}, lastCourt = {}
  REFS.forEach((r) => { consec[r] = 0; rested[r] = 99; total[r] = 0; lastCourt[r] = null })
  // sfalsamento iniziale: i primi due partono "a metà ciclo", così i cambi
  // non avvengono tutti nello stesso giro
  if (REFS[0]) consec[REFS[0]] = 1
  if (REFS[1]) consec[REFS[1]] = 1
  let prevWorking = []

  const giri = []
  for (let g = 0; g < nGiri; g++) {
    const stay = prevWorking.filter((r) => consec[r] < STINT && consec[r] < MAX_CONSEC)
    const free = Math.max(0, NC - stay.length)
    const bench = REFS.filter((r) => !stay.includes(r))
    bench.sort((a, b) => (rested[b] - rested[a]) || (total[a] - total[b]) || (Math.random() - 0.5))
    const working = [...stay, ...bench.slice(0, free)]
    const resting = REFS.filter((r) => !working.includes(r))

    const courtsArr = new Array(NC).fill(null)
    const avail = Array.from({ length: NC }, (_, i) => i)
    for (const r of [...working].sort(() => Math.random() - 0.5)) {
      const prefer = avail.filter((c) => c !== lastCourt[r])
      const c = (prefer.length ? prefer : avail)[0]
      courtsArr[c] = r
      avail.splice(avail.indexOf(c), 1)
    }
    courtsArr.forEach((r, c) => {
      if (r != null) { consec[r] = (consec[r] || 0) + 1; rested[r] = 0; total[r] = (total[r] || 0) + 1; lastCourt[r] = c }
    })
    resting.forEach((r) => { consec[r] = 0; rested[r] = (rested[r] || 0) + 1 })
    giri.push({ courts: courtsArr, rest: resting })
    prevWorking = working
  }
  return giri
}

// ─── Finali snake bilanciato (#1+#4 maschile, #2+#3 femminile, più alto = R1) ─
function snakeFinals(rankedIds) {
  const r = rankedIds
  return {
    "Men's Final": { R1: r[0] || '', R2: r[3] || '' },
    "Women's Final": { R1: r[1] || '', R2: r[2] || '' },
  }
}

export default function Designations() {
  const { requestLanguage } = useDocLanguage()
  const [searchParams] = useSearchParams()
  const { tournaments } = useTournaments()

  const [tournamentId, setTournamentId] = useState(searchParams.get('tournamentId') || '')
  const [dayNumber, setDayNumber] = useState(1)
  const [tab, setTab] = useState('gironi')

  useEffect(() => {
    if (!tournamentId && tournaments.length > 0) {
      const now = new Date()
      const closest = [...tournaments].sort(
        (a, b) => Math.abs(new Date(a.start_date) - now) - Math.abs(new Date(b.start_date) - now)
      )[0]
      if (closest) setTournamentId(closest.id)
    }
  }, [tournaments, tournamentId])

  const tournament = tournaments.find((t) => t.id === tournamentId)
  const { referees: assignedReferees } = useTournamentReferees(tournamentId)
  const { ranking: tournamentRanking } = useTournamentRanking(tournamentId)

  const courts = useMemo(() => {
    if (Array.isArray(tournament?.courts) && tournament.courts.length > 0) return tournament.courts
    return ['Court 1', 'Court 2', 'Court 3', 'Court 4']
  }, [tournament])

  const totalDays = useMemo(() => {
    if (!tournament?.start_date || !tournament?.end_date) return 2
    const d = Math.ceil((new Date(tournament.end_date) - new Date(tournament.start_date)) / 86400000) + 1
    return Math.max(1, d)
  }, [tournament])

  const refById = useMemo(() => {
    const m = {}
    for (const r of assignedReferees) m[r.id] = r
    return m
  }, [assignedReferees])

  const nameOf = useCallback((id) => (id && refById[id] ? refereeName(refById[id]) : '—'), [refById])

  // ─── Presenze (check-in) — sezione unica: section_number = 1 ───────────────
  const SECTION = 1
  const [attendanceMap, setAttendanceMap] = useState({})
  const attendanceKey = `${dayNumber}_${SECTION}`

  const loadAttendance = useCallback(async () => {
    if (!tournamentId) return
    const { data } = await attendanceService.getForTournament(tournamentId)
    const map = {}
    for (const row of data || []) map[row.referee_id] = row.attendance || {}
    setAttendanceMap(map)
  }, [tournamentId])
  useEffect(() => { loadAttendance() }, [loadAttendance])

  const isPresent = (refId) => Boolean(attendanceMap[refId]?.[attendanceKey])
  const presentRefs = useMemo(
    () => assignedReferees.filter((r) => Boolean(attendanceMap[r.id]?.[attendanceKey])),
    [assignedReferees, attendanceMap, attendanceKey]
  )

  async function togglePresence(refId) {
    const current = isPresent(refId)
    await attendanceService.setPresent(tournamentId, refId, dayNumber, SECTION, !current)
    setAttendanceMap((prev) => {
      const refAtt = { ...(prev[refId] || {}) }
      if (current) delete refAtt[attendanceKey]
      else refAtt[attendanceKey] = new Date().toISOString()
      return { ...prev, [refId]: refAtt }
    })
  }

  // ─── Giri (rotazione) ──────────────────────────────────────────────────────
  const [giri, setGiri] = useState([]) // [{courts:[id|null], rest:[id]}]
  const [nGiri, setNGiri] = useState(8)
  const [picker, setPicker] = useState(null) // {mode, ...}
  const [busy, setBusy] = useState(false)

  const rosterIds = useMemo(() => {
    if (presentRefs.length > 0) return presentRefs.map((r) => r.id)
    // fallback: arbitri presenti nei giri salvati
    const s = new Set()
    giri.forEach((g) => g.courts.forEach((id) => id && s.add(id)))
    return [...s]
  }, [presentRefs, giri])

  const restFor = useCallback(
    (courtsArr) => rosterIds.filter((id) => !courtsArr.includes(id)),
    [rosterIds]
  )

  // Carica i giri salvati
  const loadGiri = useCallback(async () => {
    if (!tournamentId) return
    const { data } = await supabase
      .from('court_assignments')
      .select('*, referees(*)')
      .eq('tournament_id', tournamentId)
      .eq('day_number', dayNumber)
      .neq('session_order', FINALS_SESSION_ORDER)
      .order('session_order')
      .order('court')
    const reg = data || []
    if (reg.length === 0) { setGiri([]); return }
    const maxSO = Math.max(...reg.map((r) => r.session_order))
    const rebuilt = []
    for (let so = 1; so <= maxSO; so++) {
      const courtsArr = courts.map((cn) => {
        const row = reg.find((r) => r.session_order === so && r.court === cn)
        return row ? row.referee_id : null
      })
      rebuilt.push({ courts: courtsArr, rest: [] })
    }
    setGiri(rebuilt)
    setNGiri(rebuilt.length)
  }, [tournamentId, dayNumber, courts])
  useEffect(() => { loadGiri() }, [loadGiri])

  // Salva i giri (sostituisce solo le righe non-finali del giorno)
  async function persistGiri(nextGiri) {
    if (!tournamentId) return
    await supabase
      .from('court_assignments')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('day_number', dayNumber)
      .neq('session_order', FINALS_SESSION_ORDER)
    const rows = []
    nextGiri.forEach((g, gi) => {
      g.courts.forEach((refId, ci) => {
        if (refId) rows.push({
          tournament_id: tournamentId,
          day_number: dayNumber,
          section_number: SECTION,
          court: courts[ci],
          session_order: gi + 1,
          referee_id: refId,
          role: 'R1',
        })
      })
    })
    if (rows.length > 0) {
      const { error } = await courtAssignmentService.bulkCreate(rows)
      if (error) throw error
    }
  }

  async function regenerate(n = nGiri) {
    if (rosterIds.length === 0) { toast.error('Segna prima gli arbitri presenti'); return }
    setBusy(true)
    try {
      const next = generateGiri(rosterIds, courts.length, n)
      setGiri(next)
      setNGiri(n)
      await persistGiri(next)
      toast.success('Rotazione generata e salvata')
    } catch (err) {
      console.error(err); toast.error(`Errore salvataggio: ${err.message}`)
    } finally { setBusy(false) }
  }

  async function changeGiriCount(delta) {
    const n = Math.max(1, nGiri + delta)
    await regenerate(n)
  }

  // Cambio manuale arbitro su un campo
  async function swapCourt(giroIdx, courtIdx, refId) {
    const next = giri.map((g) => ({ courts: [...g.courts], rest: [...g.rest] }))
    const rd = next[giroIdx]
    const ex = rd.courts.indexOf(refId)
    if (ex !== -1) rd.courts[ex] = rd.courts[courtIdx]
    rd.courts[courtIdx] = refId
    setGiri(next)
    setPicker(null)
    try { await persistGiri(next); toast.success('Aggiornato') }
    catch (err) { toast.error(`Errore: ${err.message}`) }
  }

  // ─── Finali ────────────────────────────────────────────────────────────────
  const [finalsRows, setFinalsRows] = useState([])
  const loadFinals = useCallback(async () => {
    if (!tournamentId) return
    const { data } = await supabase
      .from('court_assignments')
      .select('*, referees(*)')
      .eq('tournament_id', tournamentId)
      .eq('day_number', dayNumber)
      .eq('session_order', FINALS_SESSION_ORDER)
      .in('court', FINALS_COURT_NAMES)
    setFinalsRows(data || [])
  }, [tournamentId, dayNumber])
  useEffect(() => { loadFinals() }, [loadFinals])

  const rankedList = useMemo(() => {
    return [...(tournamentRanking || [])]
      .filter((r) => r.avg_score != null)
      .sort((a, b) => b.avg_score - a.avg_score)
  }, [tournamentRanking])
  const scoreById = useMemo(() => {
    const m = {}; rankedList.forEach((r) => { m[r.id] = r.avg_score }); return m
  }, [rankedList])

  const finalsSlot = useCallback((court, role) => {
    const row = finalsRows.find((r) => r.court === court && r.role === role)
    return row ? row.referee_id : ''
  }, [finalsRows])

  async function setFinalsSlot(court, role, refId) {
    try {
      const existing = finalsRows.find((r) => r.court === court && r.role === role)
      if (!refId) {
        if (existing) await supabase.from('court_assignments').delete().eq('id', existing.id)
      } else if (existing) {
        await supabase.from('court_assignments').update({ referee_id: refId }).eq('id', existing.id)
      } else {
        await supabase.from('court_assignments').insert({
          tournament_id: tournamentId, referee_id: refId, day_number: dayNumber,
          section_number: FINALS_SECTION_NUMBER, court, session_order: FINALS_SESSION_ORDER, role,
        })
      }
      await loadFinals()
      setPicker(null)
      toast.success(`${court} ${role} aggiornato`)
    } catch (err) { toast.error(`Errore: ${err.message}`) }
  }

  async function applyMeritocratic() {
    if (rankedList.length < 4) { toast.error('Servono almeno 4 arbitri valutati in questo torneo'); return }
    const snake = snakeFinals(rankedList.map((r) => r.id))
    try {
      await supabase.from('court_assignments').delete()
        .eq('tournament_id', tournamentId).eq('day_number', dayNumber)
        .eq('session_order', FINALS_SESSION_ORDER).in('court', FINALS_COURT_NAMES)
      const rows = []
      for (const court of FINALS_COURT_NAMES)
        for (const role of FINALS_ROLES)
          if (snake[court][role]) rows.push({
            tournament_id: tournamentId, referee_id: snake[court][role], day_number: dayNumber,
            section_number: FINALS_SECTION_NUMBER, court, session_order: FINALS_SESSION_ORDER, role,
          })
      if (rows.length) await courtAssignmentService.bulkCreate(rows)
      await loadFinals()
      toast.success('Finali assegnate (meritocratico)')
    } catch (err) { toast.error(`Errore: ${err.message}`) }
  }

  // ─── Carico ────────────────────────────────────────────────────────────────
  const load = useMemo(() => {
    const t = {}; rosterIds.forEach((id) => { t[id] = 0 })
    giri.forEach((g) => g.courts.forEach((id) => { if (id != null) t[id] = (t[id] || 0) + 1 }))
    return t
  }, [giri, rosterIds])
  const maxLoad = Math.max(1, ...Object.values(load))

  // ─── Azioni condivise (WhatsApp / Copy / PDF) ──────────────────────────────
  const flatAssignments = useMemo(() => {
    const out = []
    giri.forEach((g, gi) => g.courts.forEach((id, ci) => {
      if (id) out.push({ court: courts[ci], session_order: gi + 1, role: 'R1', referee_id: id, referees: refById[id] })
    }))
    return out
  }, [giri, courts, refById])

  async function handleWhatsApp() {
    const lang = await requestLanguage(); if (!lang) return
    const msg = buildDesignationMessage({ tournament, dayNumber, assignments: flatAssignments, lang })
    shareToWhatsApp(msg)
  }
  async function handleCopy() {
    const lang = await requestLanguage(); if (!lang) return
    const msg = buildDesignationMessage({ tournament, dayNumber, assignments: flatAssignments, lang })
    await copyDesignationMessage(msg); toast.success('Copiato')
  }
  async function handlePDF() {
    const lang = await requestLanguage(); if (!lang) return
    try {
      const blob = await generateDesignationPDF({ tournament, dayNumber, assignments: flatAssignments, lang })
      downloadPDF(blob, `designazioni-${tournament?.name || 'torneo'}-day${dayNumber}.pdf`)
    } catch (err) { toast.error(`PDF non riuscito: ${err.message}`) }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">
      <Header title="Designazioni" subtitle={tournament?.name} />

      {/* Selettori + tab brand */}
      <div style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY2})` }} className="text-white px-4 pt-3 pb-3">
        <div className="flex gap-2 mb-3">
          <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)}
            className="flex-1 rounded-lg px-3 py-2 text-gray-900 text-sm font-semibold">
            {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={dayNumber} onChange={(e) => setDayNumber(Number(e.target.value))}
            className="rounded-lg px-3 py-2 text-gray-900 text-sm font-semibold">
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Day {d}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {[['gironi', 'Gironi'], ['finali', 'Finali']].map(([k, label]) => (
            <button key={k} onClick={() => { setTab(k); setPicker(null) }}
              style={tab === k ? { background: '#fff', color: NAVY } : { background: 'rgba(255,255,255,.15)', color: '#fff' }}
              className="flex-1 rounded-xl py-2.5 text-base font-bold">
              {k === 'gironi' ? '🔄 ' : '🏆 '}{label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'gironi' && (
        <div className="pb-24">
          {/* Check-in presenti */}
          <div className="px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
              Presenti · {presentRefs.length}/{assignedReferees.length}
            </div>
            <div className="flex flex-wrap gap-2">
              {assignedReferees.map((r) => {
                const on = isPresent(r.id)
                return (
                  <button key={r.id} onClick={() => togglePresence(r.id)}
                    style={on ? { background: NAVY, color: '#fff', borderColor: NAVY } : {}}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold border ${on ? '' : 'bg-white border-gray-300 text-gray-600'}`}>
                    {refereeName(r)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Azioni rotazione */}
          <div className="px-4 flex gap-2 items-center">
            <button onClick={() => regenerate()} disabled={busy}
              style={{ background: ORANGE }} className="flex-1 rounded-xl text-white text-base font-bold py-3 shadow flex items-center justify-center gap-2 disabled:opacity-60">
              <Shuffle size={18} /> {busy ? 'Genero…' : 'Rigenera rotazione'}
            </button>
            <button onClick={() => changeGiriCount(-1)} className="rounded-xl bg-white border border-gray-300 text-gray-600 w-12 h-12 flex items-center justify-center"><Minus size={20} /></button>
            <button onClick={() => changeGiriCount(1)} style={{ background: NAVY }} className="rounded-xl text-white w-12 h-12 flex items-center justify-center"><Plus size={20} /></button>
          </div>

          {/* Giri */}
          <div className="px-4 pt-3 space-y-3">
            {giri.length === 0 && (
              <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center text-gray-500 text-sm">
                Nessuna rotazione. Segna i presenti e tocca <b>Rigenera rotazione</b>.
              </div>
            )}
            {giri.map((g, gi) => {
              const rest = restFor(g.courts)
              return (
                <div key={gi} className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                  <div style={{ background: NAVY }} className="text-white px-4 py-2 flex items-center justify-between">
                    <span className="text-lg font-bold uppercase tracking-wide">Giro {gi + 1}</span>
                    <span className="text-white/50 text-xs">{g.courts.filter(Boolean).length} match in parallelo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    {g.courts.map((id, ci) => (
                      <button key={ci} onClick={() => setPicker({ mode: 'court', giro: gi, court: ci })}
                        className="rounded-xl border-2 border-emerald-300 bg-emerald-50 active:bg-emerald-100 px-2 py-3 text-center min-h-[70px] flex flex-col items-center justify-center">
                        <span className="text-[11px] font-bold uppercase text-emerald-700 tracking-wide">{courts[ci]}</span>
                        <span className="text-lg font-bold leading-tight mt-0.5">{nameOf(id)}</span>
                      </button>
                    ))}
                  </div>
                  {rest.length > 0 && (
                    <div className="px-3 pb-3">
                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                        <span className="text-[11px] font-bold uppercase text-amber-700 tracking-wide flex items-center gap-1"><Coffee size={12} /> In pausa</span>
                        <div className="text-base font-semibold text-amber-900 leading-tight">{rest.map(nameOf).join(' · ')}</div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Carico */}
          {giri.length > 0 && (
            <div className="px-4 mt-4">
              <div className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">Carico arbitri ({giri.length} giri)</div>
              <div className="rounded-2xl bg-white border border-gray-200 p-3 space-y-2">
                {rosterIds.map((id) => {
                  const t = load[id] || 0
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <span className="w-28 text-sm font-semibold shrink-0 truncate">{nameOf(id)}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(t / maxLoad) * 100}%`, background: NAVY }} />
                      </div>
                      <span className="text-sm font-bold tabular-nums w-6 text-right">{t}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Azioni condivisione */}
          {giri.length > 0 && (
            <div className="px-4 mt-4 grid grid-cols-3 gap-2">
              <button onClick={handleWhatsApp} className="rounded-xl bg-green-600 text-white text-sm font-bold py-3 flex items-center justify-center gap-1"><MessageCircle size={16} /> WhatsApp</button>
              <button onClick={handleCopy} className="rounded-xl bg-gray-700 text-white text-sm font-bold py-3 flex items-center justify-center gap-1"><Copy size={16} /> Copia</button>
              <button onClick={handlePDF} style={{ background: NAVY }} className="rounded-xl text-white text-sm font-bold py-3 flex items-center justify-center gap-1"><Download size={16} /> PDF</button>
            </div>
          )}
        </div>
      )}

      {tab === 'finali' && (
        <div className="pb-24 px-4 pt-3">
          <button onClick={applyMeritocratic} style={{ background: ORANGE }}
            className="w-full rounded-xl text-white text-base font-bold py-3 shadow flex items-center justify-center gap-2 mb-3">
            <Star size={18} /> Assegna meritocratico (top 4)
          </button>
          <p className="text-sm text-gray-500 leading-relaxed mb-3">
            I 4 migliori di questo torneo coprono le due finali (snake: #1+#4 e #2+#3). Punteggio più alto = R1. Tocca uno slot per cambiare a mano.
          </p>

          {FINALS_COURT_NAMES.map((court) => (
            <div key={court} className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden mb-3">
              <div style={{ background: NAVY }} className="text-white px-4 py-2 flex items-center justify-between">
                <span className="text-lg font-bold uppercase tracking-wide flex items-center gap-2"><Trophy size={16} /> {court === "Men's Final" ? 'Finale Maschile' : 'Finale Femminile'}</span>
                <span className="text-white/50 text-xs">2 arbitri</span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                {FINALS_ROLES.map((role) => {
                  const id = finalsSlot(court, role)
                  const pos = id ? rankedList.findIndex((r) => r.id === id) + 1 : 0
                  return (
                    <button key={role} onClick={() => setPicker({ mode: 'final', court, role })}
                      style={role === 'R1' ? { borderColor: ORANGE, background: '#FFF4EF' } : {}}
                      className={`rounded-xl border-2 px-2 py-3 text-center min-h-[88px] flex flex-col items-center justify-center gap-0.5 ${role === 'R1' ? '' : 'border-gray-300 bg-gray-50'}`}>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{role === 'R1' ? 'R1 · Primo' : 'R2 · Secondo'}</span>
                      <span className="text-xl font-bold leading-tight">{nameOf(id)}</span>
                      {id && scoreById[id] != null && <span className="text-xs font-semibold text-gray-500">#{pos} · {scoreById[id].toFixed(1)}/5</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Classifica torneo */}
          <div className="mt-3">
            <div className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">Classifica valutazioni (questo torneo)</div>
            <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {rankedList.length === 0 && <div className="px-4 py-4 text-sm text-gray-500">Nessuna valutazione registrata per questo torneo.</div>}
              {rankedList.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3" style={i < 4 ? { background: '#FFF8F4' } : {}}>
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={i < 4 ? { background: ORANGE, color: '#fff' } : { background: '#E5E7EB', color: '#6B7280' }}>{i + 1}</span>
                  <span className="text-base font-semibold flex-1">{refereeName(r)}</span>
                  <span className="text-sm font-bold tabular-nums text-gray-600">{r.avg_score.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Picker bottom-sheet */}
      {picker && (
        <div className="fixed inset-0 z-30 flex items-end" onClick={() => setPicker(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-white rounded-t-3xl p-4 pb-8 shadow-2xl max-h-[72vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-3" />
            {picker.mode === 'court' ? (
              <>
                <div className="text-lg font-bold uppercase mb-1">Giro {picker.giro + 1} · {courts[picker.court]}</div>
                <div className="text-sm text-gray-500 mb-3">Scegli l'arbitro per questo campo</div>
                <div className="grid grid-cols-2 gap-2">
                  {rosterIds.map((id) => {
                    const onC = giri[picker.giro].courts.includes(id)
                    return (
                      <button key={id} onClick={() => swapCourt(picker.giro, picker.court, id)}
                        className={`rounded-xl py-3 px-3 text-base font-bold border-2 text-left ${onC ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                        {nameOf(id)}<div className="text-xs font-medium text-gray-500">{onC ? 'già in campo' : 'in pausa'}</div>
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold uppercase mb-1">{picker.court} · {picker.role}</div>
                <div className="text-sm text-gray-500 mb-3">Scegli l'arbitro (ordinati per valutazione)</div>
                <div className="grid grid-cols-2 gap-2">
                  {rankedList.map((r, i) => (
                    <button key={r.id} onClick={() => setFinalsSlot(picker.court, picker.role, r.id)}
                      style={i < 4 ? { borderColor: ORANGE, background: '#FFF4EF' } : {}}
                      className={`rounded-xl py-3 px-3 text-base font-bold border-2 text-left ${i < 4 ? '' : 'border-gray-200 bg-gray-50'}`}>
                      #{i + 1} {refereeName(r)}<div className="text-xs font-medium text-gray-500">{r.avg_score.toFixed(1)}/5</div>
                    </button>
                  ))}
                  <button onClick={() => setFinalsSlot(picker.court, picker.role, '')}
                    className="rounded-xl py-3 px-3 text-base font-bold border-2 border-red-200 bg-red-50 text-red-600 col-span-2">
                    ✕ Libera lo slot
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
