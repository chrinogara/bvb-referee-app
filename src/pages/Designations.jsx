import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shuffle, Minus, MessageCircle, Copy, Download, Coffee, Trophy, Star, RotateCcw, Clock, Settings2, FileText, Flag, AlertTriangle } from 'lucide-react'

import { Header } from '../components/layout/Header'
import { toast } from '../components/ui/Toast'

import { useTournaments, useTournamentReferees } from '../hooks/useTournaments'
import { useRanking, useTournamentRanking } from '../hooks/useRanking'
import { supabase, courtAssignmentService, attendanceService, evaluationService } from '../lib/supabase'
import {
  buildDesignationMessage,
  buildPersonalMessage,
  shareToWhatsApp,
  copyDesignationMessage,
  sharePersonalToReferee,
} from '../lib/whatsapp'
import { useDocLanguage } from '../context/LanguageGate'
import { generateDesignationPDF, downloadPDF, generateDayReportPDF, generateTournamentReportPDF } from '../lib/pdf'
import { computeDayStats, dayAdvice, computeTournamentStats, tournamentAdvice } from '../lib/report'
import { refereeName } from '../lib/utils'

// ─── Brand ──────────────────────────────────────────────────────────────────
const NAVY = '#2D3270'
const NAVY2 = '#3D4490'
const ORANGE = '#E85D26'

// ─── Finals (sentinel, come nel modello esistente) ──────────────────────────
const FINALS_COURT_NAMES = [
  "Men's Final — PRO",
  "Women's Final — PRO",
  "Men's Final — Challenge",
  "Women's Final — Challenge",
]
// Legacy 2-finals names, kept only to clean up old rows when re-assigning.
const LEGACY_FINALS_COURT_NAMES = ["Women's Final", "Men's Final"]
const FINALS_SESSION_ORDER = 99
const FINALS_SECTION_NUMBER = 1
const FINALS_ROLES = ['R1']                 // direttiva ufficiale: 1 SOLO arbitro per finale
const FINALS_LINE_ROLES = []                // direttiva ufficiale: NESSUN giudice di linea nelle finali

const MAX_CONSEC = 2 // tetto massimo giri consecutivi — direttiva ufficiale 2★/3★: mai 3 di fila

// Colore del piccolo badge valutazione (verde/ambra/rosso)
function scoreColorHex(s) {
  if (s == null) return '#9CA3AF'
  if (s >= 4) return '#059669'
  if (s >= 3) return '#D97706'
  return '#DC2626'
}

// ─── Algoritmo rotazione GIRONI (alternanza adattiva + rimescolato) ──────────
// Cadenza decisa in makeState (state.stint): con panchina (arbitri > campi) si
// alterna (1-ON/1-OFF quando arbitri >= 2x campi, es. 8 su 4: chi lavora un round
// riposa il successivo); 1 arbitro per campo; bench bilanciato (chi ha riposato
// di più / ha meno match entra prima); tetto MAX_CONSEC=3. La generazione avviene
// a blocchi di 2 round e PROSEGUE dalla situazione esistente (replay dei round
// già creati), così rigenerando si continua senza ripartire da capo.

function makeState(refIds, nCourts) {
  const REFS = [...refIds]
  const NC = Math.min(nCourts, REFS.length)
  // Rotation cadence. With any bench at all (refs > courts) we ALTERNATE: whoever
  // worked a round is sent to rest and the most-rested referees come in, so nobody
  // ever sits out two rounds in a row. With a deep bench (refs >= 2x courts, e.g.
  // 8 on 4) this is a clean 1-ON/1-OFF (round-1 referees rest in round 2). With a
  // thin roster some referees must work two rounds in a row (unavoidable), but rest
  // is still never doubled. When refs == courts everyone works every round anyway.
  const stint = REFS.length > NC ? 1 : 2
  const consec = {}, rested = {}, total = {}, lastCourt = {}
  REFS.forEach((r) => { consec[r] = 0; rested[r] = 99; total[r] = 0; lastCourt[r] = null })
  return { REFS, NC, stint, consec, rested, total, lastCourt, prevWorking: [] }
}

// Applica un round già noto (per il replay dello storico)
function applyRound(state, courtsArr) {
  const { REFS, consec, rested, total, lastCourt } = state
  const working = courtsArr.filter((r) => r != null)
  courtsArr.forEach((r, c) => {
    if (r != null) { consec[r] = (consec[r] || 0) + 1; rested[r] = 0; total[r] = (total[r] || 0) + 1; lastCourt[r] = c }
  })
  REFS.forEach((r) => { if (!working.includes(r)) { consec[r] = 0; rested[r] = (rested[r] || 0) + 1 } })
  state.prevWorking = working
}

// Calcola il round successivo dalla situazione corrente
function nextRound(state) {
  const { REFS, NC, stint, consec, rested, total, lastCourt, prevWorking } = state
  // "stay" = referees who keep working this round. Guard with REFS.includes so a
  // referee removed from the roster mid-day (attendance toggled off after rounds
  // were generated) can NEVER be re-assigned — prevents phantom designations.
  const stay = prevWorking.filter((r) => REFS.includes(r) && consec[r] < stint && consec[r] < MAX_CONSEC)
  const free = Math.max(0, NC - stay.length)
  const bench = REFS.filter((r) => !stay.includes(r))
  const benchSort = (a, b) => (rested[b] - rested[a]) || (total[a] - total[b]) || (Math.random() - 0.5)
  // HARD CAP (direttiva "mai 3 di fila"): per riempire i campi si usano PRIMA gli
  // arbitri sotto il tetto (consec < MAX_CONSEC); quelli che hanno già raggiunto il
  // tetto entrano SOLO se non c'è alternativa (organico insufficiente), scegliendo i
  // meno "in debito" (consec minore, poi meno match totali).
  const eligible = bench.filter((r) => consec[r] < MAX_CONSEC).sort(benchSort)
  const overCap = bench.filter((r) => consec[r] >= MAX_CONSEC).sort((a, b) => (consec[a] - consec[b]) || (total[a] - total[b]) || (Math.random() - 0.5))
  const working = [...stay, ...eligible, ...overCap].slice(0, stay.length + free)

  const courtsArr = new Array(NC).fill(null)
  const avail = Array.from({ length: NC }, (_, i) => i)
  for (const r of [...working].sort(() => Math.random() - 0.5)) {
    const prefer = avail.filter((c) => c !== lastCourt[r])
    const c = (prefer.length ? prefer : avail)[0]
    courtsArr[c] = r
    avail.splice(avail.indexOf(c), 1)
  }
  applyRound(state, courtsArr)
  return { courts: courtsArr, rest: REFS.filter((r) => !courtsArr.includes(r)) }
}

// Genera `count` round; se `existing` ha già dei round, prosegue da lì.
function genGiri(refIds, nCourts, count, existing = []) {
  const state = makeState(refIds, nCourts)
  if (existing.length === 0) {
    // initial desync for 2-ON/2-OFF only: start the first two "mid-cycle" so
    // stints don't all rotate together. Not used in 1-ON/1-OFF (alternation).
    if (state.stint === 2) {
      if (state.REFS[0]) state.consec[state.REFS[0]] = 1
      if (state.REFS[1]) state.consec[state.REFS[1]] = 1
    }
  } else {
    for (const g of existing) applyRound(state, g.courts)
  }
  const out = []
  for (let i = 0; i < count; i++) out.push(nextRound(state))
  return out
}

// Ricostruisce i contatori della rotazione (consec/rested/total) COSÌ COM'ERANO
// all'inizio del round `giroIdx`, replaying i round precedenti. Serve per valutare
// una sostituzione manuale con la stessa logica dell'algoritmo automatico.
function stateBeforeRound(refIds, nCourts, giri, giroIdx) {
  const state = makeState(refIds, nCourts)
  for (let i = 0; i < giroIdx; i++) {
    if (giri[i] && giri[i].courts) applyRound(state, giri[i].courts)
  }
  return state
}

// ─── Finali: designazione meritocratica a UN solo arbitro per finale ──────────
// Direttiva ufficiale 2★/3★: tutte le finali (PRO inclusa) con 1 solo arbitro,
// senza giudici di linea. I 4 migliori in classifica coprono le 4 finali; il
// migliore va alla finale più prestigiosa (PRO) a scendere. Più alto = designato.
function snakeFinals(rankedIds) {
  const r = rankedIds
  return {
    "Men's Final — PRO":         { R1: r[0] || '' },
    "Women's Final — PRO":       { R1: r[1] || '' },
    "Men's Final — Challenge":   { R1: r[2] || '' },
    "Women's Final — Challenge": { R1: r[3] || '' },
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
  const { ranking: globalRanking } = useRanking()

  // Classifica generale (media voti su tutti i tornei) per badge accanto al nome
  const globalScoreById = useMemo(() => {
    const m = {}
    for (const r of globalRanking || []) m[r.id] = r
    return m
  }, [globalRanking])

  const [nCourts, setNCourts] = useState(() => {
    const v = parseInt(localStorage.getItem('bvb_courts') || '4', 10)
    return v === 3 ? 3 : 4
  })

  const courts = useMemo(() => {
    const base = (Array.isArray(tournament?.courts) && tournament.courts.length > 0)
      ? tournament.courts
      : ['Court 1', 'Court 2', 'Court 3', 'Court 4']
    return base.slice(0, nCourts)
  }, [tournament, nCourts])

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

  // Arbitri ordinati alfabeticamente (per la lista presenti con interruttori)
  const sortedReferees = useMemo(
    () => [...assignedReferees].sort((a, b) => refereeName(a).localeCompare(refereeName(b))),
    [assignedReferees]
  )

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

  // Tutti / Nessuno presenti (bulk)
  async function setAllPresence(present) {
    if (!tournamentId) return
    try {
      await Promise.all(
        assignedReferees
          .filter((r) => isPresent(r.id) !== present)
          .map((r) => attendanceService.setPresent(tournamentId, r.id, dayNumber, SECTION, present))
      )
      setAttendanceMap((prev) => {
        const next = { ...prev }
        for (const r of assignedReferees) {
          const refAtt = { ...(next[r.id] || {}) }
          if (present) refAtt[attendanceKey] = new Date().toISOString()
          else delete refAtt[attendanceKey]
          next[r.id] = refAtt
        }
        return next
      })
    } catch (err) { toast.error(`Error: ${err.message}`) }
  }

  // ─── Giri (rotazione) ──────────────────────────────────────────────────────
  const [giri, setGiri] = useState([]) // [{courts:[id|null], rest:[id]}]
  const [picker, setPicker] = useState(null) // {mode, ...}
  const [busy, setBusy] = useState(false)

  // ─── Configurazione orari (persistita in localStorage per device) ──────────
  const LS_START = 'bvb_day_start'
  const LS_DUR   = 'bvb_round_duration'
  const LS_COURTS = 'bvb_courts' // shared with Evaluate (3 or 4 courts)
  const [dayStart, setDayStart]       = useState(() => localStorage.getItem(LS_START) || '09:00')
  const [roundDuration, setRoundDuration] = useState(() => parseInt(localStorage.getItem(LS_DUR) || '55', 10))
  const [showTimeCfg, setShowTimeCfg] = useState(false)

  function updateDayStart(v)       { setDayStart(v);       localStorage.setItem(LS_START, v) }
  function updateRoundDuration(v)  { setRoundDuration(v);  localStorage.setItem(LS_DUR, String(v)) }
  function updateNCourts(v)        { setNCourts(v);        localStorage.setItem(LS_COURTS, String(v)) }

  // Switch number of courts (3/4). If rounds already exist for the day they were
  // generated with the old court count, so clear them (attendance is kept) and let
  // the user press Generate again — keeps the rotation logic consistent.
  async function changeNCourts(v) {
    if (v === nCourts) return
    if (giri.length > 0) {
      if (!window.confirm(`Switch to ${v} courts? Today's generated rounds will be cleared (referee attendance is kept). Then press Generate again.`)) return
      if (tournamentId) {
        await supabase
          .from('court_assignments')
          .delete()
          .eq('tournament_id', tournamentId)
          .eq('day_number', dayNumber)
          .neq('session_order', FINALS_SESSION_ORDER)
      }
      setGiri([])
    }
    updateNCourts(v)
  }

  // Calcola l'orario stimato di inizio di un round (indice 0-based)
  function roundTime(idx) {
    const [h, m] = dayStart.split(':').map(Number)
    const total = h * 60 + m + idx * roundDuration
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }
  function estimatedEnd() {
    if (giri.length === 0) return null
    return roundTime(giri.length) // time after last round
  }

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

  // ─── Avviso staffing: troppi pochi arbitri rispetto ai campi ────────────────
  // Quando i presenti sono appena più dei campi, il tetto di riposo non può
  // essere garantito (non c'è abbastanza panchina) e gli arbitri lavorano molti
  // round di fila. Soglie ricavate dai test: ratio >= 1.5 è confortevole.
  const staffing = useMemo(() => {
    const present = rosterIds.length
    const nc = courts.length
    if (present === 0 || nc === 0) return null
    const ratio = present / nc
    const resting = present - nc // quanti riposano per round
    // stima grossolana del massimo di round consecutivi quando la panchina è sottile
    let level = 'ok'
    if (present <= nc) level = 'critical'            // nessuno riposa mai
    else if (ratio < 1.5) level = 'warn'             // riposo insufficiente
    return { present, nc, ratio, resting, level }
  }, [rosterIds.length, courts.length])

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
  }, [tournamentId, dayNumber, courts])
  useEffect(() => { loadGiri() }, [loadGiri])

  // Safety check: a referee must never appear twice in the same round.
  // Returns the list of conflicts (empty = all good).
  function findOverlaps(nextGiri) {
    const conflicts = []
    nextGiri.forEach((g, gi) => {
      const seen = new Set()
      g.courts.forEach((refId) => {
        if (!refId) return
        if (seen.has(refId)) conflicts.push({ round: gi + 1, referee: nameOf(refId) })
        seen.add(refId)
      })
    })
    return conflicts
  }

  // Salva i giri (sostituisce solo le righe non-finali del giorno)
  async function persistGiri(nextGiri) {
    if (!tournamentId) return
    // Guard: never write a rotation that double-books a referee in one round.
    const overlaps = findOverlaps(nextGiri)
    if (overlaps.length > 0) {
      const msg = overlaps.map((c) => `${c.referee} (Round ${c.round})`).join(', ')
      toast.error(`Overlap blocked — ${msg} assigned twice in the same round`)
      throw new Error(`Referee overlap detected: ${msg}`)
    }
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

  // Genera/continua 2 round alla volta (prosegue dalla situazione esistente)
  async function genNext() {
    if (rosterIds.length === 0) { toast.error('Mark present referees first'); return }
    setBusy(true)
    try {
      const add = genGiri(rosterIds, courts.length, 2, giri)
      const next = [...giri, ...add]
      setGiri(next)
      await persistGiri(next)
      toast.success(`2 rounds generated (${next.length} total)`)
    } catch (err) {
      console.error(err); toast.error(`Save error: ${err.message}`)
    } finally { setBusy(false) }
  }

  // Rimuove gli ultimi 2 round
  async function removeLastTwo() {
    if (giri.length === 0) return
    setBusy(true)
    try {
      const next = giri.slice(0, Math.max(0, giri.length - 2))
      setGiri(next)
      await persistGiri(next)
      toast.success('Last 2 rounds removed')
    } catch (err) {
      console.error(err); toast.error(`Error: ${err.message}`)
    } finally { setBusy(false) }
  }

  // Azzera rotazione + presenze del giorno (le finali restano)
  async function resetDay() {
    if (!tournamentId) return
    if (!window.confirm(`Reset rotation and attendance for Day ${dayNumber}?\nFinals will NOT be affected.`)) return
    setBusy(true)
    try {
      await supabase
        .from('court_assignments')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('day_number', dayNumber)
        .neq('session_order', FINALS_SESSION_ORDER)
      await Promise.all(
        assignedReferees
          .filter((r) => isPresent(r.id))
          .map((r) => attendanceService.setPresent(tournamentId, r.id, dayNumber, SECTION, false))
      )
      setGiri([])
      setAttendanceMap((prev) => {
        const next = { ...prev }
        for (const id of Object.keys(next)) {
          const refAtt = { ...next[id] }
          delete refAtt[attendanceKey]
          next[id] = refAtt
        }
        return next
      })
      toast.success('Day reset — rotation and attendance cleared')
    } catch (err) {
      console.error(err); toast.error(`Reset error: ${err.message}`)
    } finally { setBusy(false) }
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
    try { await persistGiri(next); toast.success('Assignment updated') }
    catch (err) { toast.error(`Error: ${err.message}`) }
  }

  // Valuta ogni candidato per la sostituzione aperta nel picker, con la stessa
  // logica della rotazione (riposo/lavoro/consecutivi ricostruiti fino a quel round).
  const ASSESS_ORDER = { best: 0, swap: 1, ok: 2, caution: 3, danger: 4, current: 5 }
  const pickerAssessments = useMemo(() => {
    if (!picker || picker.mode !== 'court') return {}
    const giroIdx = picker.giro, courtIdx = picker.court
    const round = giri[giroIdx]
    if (!round) return {}
    const st = stateBeforeRound(rosterIds, nCourts, giri, giroIdx)
    const currentRef = round.courts[courtIdx]
    const onCourt = round.courts.filter(Boolean)
    const onCourtSet = new Set(onCourt)
    const resting = rosterIds.filter((id) => !onCourtSet.has(id))
    const benchSorted = [...resting].sort((a, b) =>
      ((st.rested[b] || 0) - (st.rested[a] || 0)) || ((st.total[a] || 0) - (st.total[b] || 0))
    )
    const bestPick = benchSorted[0]
    const minTotal = resting.length ? Math.min(...resting.map((id) => st.total[id] || 0)) : 0
    const out = {}
    for (const id of rosterIds) {
      if (id === currentRef) { out[id] = { level: 'current', label: 'Current', detail: 'Already on this court' }; continue }
      if (onCourtSet.has(id)) {
        const ci = round.courts.indexOf(id)
        out[id] = { level: 'swap', label: 'Swap', detail: `On ${courts[ci]} now — clean swap, no imbalance` }
        continue
      }
      const consecBefore = st.consec[id] || 0
      if (consecBefore >= MAX_CONSEC) {
        out[id] = { level: 'danger', label: 'Not advised', detail: `Already ${consecBefore} rounds in a row — breaks the ${MAX_CONSEC}-in-a-row limit` }
        continue
      }
      if (consecBefore === MAX_CONSEC - 1) {
        out[id] = { level: 'caution', label: 'Caution', detail: `Would be ${consecBefore + 1} rounds in a row (at the limit)` }
        continue
      }
      if (id === bestPick) { out[id] = { level: 'best', label: 'Recommended', detail: 'Most rested / fewest matches — the rotation pick' }; continue }
      const total = st.total[id] || 0
      if (total > minTotal) {
        const fresher = benchSorted.find((x) => (st.total[x] || 0) === minTotal && x !== id)
        out[id] = { level: 'caution', label: 'Caution', detail: `Has more matches than others${fresher ? ` (e.g. ${nameOf(fresher)} rested more)` : ''}` }
        continue
      }
      out[id] = { level: 'ok', label: 'OK', detail: 'Was resting this round' }
    }
    return out
  }, [picker, giri, rosterIds, nCourts, courts]) // eslint-disable-line

  function chooseCourtRef(id) {
    const a = pickerAssessments[id]
    if (a && (a.level === 'danger' || a.level === 'caution')) {
      const ok = window.confirm(`${nameOf(id)} — ${a.detail}.\n\nThis bends the round rotation. Insert anyway?`)
      if (!ok) return
    }
    swapCourt(picker.giro, picker.court, id)
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
      toast.success(`${court} ${role} updated`)
    } catch (err) { toast.error(`Error: ${err.message}`) }
  }

  async function applyMeritocratic() {
    if (rankedList.length < 4) { toast.error('At least 4 evaluated referees required to auto-assign the 4 finals (1 per final). Assign manually if you have fewer.'); return }
    const snake = snakeFinals(rankedList.map((r) => r.id))
    try {
      await supabase.from('court_assignments').delete()
        .eq('tournament_id', tournamentId).eq('day_number', dayNumber)
        .eq('session_order', FINALS_SESSION_ORDER)
        .in('court', [...FINALS_COURT_NAMES, ...LEGACY_FINALS_COURT_NAMES])
      const rows = []
      for (const court of FINALS_COURT_NAMES)
        for (const role of FINALS_ROLES)
          if (snake[court][role]) rows.push({
            tournament_id: tournamentId, referee_id: snake[court][role], day_number: dayNumber,
            section_number: FINALS_SECTION_NUMBER, court, session_order: FINALS_SESSION_ORDER, role,
          })
      if (rows.length) await courtAssignmentService.bulkCreate(rows)
      await loadFinals()
      toast.success('Finals assigned (merit-based)')
    } catch (err) { toast.error(`Error: ${err.message}`) }
  }

  // ─── Line judges (finals) ───────────────────────────────────────────────────
  // Least-performing referees of THIS tournament, worst score first, with
  // unevaluated referees at the bottom.
  const lineJudge = useCallback((court, role) => {
    const row = finalsRows.find((r) => r.court === court && r.role === role)
    return row ? row.referee_id : ''
  }, [finalsRows])

  // Candidates for a final's line judges: all tournament referees EXCEPT that
  // final's two referees (R1/R2), ordered worst-first.
  const ljCandidates = useCallback((court) => {
    const excluded = new Set([lineJudge(court, 'R1'), finalsSlot(court, 'R1'), finalsSlot(court, 'R2')].filter(Boolean))
    return [...assignedReferees]
      .filter((r) => !excluded.has(r.id))
      .sort((a, b) => {
        const sa = scoreById[a.id], sb = scoreById[b.id]
        if (sa == null && sb == null) return refereeName(a).localeCompare(refereeName(b))
        if (sa == null) return 1
        if (sb == null) return -1
        return sa - sb // worst first
      })
  }, [assignedReferees, scoreById, finalsSlot, lineJudge])

  async function setLineJudge(court, role, refId) {
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
    } catch (err) { toast.error(`Error: ${err.message}`) }
  }

  // Auto-propose the 4 least-performing referees as line judges for a final.
  async function autoProposeLineJudges(court) {
    const r1 = finalsSlot(court, 'R1'), r2 = finalsSlot(court, 'R2')
    const excluded = new Set([r1, r2].filter(Boolean))
    const picks = [...assignedReferees]
      .filter((r) => !excluded.has(r.id))
      .sort((a, b) => {
        const sa = scoreById[a.id], sb = scoreById[b.id]
        if (sa == null && sb == null) return refereeName(a).localeCompare(refereeName(b))
        if (sa == null) return 1
        if (sb == null) return -1
        return sa - sb
      })
      .slice(0, 4)
      .map((r) => r.id)
    try {
      // Replace any existing LJ rows for this final, then insert the new picks.
      const existingLJ = finalsRows.filter((r) => r.court === court && FINALS_LINE_ROLES.includes(r.role))
      for (const row of existingLJ) await supabase.from('court_assignments').delete().eq('id', row.id)
      const rows = picks.map((id, i) => ({
        tournament_id: tournamentId, referee_id: id, day_number: dayNumber,
        section_number: FINALS_SECTION_NUMBER, court, session_order: FINALS_SESSION_ORDER, role: FINALS_LINE_ROLES[i],
      }))
      if (rows.length) await courtAssignmentService.bulkCreate(rows)
      await loadFinals()
      toast.success(`${picks.length} line judges proposed for ${court}`)
    } catch (err) { toast.error(`Error: ${err.message}`) }
  }

  const isLastDay = dayNumber === totalDays

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
    if (genCurrentRounds.length === 0) { toast.error('No rounds to send'); return }
    const lang = await requestLanguage(); if (!lang) return
    const msg = buildDesignationMessage({ tournament, dayNumber, assignments: blockAssignments(genCurrentRounds), lang })
    shareToWhatsApp(msg)
  }
  async function handleCopy() {
    if (genCurrentRounds.length === 0) { toast.error('No rounds to copy'); return }
    const lang = await requestLanguage(); if (!lang) return
    const msg = buildDesignationMessage({ tournament, dayNumber, assignments: blockAssignments(genCurrentRounds), lang })
    await copyDesignationMessage(msg); toast.success(`Copied — ${blockLabel(genCurrentRounds)}`)
  }
  async function handlePDF() {
    const lang = await requestLanguage(); if (!lang) return
    try {
      const blob = await generateDesignationPDF({ tournament, dayNumber, assignments: flatAssignments, lang })
      downloadPDF(blob, `designations-${tournament?.name || 'tournament'}-day${dayNumber}.pdf`)
    } catch (err) { toast.error(`PDF failed: ${err.message}`) }
  }

  // Build the finals + line-judges block for the day report (last day only)
  function buildFinalsForReport() {
    return FINALS_COURT_NAMES.map((court) => ({
      court,
      referees: FINALS_ROLES.map((role) => nameOf(finalsSlot(court, role))).filter((n) => n !== '—').join(' & '),
      lineJudges: FINALS_LINE_ROLES.map((role) => nameOf(lineJudge(court, role))).filter((n) => n !== '—').join(', '),
    }))
  }

  // ── Day report (PDF, English, rule-based advice) ──────────────────────────
  async function handleDayReport() {
    if (giri.length === 0) { toast.error('Generate the rotation before exporting a report'); return }
    setBusy(true)
    try {
      const { data: evals } = await evaluationService.getByTournament(tournamentId)
      const dayEvals = (evals || []).filter((e) => e.day_number === dayNumber)
      const stats = computeDayStats({ giri, rosterIds, refById, courts, evaluations: dayEvals })
      const tips = dayAdvice(stats)
      const times = giri.length > 0 ? { start: roundTime(0), end: roundTime(giri.length) } : null
      const finals = isLastDay ? buildFinalsForReport() : null
      const blob = await generateDayReportPDF({ tournament, dayNumber, stats, tips, times, finals })
      downloadPDF(blob, `day${dayNumber}-report-${tournament?.name || 'tournament'}.pdf`)
      toast.success('Day report generated')
    } catch (err) { console.error(err); toast.error(`Report failed: ${err.message}`) }
    finally { setBusy(false) }
  }

  // ── Full tournament report (all days, for the commission) ─────────────────
  async function handleTournamentReport() {
    setBusy(true)
    try {
      const { data: all } = await supabase
        .from('court_assignments')
        .select('*, referees(*)')
        .eq('tournament_id', tournamentId)
        .neq('session_order', FINALS_SESSION_ORDER)
        .order('day_number').order('session_order').order('court')
      const { data: evals } = await evaluationService.getByTournament(tournamentId)

      const byDay = {}
      for (const row of all || []) { (byDay[row.day_number] = byDay[row.day_number] || []).push(row) }

      const dayReports = []
      for (const dn of Object.keys(byDay).map(Number).sort((a, b) => a - b)) {
        const rows = byDay[dn]
        const maxSO = Math.max(...rows.map((r) => r.session_order))
        const dayGiri = []
        for (let so = 1; so <= maxSO; so++) {
          dayGiri.push({ courts: courts.map((cn) => {
            const row = rows.find((r) => r.session_order === so && r.court === cn)
            return row ? row.referee_id : null
          }) })
        }
        const dayRoster = [...new Set(rows.map((r) => r.referee_id))]
        const refMap = {}
        rows.forEach((r) => { if (r.referees) refMap[r.referee_id] = r.referees })
        const dayEvals = (evals || []).filter((e) => e.day_number === dn)
        const stats = computeDayStats({ giri: dayGiri, rosterIds: dayRoster, refById: refMap, courts, evaluations: dayEvals })
        dayReports.push({ dayNumber: dn, stats })
      }

      if (dayReports.length === 0) { toast.error('No assignment data to report yet'); return }
      const tStats = computeTournamentStats(dayReports)
      const tTips = tournamentAdvice(tStats)
      const blob = await generateTournamentReportPDF({ tournament, tStats, tTips, dayReports })
      downloadPDF(blob, `tournament-report-${tournament?.name || 'tournament'}.pdf`)
      toast.success('Tournament report generated')
    } catch (err) { console.error(err); toast.error(`Report failed: ${err.message}`) }
    finally { setBusy(false) }
  }

  // ─── Invio designazioni personali (WhatsApp, 2 round alla volta, lingua per arbitro) ──
  const [blockIdx, setBlockIdx] = useState(0)
  const blocks = useMemo(() => {
    const out = []
    for (let i = 0; i < giri.length; i += 2) {
      out.push(Array.from({ length: Math.min(2, giri.length - i) }, (_, k) => i + k + 1))
    }
    return out
  }, [giri.length])
  useEffect(() => {
    if (blockIdx > blocks.length - 1) setBlockIdx(Math.max(0, blocks.length - 1))
  }, [blocks.length, blockIdx])
  const currentRounds = blocks[blockIdx] || []

  // ─── Invio messaggio GENERALE per blocco di 2 round (selettore indipendente) ──
  const [genBlockIdx, setGenBlockIdx] = useState(0)
  useEffect(() => {
    if (genBlockIdx > blocks.length - 1) setGenBlockIdx(Math.max(0, blocks.length - 1))
  }, [blocks.length, genBlockIdx])
  const genCurrentRounds = blocks[genBlockIdx] || []

  // Etichetta blocco, es. "Round 1–2"
  function blockLabel(b) {
    if (!b || b.length === 0) return '—'
    return `Round ${b[0]}${b.length > 1 ? `–${b[b.length - 1]}` : ''}`
  }

  // Solo le designazioni dei round del blocco selezionato
  function blockAssignments(roundsArr) {
    const set = new Set(roundsArr)
    return flatAssignments.filter((a) => set.has(a.session_order))
  }

  // Anteprima (per il coach) di cosa farà l'arbitro nei round del blocco
  function blockPreview(refId) {
    if (currentRounds.length === 0) return '—'
    return currentRounds.map((r) => {
      const ci = giri[r - 1]?.courts.findIndex((x) => x === refId)
      return ci != null && ci >= 0 ? `R${r} ${courts[ci]}` : `R${r} Rest`
    }).join(' · ')
  }

  function sendPersonal(refId, lang) {
    const referee = refById[refId]
    if (!referee) return
    sharePersonalToReferee({ referee, tournament, dayNumber, assignments: flatAssignments, lang, rounds: currentRounds })
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">
      <Header title="Assignments" subtitle={tournament?.name} />

      {/* Selectors + brand tabs */}
      <div style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY2})` }} className="text-white px-4 pt-3 pb-3">
        <div className="flex gap-2 mb-3">
          <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)}
            className="flex-1 rounded-lg px-3 py-2 bg-white text-gray-900 text-sm font-semibold border border-white/20 shadow-sm">
            {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={dayNumber} onChange={(e) => setDayNumber(Number(e.target.value))}
            className="rounded-lg px-3 py-2 bg-white text-gray-900 text-sm font-semibold border border-white/20 shadow-sm">
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Day {d}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {[['gironi', 'Rounds'], ['finali', 'Finals']].map(([k, label]) => (
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
          {/* Check-in presenti — lista con interruttori */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Attendance · {presentRefs.length}/{assignedReferees.length}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAllPresence(true)} style={{ background: NAVY }}
                  className="text-xs font-bold px-3 py-1 rounded-lg text-white">All</button>
                <button onClick={() => setAllPresence(false)}
                  className="text-xs font-bold px-3 py-1 rounded-lg bg-white border border-gray-300 text-gray-600">None</button>
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-auto max-h-[55vh]">
              {assignedReferees.length === 0 && (
                <div className="px-4 py-4 text-sm text-gray-500">No referees assigned to this tournament.</div>
              )}
              {sortedReferees.map((r) => {
                const on = isPresent(r.id)
                return (
                  <button key={r.id} onClick={() => togglePresence(r.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left active:bg-gray-50">
                    <span className={`text-base font-semibold ${on ? 'text-gray-900' : 'text-gray-400'}`}>{refereeName(r)}</span>
                    <span className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
                      style={{ background: on ? NAVY : '#D1D5DB' }}>
                      <span className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
                        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }} />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Staffing warning — too few referees for the number of courts */}
          {staffing && staffing.level !== 'ok' && (
            <div className="px-4 mb-2">
              <div className={`rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 border ${
                staffing.level === 'critical'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  {staffing.level === 'critical' ? (
                    <><b>{staffing.present} referees for {staffing.nc} courts.</b> With this many no one can rest — every referee works every round. Add referees or reduce courts.</>
                  ) : (
                    <><b>{staffing.present} referees for {staffing.nc} courts</b> (only {staffing.resting} resting per round). Referees will work several rounds in a row with little rest. For comfortable rotation use at least {Math.ceil(staffing.nc * 1.5)} referees.</>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Courts selector (3 / 4) — shared with Evaluate via localStorage */}
          <div className="px-4 pt-1 pb-1 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Courts</span>
            <div className="flex gap-1.5">
              {[3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => changeNCourts(n)}
                  disabled={busy}
                  className={
                    'px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-150 disabled:opacity-50 ' +
                    (nCourts === n
                      ? 'bg-[#2D3270] text-white border border-[#2D3270]'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300')
                  }
                >
                  {n} courts
                </button>
              ))}
            </div>
          </div>

          {/* Azioni rotazione */}
          <div className="px-4 flex gap-2 items-center">
            <button onClick={genNext} disabled={busy}
              style={{ background: ORANGE }} className="flex-1 rounded-xl text-white text-base font-bold py-3 shadow flex items-center justify-center gap-2 disabled:opacity-60">
              <Shuffle size={18} /> {busy ? 'Generating…' : (giri.length === 0 ? 'Generate first 2 rounds' : 'Generate next 2 rounds')}
            </button>
            <button onClick={removeLastTwo} disabled={busy || giri.length === 0} title="Remove last 2 rounds"
              className="rounded-xl bg-white border border-gray-300 text-gray-600 w-12 h-12 flex items-center justify-center disabled:opacity-40"><Minus size={20} /></button>
          </div>

          {/* Azzera giorno */}
          <div className="px-4 mt-2 flex justify-end">
            <button onClick={resetDay} disabled={busy}
              className="text-sm font-semibold text-red-600 flex items-center gap-1 disabled:opacity-50">
              <RotateCcw size={14} /> Reset day (rotation + attendance)
            </button>
          </div>

          {/* Giri */}
          <div className="px-4 pt-3 space-y-3">
            {giri.length === 0 && (
              <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center text-gray-500 text-sm">
                Mark present referees and tap <b>Generate first 2 rounds</b>.
              </div>
            )}
            {giri.map((g, gi) => {
              const rest = restFor(g.courts)
              return (
                <div key={gi} className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                  <div style={{ background: NAVY }} className="text-white px-4 py-2 flex items-center justify-between">
                    <span className="text-lg font-bold uppercase tracking-wide flex items-center gap-2">
                      Round {gi + 1}
                      <span className="text-white/60 text-sm font-normal flex items-center gap-1 normal-case tracking-normal">
                        <Clock size={12} />{roundTime(gi)}
                      </span>
                    </span>
                    <span className="text-white/50 text-xs">{g.courts.filter(Boolean).length} simultaneous matches</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    {g.courts.map((id, ci) => (
                      <button key={ci} onClick={() => setPicker({ mode: 'court', giro: gi, court: ci })}
                        className="rounded-xl border-2 border-emerald-300 bg-emerald-50 active:bg-emerald-100 px-2 py-3 text-center min-h-[70px] flex flex-col items-center justify-center">
                        <span className="text-[11px] font-bold uppercase text-emerald-700 tracking-wide">{courts[ci]}</span>
                        <span className="text-lg font-bold leading-tight mt-0.5">{nameOf(id)}</span>
                        {id && (
                          globalScoreById[id]?.avg_score != null ? (
                            <span className="text-[11px] font-bold leading-none mt-1" style={{ color: scoreColorHex(globalScoreById[id].avg_score) }}>
                              ★ {globalScoreById[id].avg_score.toFixed(1)}{globalScoreById[id].total_evaluations ? ` · ${globalScoreById[id].total_evaluations}` : ''}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 leading-none mt-1">n/d</span>
                          )
                        )}
                      </button>
                    ))}
                  </div>
                  {rest.length > 0 && (
                    <div className="px-3 pb-3">
                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                        <span className="text-[11px] font-bold uppercase text-amber-700 tracking-wide flex items-center gap-1"><Coffee size={12} /> Resting</span>
                        <div className="text-base font-semibold text-amber-900 leading-tight">{rest.map(nameOf).join(' · ')}</div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Day summary + time config */}
          {giri.length > 0 && (
            <div className="px-4 mt-4">
              <div className="rounded-2xl bg-navy/5 border border-navy/10 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <span className="font-bold text-gray-700 flex items-center gap-1"><Clock size={14} /> {giri.length} rounds · {roundTime(0)} → ~{estimatedEnd()}</span>
                  <span className="text-gray-500">· avg {Math.round(rosterIds.length > 0 ? (giri.length * courts.length) / rosterIds.length : 0)} matches/ref</span>
                </div>
                <button onClick={() => setShowTimeCfg(v => !v)} className="text-xs font-bold text-gray-500 flex items-center gap-1 hover:text-gray-800">
                  <Settings2 size={13} /> Times
                </button>
              </div>
              {showTimeCfg && (
                <div className="mt-2 rounded-2xl bg-white border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
                  <div>
                    <div className="text-xs font-bold text-gray-500 mb-1">Day start time</div>
                    <input type="time" value={dayStart} onChange={(e) => updateDayStart(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-semibold" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-500 mb-1">Round duration (min)</div>
                    <input type="number" min="30" max="120" value={roundDuration}
                      onChange={(e) => updateRoundDuration(parseInt(e.target.value, 10) || 55)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-semibold w-20" />
                  </div>
                  <div className="text-xs text-gray-400 self-end pb-1.5">Settings saved on this device</div>
                </div>
              )}
            </div>
          )}

          {/* Referee workload */}
          {giri.length > 0 && (
            <div className="px-4 mt-4">
              <div className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">Referee workload ({giri.length} rounds)</div>
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

          {/* General message — per 2-round block */}
          {giri.length > 0 && (
            <div className="px-4 mt-4">
              <div className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-1">General message</div>
              <div className="text-xs text-gray-400 mb-2">Send the rotation to the group in blocks of 2 rounds. Pick the block, then send.</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {blocks.map((b, i) => (
                  <button key={i} onClick={() => setGenBlockIdx(i)}
                    style={i === genBlockIdx ? { background: NAVY, color: '#fff' } : {}}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold border ${i === genBlockIdx ? '' : 'bg-white border-gray-300 text-gray-600'}`}>
                    {blockLabel(b)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleWhatsApp} className="rounded-xl bg-green-600 text-white text-sm font-bold py-3 flex items-center justify-center gap-1.5">
                  <MessageCircle size={16} /> WhatsApp · {blockLabel(genCurrentRounds)}
                </button>
                <button onClick={handleCopy} className="rounded-xl bg-gray-700 text-white text-sm font-bold py-3 flex items-center justify-center gap-1.5">
                  <Copy size={16} /> Copy
                </button>
              </div>
              <button onClick={handlePDF} style={{ background: NAVY }}
                className="mt-2 w-full rounded-xl text-white text-sm font-bold py-3 flex items-center justify-center gap-1.5">
                <Download size={16} /> Full-day PDF
              </button>
            </div>
          )}

          {/* Designazioni personali — 2 round alla volta, lingua a scelta per arbitro */}
          {giri.length > 0 && (
            <div className="px-4 mt-4">
              <div className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-1">Personal assignments</div>
              <div className="text-xs text-gray-400 mb-2">Rounds are sent in blocks of 2. Choose the block, then the language for each referee.</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {blocks.map((b, i) => (
                  <button key={i} onClick={() => setBlockIdx(i)}
                    style={i === blockIdx ? { background: NAVY, color: '#fff' } : {}}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold border ${i === blockIdx ? '' : 'bg-white border-gray-300 text-gray-600'}`}>
                    Round {b[0]}{b.length > 1 ? `–${b[b.length - 1]}` : ''}
                  </button>
                ))}
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {rosterIds.map((id) => {
                  const r = refById[id]
                  const hasPhone = Boolean(r?.phone)
                  return (
                    <div key={id} className="flex items-center justify-between px-3 py-2.5 gap-2">
                      <div className="min-w-0">
                        <div className="text-base font-semibold truncate">{nameOf(id)}</div>
                        <div className="text-xs text-gray-400 truncate">{blockPreview(id)}{hasPhone ? '' : ' · no phone'}</div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {['en', 'fr', 'nl'].map((lng) => (
                          <button key={lng} onClick={() => sendPersonal(id, lng)}
                            className="rounded-lg bg-green-600 text-white text-xs font-bold px-2.5 py-2 uppercase">
                            {lng}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Reports (daily + full tournament) */}
          {giri.length > 0 && (
            <div className="px-4 mt-4">
              <div className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-1">Reports</div>
              <div className="text-xs text-gray-400 mb-2">End-of-day analysis with workload metrics and coach suggestions. PDF, in English, for the commission.</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleDayReport} disabled={busy} style={{ background: NAVY }}
                  className="rounded-xl text-white text-sm font-bold py-3 flex items-center justify-center gap-1.5 disabled:opacity-60">
                  <FileText size={16} /> Day {dayNumber} report
                </button>
                <button onClick={handleTournamentReport} disabled={busy}
                  className="rounded-xl bg-gray-700 text-white text-sm font-bold py-3 flex items-center justify-center gap-1.5 disabled:opacity-60">
                  <FileText size={16} /> Full tournament
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'finali' && (
        <div className="pb-24 px-4 pt-3">
          <button onClick={applyMeritocratic} style={{ background: ORANGE }}
            className="w-full rounded-xl text-white text-base font-bold py-3 shadow flex items-center justify-center gap-2 mb-3">
            <Star size={18} /> Auto-assign (merit-based, top 4)
          </button>
          <p className="text-sm text-gray-500 leading-relaxed mb-3">
            The 4 best-ranked referees cover the four finals (PRO &amp; Challenge, men &amp; women) — one referee per final, no line judges (official 2★/3★ directive). Best score goes to the PRO final. Tap a slot to change manually.
          </p>

          {FINALS_COURT_NAMES.map((court) => (
            <div key={court} className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden mb-3">
              <div style={{ background: NAVY }} className="text-white px-4 py-2 flex items-center justify-between">
                <span className="text-lg font-bold uppercase tracking-wide flex items-center gap-2"><Trophy size={16} /> {court}</span>
                <span className="text-white/50 text-xs">1 referee</span>
              </div>
              <div className="grid grid-cols-1 gap-2 p-3">
                {FINALS_ROLES.map((role) => {
                  const id = finalsSlot(court, role)
                  const pos = id ? rankedList.findIndex((r) => r.id === id) + 1 : 0
                  return (
                    <button key={role} onClick={() => setPicker({ mode: 'final', court, role })}
                      style={{ borderColor: ORANGE, background: '#FFF4EF' }}
                      className="rounded-xl border-2 px-2 py-3 text-center min-h-[88px] flex flex-col items-center justify-center gap-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Referee</span>
                      <span className="text-xl font-bold leading-tight">{nameOf(id)}</span>
                      {id && scoreById[id] != null && <span className="text-xs font-semibold text-gray-500">#{pos} · {scoreById[id].toFixed(1)}/5</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Tournament rankings */}
          <div className="mt-3">
            <div className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">Rankings (this tournament)</div>
            <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {rankedList.length === 0 && <div className="px-4 py-4 text-sm text-gray-500">No evaluations recorded for this tournament.</div>}
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
                <div className="text-lg font-bold uppercase mb-1">Round {picker.giro + 1} · {courts[picker.court]}</div>
                <div className="text-sm text-gray-500 mb-3">Pick a referee — the badge shows if it respects the rotation</div>
                <div className="grid grid-cols-1 gap-2">
                  {[...rosterIds]
                    .sort((a, b) => (ASSESS_ORDER[pickerAssessments[a]?.level] ?? 9) - (ASSESS_ORDER[pickerAssessments[b]?.level] ?? 9))
                    .map((id) => {
                    const a = pickerAssessments[id] || { level: 'ok', label: 'OK', detail: '' }
                    const pill = {
                      best:    'bg-emerald-100 text-emerald-800 border-emerald-300',
                      swap:    'bg-blue-100 text-blue-800 border-blue-300',
                      ok:      'bg-gray-100 text-gray-600 border-gray-300',
                      caution: 'bg-amber-100 text-amber-800 border-amber-300',
                      danger:  'bg-red-100 text-red-800 border-red-300',
                      current: 'bg-slate-200 text-slate-600 border-slate-300',
                    }[a.level]
                    const cardBorder = {
                      best: 'border-emerald-300 bg-emerald-50', swap: 'border-blue-200 bg-blue-50',
                      ok: 'border-gray-200 bg-gray-50', caution: 'border-amber-200 bg-amber-50',
                      danger: 'border-red-200 bg-red-50', current: 'border-slate-300 bg-slate-100',
                    }[a.level]
                    return (
                      <button key={id} disabled={a.level === 'current'}
                        onClick={() => chooseCourtRef(id)}
                        className={`rounded-xl py-2.5 px-3 border-2 text-left ${cardBorder} ${a.level === 'current' ? 'opacity-60 cursor-default' : 'active:scale-[0.99]'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-base font-bold leading-tight">{nameOf(id)}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${pill}`}>{a.label}</span>
                        </div>
                        <div className="text-xs font-medium text-gray-500 mt-0.5">
                          {a.detail}{globalScoreById[id]?.avg_score != null ? ` · ★ ${globalScoreById[id].avg_score.toFixed(1)}` : ''}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold uppercase mb-1">{picker.court} · {picker.role}</div>
                <div className="text-sm text-gray-500 mb-3">Select referee (ranked by score)</div>
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
                    ✕ Clear slot
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
