import { trackSave } from '../lib/saveTracker'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useReferees } from '../hooks/useReferees'
import { useTournaments } from '../hooks/useTournaments'
import { useEvaluations } from '../hooks/useEvaluations'
import { evaluationService } from '../lib/supabase'
import { courtAssignmentService, matchService, designationService } from '../lib/supabase'
import { useAppStore } from '../store/appStore'
import { CRITERIA, computeScore, SCORE_LABELS, getGrade } from '../lib/scoring'
import { generateEvaluationPDF, downloadPDF, sharePDFWhatsApp } from '../lib/pdf'
import { shareEvaluationToReferee } from '../lib/whatsapp'
import { translateToEnglish, lookupRuleReference } from '../lib/anthropic'
import { useDocLanguage } from '../context/LanguageGate'
import { cn, refereeName, roleColor, scoreColor } from '../lib/utils'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Select, Textarea } from '../components/ui/Input'
import { ScoreCircle } from '../components/ui/ScoreCircle'
import { Badge } from '../components/ui/Badge'
import { toast } from '../components/ui/Toast'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Share2,
  Save,
  Pencil,
  CheckCircle,
  Search,
  X,
  Languages,
  BookMarked,
} from 'lucide-react'

// ─── Schedule game helpers (per "By game" picker) ────────────────────────────
function hhmm(t) {
  if (!t) return ''
  const s = String(t)
  const m = s.match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s
}
function gameTag(m) {
  const ser = m.series === 'PRO' ? 'PRO' : 'CH'
  const gen = m.gender === 'M' ? 'Heren' : 'Dames'
  return `${ser} ${gen}${m.round ? ` ${m.round}` : ''}`.trim()
}
function gameLabel(m) {
  const teams = m.team1 && m.team2 ? ` · ${m.team1} / ${m.team2}` : ''
  return `#${m.match_number} · ${gameTag(m)} · ${hhmm(m.scheduled_time)} · C${m.court}${teams}`
}

// ─── Score button color map ───────────────────────────────────────────────────

const SCORE_COLORS = {
  1: {
    active: 'bg-red-500 text-white ring-2 ring-red-400 ring-offset-1 ring-offset-white scale-[1.04]',
    idle:   'bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20',
  },
  2: {
    active: 'bg-orange-500 text-white ring-2 ring-orange-400 ring-offset-1 ring-offset-white scale-[1.04]',
    idle:   'bg-orange-500/10 text-orange-400 border border-orange-500/25 hover:bg-orange-500/20',
  },
  3: {
    active: 'bg-yellow-500 text-white ring-2 ring-yellow-400 ring-offset-1 ring-offset-white scale-[1.04]',
    idle:   'bg-yellow-500/10 text-yellow-400 border border-yellow-500/25 hover:bg-yellow-500/20',
  },
  4: {
    active: 'bg-green-500 text-gray-900 ring-2 ring-green-400 ring-offset-1 ring-offset-white scale-[1.04]',
    idle:   'bg-green-500/10 text-green-400 border border-green-500/25 hover:bg-green-500/20',
  },
  5: {
    active: 'bg-emerald-500 text-white ring-2 ring-emerald-400 ring-offset-1 ring-offset-white scale-[1.04]',
    idle:   'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20',
  },
}

// ─── Three-step protocol strip ────────────────────────────────────────────────

function ThreeStepProtocol() {
  return (
    <div className="rounded-lg bg-[#2D3270]/5 border border-[#2D3270]/30 p-3 mb-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2.5">
        Three-Step Protocol
      </p>
      <div className="flex flex-col gap-2">
        {[
          { num: '01', title: 'WHISTLE', desc: 'Immediate & decisive' },
          { num: '02', title: 'INFORMATION GATHERING', desc: 'Brief, visible, systematic' },
          { num: '03', title: 'SIGNAL DECISION', desc: 'Correct official hand signal' },
        ].map((step) => (
          <div key={step.num} className="flex items-start gap-2.5">
            <span className="text-[10px] font-black text-[#E85D26] w-5 shrink-0 pt-px">
              {step.num}
            </span>
            <div className="leading-tight">
              <span className="text-xs font-bold text-gray-900">{step.title}</span>
              <span className="text-xs text-gray-600"> — {step.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Referee search/select ────────────────────────────────────────────────────

function RefereeSelector({ referees, value, onChange, error }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  const sorted = useMemo(
    () => [...referees].sort((a, b) => a.last_name.localeCompare(b.last_name)),
    [referees]
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted
    const q = query.toLowerCase()
    return sorted.filter(
      (r) =>
        r.last_name.toLowerCase().includes(q) ||
        r.first_name.toLowerCase().includes(q)
    )
  }, [sorted, query])

  const selected = referees.find((r) => r.id === value)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Referee <span className="text-red-400">*</span>
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-between bg-gray-50 border rounded-lg px-3 py-3',
          'text-sm transition-colors duration-150 text-left w-full',
          error
            ? 'border-red-500/50'
            : open
            ? 'border-[#E85D26]/60 ring-1 ring-[#E85D26]/30'
            : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <span className={selected ? 'text-gray-900 font-medium' : 'text-gray-500'}>
          {selected ? refereeName(selected) : 'Select referee…'}
        </span>
        <ChevronDown size={16} className="text-gray-500 shrink-0" />
      </button>

      {open && (
        <div className="relative z-50">
          <div className="absolute top-0 left-0 right-0 bg-gray-50 border border-gray-300 rounded-xl shadow-2xl overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200">
              <Search size={14} className="text-gray-500 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name…"
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-500 hover:text-gray-900">
                  <X size={13} />
                </button>
              )}
            </div>
            {/* List */}
            <ul className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-gray-500 text-center">No referees found</li>
              ) : (
                filtered.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(r.id)
                        setOpen(false)
                        setQuery('')
                      }}
                      className={cn(
                        'w-full text-left px-4 py-3 text-sm transition-colors',
                        r.id === value
                          ? 'bg-[#E85D26]/15 text-[#E85D26] font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <span className="font-medium">{r.last_name}</span>{' '}
                      <span className="text-gray-500">{r.first_name}</span>
                      {r.level && (
                        <span className="ml-2 text-[10px] text-gray-500">Lv.{r.level}</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

// ─── Number stepper ───────────────────────────────────────────────────────────

function NumberStepper({ label, value, onChange, min = 1, max = 99 }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="flex items-center gap-0">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, (value || min) - 1))}
          className="w-10 h-10 flex items-center justify-center bg-gray-50 border border-gray-300 rounded-l-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors text-lg font-bold"
        >
          −
        </button>
        <div className="flex-1 h-10 flex items-center justify-center bg-gray-50 border-y border-gray-300 text-gray-900 text-sm font-bold min-w-[2.5rem] text-center">
          {value || min}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, (value || min) + 1))}
          className="w-10 h-10 flex items-center justify-center bg-gray-50 border border-gray-300 rounded-r-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors text-lg font-bold"
        >
          +
        </button>
      </div>
    </div>
  )
}

// ─── Criterion card ───────────────────────────────────────────────────────────

// Reusable note textarea with auto-translate-to-English (on blur) + manual button.
// Writes in any language; output is English so PDF/WhatsApp are always in English.
function NoteField({ value, onChange, placeholder, rows = 2, autoOpenLabel, ruleLookup = false }) {
  const [busy, setBusy] = useState(false)
  const [refBusy, setRefBusy] = useState(false)
  const focusValueRef = useRef('')

  async function runTranslate(text, { silent = false } = {}) {
    const t = (text ?? value ?? '').trim()
    if (!t || busy) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (!silent) toast.error('Translation needs an internet connection')
      return
    }
    setBusy(true)
    try {
      const en = await translateToEnglish(t)
      if (en && en.trim() && en.trim() !== t) onChange(en.trim())
    } catch (err) {
      console.error('translate error', err)
      if (!silent) toast.error('Translation failed — please try again')
    } finally {
      setBusy(false)
    }
  }

  async function runRuleRef() {
    const t = (value ?? '').trim()
    if (!t || refBusy) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.error('Rule lookup needs an internet connection')
      return
    }
    setRefBusy(true)
    try {
      const ref = await lookupRuleReference(t)
      if (ref && ref.trim()) {
        const base = value.replace(/\n*📖[\s\S]*$/, '').trimEnd() // replace a previous reference if present
        onChange(`${base}\n\n📖 ${ref.trim()}`)
      } else {
        toast.info('No rule reference found in the loaded documents')
      }
    } catch (err) {
      console.error('rule ref error', err)
      toast.error(err.message || 'Rule lookup failed')
    } finally {
      setRefBusy(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        {autoOpenLabel && (
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{autoOpenLabel}</label>
        )}
        <div className="ml-auto flex items-center gap-2">
          {(busy || refBusy) && <span className="text-[10px] text-gray-400 animate-pulse">{refBusy ? 'Finding rule…' : 'Translating…'}</span>}
          {ruleLookup && (
            <button
              type="button"
              onClick={runRuleRef}
              disabled={refBusy || !value?.trim()}
              title="Find the rule (Rulebook + Casebook + Guidelines)"
              className="text-[10px] font-bold uppercase tracking-wide text-[#2D3270] flex items-center gap-1 disabled:opacity-40"
            >
              <BookMarked size={13} /> Rule
            </button>
          )}
          <button
            type="button"
            onClick={() => runTranslate(value)}
            disabled={busy || !value?.trim()}
            title="Translate to English"
            className="text-[10px] font-bold uppercase tracking-wide text-[#E85D26] flex items-center gap-1 disabled:opacity-40"
          >
            <Languages size={13} /> Translate
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => { focusValueRef.current = e.target.value }}
        onBlur={(e) => {
          const v = e.target.value
          // Auto-translate only if the user actually typed something new
          if (v.trim() && v !== focusValueRef.current) runTranslate(v, { silent: true })
        }}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          'w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2',
          'text-gray-900 placeholder-gray-400 text-sm resize-none',
          'focus:outline-none focus:border-[#E85D26]/60 focus:ring-1 focus:ring-[#E85D26]/30',
          'transition-colors duration-150'
        )}
      />
    </div>
  )
}

function CriterionCard({ criterion, score, repeat, note, onScore, onRepeat, onNote, error }) {
  const [descOpen, setDescOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(!!note)

  return (
    <Card className={cn('overflow-hidden', error && 'border-red-500/40')}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 leading-tight">{criterion.label}</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="navy" size="xs">{criterion.weight}%</Badge>
            <button
              type="button"
              onClick={() => setDescOpen((v) => !v)}
              className="p-1 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              aria-label="Toggle description"
            >
              {descOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Description (collapsible) */}
        {descOpen && (
          <p className="mt-2 text-xs text-gray-500 leading-relaxed">{criterion.description}</p>
        )}
      </CardHeader>

      <CardBody className="pt-3 space-y-3">
        {/* Three-step protocol for signals */}
        {criterion.threeStep && <ThreeStepProtocol />}

        {/* Score buttons: 5 large tap targets */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Score <span className="text-red-400">*</span>
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((val) => {
              const isActive = score === val
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => onScore(val)}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-xl min-h-[3.25rem] py-2 px-1',
                    'font-bold transition-all duration-150 select-none',
                    isActive ? SCORE_COLORS[val].active : SCORE_COLORS[val].idle
                  )}
                >
                  <span className="text-lg leading-none">{val}</span>
                  <span className="text-[9px] font-medium leading-tight mt-0.5 text-center opacity-80">
                    {SCORE_LABELS[val].split(' ')[0]}
                  </span>
                </button>
              )
            })}
          </div>
          {error && (
            <p className="text-xs text-red-400 mt-1">Please select a score</p>
          )}
        </div>

        {/* Repeat fault toggle */}
        <button
          type="button"
          onClick={() => onRepeat(!repeat)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150',
            repeat
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-700'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
          )}
        >
          <AlertTriangle size={14} className={repeat ? 'text-amber-600' : 'text-gray-600'} />
          <span>Repeated Fault</span>
          {repeat && (
            <span className="ml-auto text-xs text-amber-500 font-normal">
              −0.5 penalty applied
            </span>
          )}
        </button>

        {/* Notes (collapsible) */}
        {!noteOpen ? (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
          >
            <span className="text-[#E85D26]">+</span> Add observation note
          </button>
        ) : (
          <NoteField
            value={note}
            onChange={onNote}
            placeholder="What did you observe? Be specific…"
            rows={2}
            autoOpenLabel="Observation"
            ruleLookup
          />
        )}
      </CardBody>
    </Card>
  )
}

// ─── Live score bar (sticky bottom) ──────────────────────────────────────────

function LiveScoreBar({ scores, repeats }) {
  const result = useMemo(() => {
    const allSet = Object.values(scores).every((v) => v != null && v > 0)
    if (!allSet) {
      // Compute partial score for whatever's filled
      const partial = computeScore(scores, repeats)
      return { ...partial, partial: true }
    }
    return { ...computeScore(scores, repeats), partial: false }
  }, [scores, repeats])

  const filledCount = Object.values(scores).filter((v) => v != null && v > 0).length
  const grade = result.overall > 0 ? getGrade(result.overall) : null

  return (
    <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 safe-area-pb shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        {/* Progress dots */}
        <div className="flex gap-1 shrink-0">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-colors',
                i <= filledCount ? 'bg-[#E85D26]' : 'bg-gray-200'
              )}
            />
          ))}
        </div>

        {/* Labels */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500">
            {filledCount === 5 ? 'All criteria scored' : `${filledCount}/5 scored`}
          </p>
          {result.penalty > 0 && (
            <p className="text-[10px] text-amber-600 font-medium">
              ⚠ −{result.penalty.toFixed(1)} repeat penalty
            </p>
          )}
        </div>

        {/* Score */}
        {result.overall > 0 && grade ? (
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className={cn('font-display text-2xl font-black', grade.color)}>
                {result.overall.toFixed(1)}
              </p>
              <p className={cn('text-[10px] font-bold leading-none', grade.color)}>
                {grade.grade}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-right shrink-0">
            <p className="font-display text-2xl font-black text-gray-300">—</p>
            <p className="text-[10px] text-gray-600">No score</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── In-progress draft persistence (resume an evaluation after leaving) ───────
// Salva la valutazione in corso in locale, così uscendo dalla pagina e tornando
// si ritrova esattamente dov'era. La bozza è legata al contesto (torneo+giorno+
// arbitro+ruolo) e viene cancellata al salvataggio definitivo.
const LAST_WIP_KEY = 'bvb_eval_wip_last'
const wipKey = (t, d, r, ro) => `bvb_eval_wip::${t || '-'}::${d || '-'}::${r}::${ro}`
function evalHasContent(cd, gn) {
  return Boolean(
    (gn && gn.trim()) ||
    CRITERIA.some((c) => cd[c.key].score || cd[c.key].repeat || (cd[c.key].note && cd[c.key].note.trim()))
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Evaluate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { requestLanguage } = useDocLanguage()

  const { referees, loading: refLoading } = useReferees()
  const { tournaments } = useTournaments()
  const { create } = useEvaluations()
  const {
    lastTournamentId,
    lastDayNumber,
    setLastTournamentId,
    setLastDayNumber,
    saveDraft,
  } = useAppStore()

  // ── Form state ──────────────────────────────────────────────────────────────
  const [refereeId, setRefereeId] = useState(searchParams.get('refereeId') || '')
  const [role, setRole] = useState('R1')
  const [tournamentId, setTournamentId] = useState(
    searchParams.get('tournamentId') || lastTournamentId || ''
  )
  const [dayNumber, setDayNumber] = useState(lastDayNumber || 1)
  const [courtNumber, setCourtNumber] = useState(null)
  const [roundNumber, setRoundNumber] = useState(null)
  // Number of courts (3 or 4), shared with Assignments via localStorage.
  const [nCourts, setNCourts] = useState(() => {
    const v = parseInt(localStorage.getItem('bvb_courts') || '4', 10)
    return v === 3 ? 3 : 4
  })
  function updateNCourts(v) {
    setNCourts(v)
    localStorage.setItem('bvb_courts', String(v))
    if (courtNumber && courtNumber > v) setCourtNumber(null)
  }

  // ── Round-aware selection (mirrors Assignments) ─────────────────────────────
  const [pickMode, setPickMode] = useState('match') // 'match' (schedule games) | 'round' | 'manual'
  const [assignments, setAssignments] = useState([]) // court_assignments rows for the day
  const [loadingAssign, setLoadingAssign] = useState(false)

  // ── Schedule games selection (gare + designazioni da Schedule) ──────────────
  const [schedMatches, setSchedMatches] = useState([])   // matches table rows for the day
  const [schedAssign, setSchedAssign] = useState({})     // { [match_id]: { referee_id, referee } }
  const [loadingSched, setLoadingSched] = useState(false)
  const [schedMatch, setSchedMatch] = useState(null)     // selected match object (drives the label)
  const [schedMatchId, setSchedMatchId] = useState(null) // persisted id (WIP restore)

  // Load the day's assignments whenever tournament/day changes
  useEffect(() => {
    let alive = true
    if (!tournamentId || !dayNumber) { setAssignments([]); return }
    setLoadingAssign(true)
    courtAssignmentService
      .getByDay(tournamentId, dayNumber)
      .then(({ data }) => { if (alive) setAssignments(data || []) })
      .catch(() => { if (alive) setAssignments([]) })
      .finally(() => { if (alive) setLoadingAssign(false) })
    return () => { alive = false }
  }, [tournamentId, dayNumber])

  // Load the day's schedule games + their schedule designations (1 ref per game)
  useEffect(() => {
    let alive = true
    if (!tournamentId || !dayNumber) { setSchedMatches([]); setSchedAssign({}); return }
    setLoadingSched(true)
    Promise.all([
      matchService.getByTournament(tournamentId),
      designationService.getByTournament(tournamentId),
    ])
      .then(([mRes, dRes]) => {
        if (!alive) return
        const mts = (mRes.data || [])
          .filter((m) => (m.day_number || 1) === dayNumber)
          .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || '') || (a.match_number || 0) - (b.match_number || 0))
        setSchedMatches(mts)
        const map = {}
        for (const d of dRes.data || []) {
          if (d.role && d.role !== 'R1') continue
          map[d.match_id] = { referee_id: d.referee_id, referee: d.referees || null }
        }
        setSchedAssign(map)
      })
      .catch(() => { if (alive) { setSchedMatches([]); setSchedAssign({}) } })
      .finally(() => { if (alive) setLoadingSched(false) })
    return () => { alive = false }
  }, [tournamentId, dayNumber])

  // Re-link the selected schedule match after WIP restore (when matches load)
  useEffect(() => {
    if (schedMatchId && !schedMatch && schedMatches.length) {
      const m = schedMatches.find((x) => x.id === schedMatchId)
      if (m) setSchedMatch(m)
    }
  }, [schedMatchId, schedMatch, schedMatches])

  // Only the games that have a designated referee, for the picker
  const designatedGames = useMemo(
    () => schedMatches.filter((m) => schedAssign[m.id]?.referee_id),
    [schedMatches, schedAssign]
  )
  const rounds = useMemo(() => {
    const FINALS = 99
    const bySession = {}
    for (const row of assignments) {
      if (row.session_order === FINALS) continue
      if (!bySession[row.session_order]) bySession[row.session_order] = []
      bySession[row.session_order].push(row)
    }
    return Object.keys(bySession)
      .map((s) => Number(s))
      .sort((a, b) => a - b)
      .map((s) => ({
        round: s,
        courts: bySession[s].sort((a, b) => a.court - b.court),
      }))
  }, [assignments])

  // Per-criterion: score, repeat, note
  const [criteriaData, setCriteriaData] = useState(() =>
    Object.fromEntries(
      CRITERIA.map((c) => [c.key, { score: null, repeat: false, note: '' }])
    )
  )

  const [generalNotes, setGeneralNotes] = useState('')

  // ── Post-save state ─────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [savedEval, setSavedEval] = useState(null)
  const [pdfBlob, setPdfBlob] = useState(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  // ── Edit mode: load an existing evaluation when ?evalId=… is present ────────
  const editingEvalId = searchParams.get('evalId') || null
  const [origMatchDesc, setOrigMatchDesc] = useState(null)
  const [editLoading, setEditLoading] = useState(!!editingEvalId)
  useEffect(() => {
    if (!editingEvalId) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: e } = await evaluationService.getById(editingEvalId)
        if (cancelled || !e) return
        setRefereeId(e.referee_id)
        setRole(e.role || 'R1')
        if (e.tournament_id) setTournamentId(e.tournament_id)
        if (e.day_number) setDayNumber(e.day_number)
        setOrigMatchDesc(e.match_description || null)
        setCriteriaData(Object.fromEntries(CRITERIA.map((c) => [c.key, {
          score: e[`score_${c.key}`] ?? null,
          repeat: !!e[`repeat_${c.key}`],
          note: e[`note_${c.key}`] || '',
        }])))
        setGeneralNotes(e.general_notes || '')
      } catch {
        toast.error('Could not load the evaluation to edit')
      } finally {
        if (!cancelled) setEditLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [editingEvalId]) // eslint-disable-line

  // ── Validation errors ───────────────────────────────────────────────────────
  const [errors, setErrors] = useState({})

  // ── Resume in-progress evaluation (draft persistence) ───────────────────────
  const skipNextSaveRef = useRef(false)
  const wipMountedRef = useRef(false)

  // On mount: if no referee came from the URL, resume the last in-progress draft
  useEffect(() => {
    if (wipMountedRef.current) return
    wipMountedRef.current = true
    if (searchParams.get('refereeId') || editingEvalId) return
    try {
      const last = JSON.parse(localStorage.getItem(LAST_WIP_KEY) || 'null')
      if (!last || !last.refereeId) return
      if (!localStorage.getItem(wipKey(last.tournamentId, last.dayNumber, last.refereeId, last.role))) return
      if (last.tournamentId) setTournamentId(last.tournamentId)
      if (last.dayNumber) setDayNumber(last.dayNumber)
      if (last.role) setRole(last.role)
      setRefereeId(last.refereeId) // triggers the restore effect below
    } catch { /* ignore */ }
  }, []) // eslint-disable-line

  // Restore (or clear) the scorecard whenever the evaluation context changes
  useEffect(() => {
    if (savedEval || !refereeId || editingEvalId) return
    skipNextSaveRef.current = true // don't let the next autosave write stale data
    try {
      const raw = localStorage.getItem(wipKey(tournamentId, dayNumber, refereeId, role))
      if (raw) {
        const d = JSON.parse(raw)
        if (d.criteriaData) setCriteriaData(d.criteriaData)
        setGeneralNotes(d.generalNotes || '')
        if (d.courtNumber != null) setCourtNumber(d.courtNumber)
        if (d.roundNumber != null) setRoundNumber(d.roundNumber)
        if (d.schedMatchId != null) setSchedMatchId(d.schedMatchId)
        if (d.pickMode) setPickMode(d.pickMode)
      } else {
        setCriteriaData(Object.fromEntries(CRITERIA.map((c) => [c.key, { score: null, repeat: false, note: '' }])))
        setGeneralNotes('')
      }
    } catch { /* ignore */ }
  }, [refereeId, role, tournamentId, dayNumber]) // eslint-disable-line

  // Autosave the in-progress draft on every change
  useEffect(() => {
    if (savedEval || !refereeId || editingEvalId) return
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return }
    const key = wipKey(tournamentId, dayNumber, refereeId, role)
    try {
      if (evalHasContent(criteriaData, generalNotes)) {
        localStorage.setItem(key, JSON.stringify({ criteriaData, generalNotes, courtNumber, roundNumber, schedMatchId, pickMode, updatedAt: Date.now() }))
        localStorage.setItem(LAST_WIP_KEY, JSON.stringify({ tournamentId, dayNumber, refereeId, role }))
      } else {
        localStorage.removeItem(key)
      }
    } catch { /* ignore */ }
  }, [criteriaData, generalNotes, courtNumber, roundNumber, schedMatchId, pickMode, refereeId, role, tournamentId, dayNumber, savedEval]) // eslint-disable-line

  function clearWipDraft() {
    try {
      localStorage.removeItem(wipKey(tournamentId, dayNumber, refereeId, role))
      localStorage.removeItem(LAST_WIP_KEY)
    } catch { /* ignore */ }
  }

  // ── Score snapshot for live preview ────────────────────────────────────────
  const scores = useMemo(
    () =>
      Object.fromEntries(CRITERIA.map((c) => [c.key, criteriaData[c.key].score || 0])),
    [criteriaData]
  )
  const repeats = useMemo(
    () =>
      Object.fromEntries(CRITERIA.map((c) => [c.key, criteriaData[c.key].repeat])),
    [criteriaData]
  )

  // ── Helpers to update criteria ───────────────────────────────────────────────
  function setCriterion(key, field, value) {
    setCriteriaData((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
    // Clear score error on change
    if (field === 'score') {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[`score_${key}`]
        return next
      })
    }
  }

  // ── Match label (schedule game · round · court) ─────────────────────────────
  function matchLabel() {
    if (schedMatch) return gameLabel(schedMatch)
    if (roundNumber) return `Round ${roundNumber}${courtNumber ? ` · Court ${courtNumber}` : ''}`
    return courtNumber ? `Court ${courtNumber}` : null
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate() {
    const errs = {}
    if (!refereeId) errs.refereeId = 'Referee is required'
    if (!role) errs.role = 'Role is required'
    CRITERIA.forEach((c) => {
      if (!criteriaData[c.key].score) {
        errs[`score_${c.key}`] = 'Required'
      }
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Save handler ─────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) {
      toast.error('Please fill in all required fields')
      // Scroll to top to show first error
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const payload = {
      referee_id: refereeId,
      role,
      tournament_id: tournamentId || null,
      day_number: dayNumber || null,
      match_description: matchLabel(),
      score_positioning:  criteriaData.positioning.score,
      score_signals:      criteriaData.signals.score,
      score_attitude:     criteriaData.attitude.score,
      score_captain_comm: criteriaData.captain_comm.score,
      score_presentation: criteriaData.presentation.score,
      repeat_positioning:  criteriaData.positioning.repeat,
      repeat_signals:      criteriaData.signals.repeat,
      repeat_attitude:     criteriaData.attitude.repeat,
      repeat_captain_comm: criteriaData.captain_comm.repeat,
      repeat_presentation: criteriaData.presentation.repeat,
      note_positioning:  criteriaData.positioning.note || null,
      note_signals:      criteriaData.signals.note || null,
      note_attitude:     criteriaData.attitude.note || null,
      note_captain_comm: criteriaData.captain_comm.note || null,
      note_presentation: criteriaData.presentation.note || null,
      general_notes: generalNotes || null,
      evaluated_at: new Date().toISOString(),
    }

    // Edit mode: keep the original match label and timestamp (don't reorder).
    if (editingEvalId) {
      payload.match_description = origMatchDesc
      delete payload.evaluated_at
    }

    // Offline fallback
    if (!navigator.onLine) {
      if (editingEvalId) { toast.error('Editing an evaluation needs a connection'); return }
      const draftKey = `eval_${Date.now()}`
      saveDraft(draftKey, payload)
      clearWipDraft()
      toast('Saved offline — will sync when connected', 'info', 4500)
      return
    }

    setSaving(true)
    try {
      const saved = editingEvalId
        ? await trackSave(() => evaluationService.update(editingEvalId, payload))
        : await trackSave(() => create(payload))
      setSavedEval(saved)
      clearWipDraft()

      // Persist last-used values
      if (tournamentId) setLastTournamentId(tournamentId)
      setLastDayNumber(dayNumber)

      toast.success('Evaluation saved!')

      // Generate PDF
      setGeneratingPdf(true)
      try {
        const referee = referees.find((r) => r.id === refereeId)
        const tournament = tournaments.find((t) => t.id === tournamentId)
        const blob = await generateEvaluationPDF(
          saved,
          referee,
          { match_description: matchLabel() },
          tournament
        )
        setPdfBlob(blob)
      } catch (pdfErr) {
        console.error('PDF generation failed:', pdfErr)
        toast.error('PDF generation failed')
      } finally {
        setGeneratingPdf(false)
      }
    } catch (err) {
      console.error('Save failed:', err)
      toast.error(err.message || 'Failed to save evaluation')
    } finally {
      setSaving(false)
    }
  }

  // ── PDF filename ──────────────────────────────────────────────────────────────
  const pdfFilename = useMemo(() => {
    const referee = referees.find((r) => r.id === refereeId)
    const name = referee
      ? `${referee.last_name}_${referee.first_name}`.replace(/\s+/g, '_')
      : 'referee'
    const date = new Date().toISOString().slice(0, 10)
    return `BVB_Eval_${name}_${date}.pdf`
  }, [referees, refereeId])

  // ── Export PDF in scelta lingua (popup EN/FR/NL prima di scaricare/condividere) ─
  async function exportPdf(kind) {
    const lang = await requestLanguage()
    if (!lang) return
    try {
      const referee = referees.find((r) => r.id === refereeId)
      const tournament = tournaments.find((t) => t.id === tournamentId)
      const blob = await generateEvaluationPDF(
        savedEval,
        referee,
        { match_description: matchLabel() },
        tournament,
        lang
      )
      if (kind === 'share') sharePDFWhatsApp(blob, pdfFilename)
      else downloadPDF(blob, pdfFilename)
    } catch (err) {
      console.error('PDF export failed:', err)
      toast.error('PDF generation failed')
    }
  }

  // Arbitro selezionato (per invio valutazione al suo numero)
  const selectedReferee = referees.find((r) => r.id === refereeId)

  // ── Invia il riepilogo valutazione su WhatsApp AL NUMERO dell'arbitro valutato ──
  async function sendEvalToReferee() {
    const lang = await requestLanguage()
    if (!lang) return
    const tournament = tournaments.find((t) => t.id === tournamentId)
    if (!selectedReferee) { toast.error('Referee not found'); return }
    shareEvaluationToReferee({ referee: selectedReferee, evaluation: savedEval, tournament, lang })
  }

  // ── Sorted tournaments ────────────────────────────────────────────────────────
  const sortedTournaments = useMemo(
    () => [...tournaments].sort((a, b) => new Date(b.start_date) - new Date(a.start_date)),
    [tournaments]
  )

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Header
        title={editingEvalId ? 'Edit Evaluation' : 'New Evaluation'}
        subtitle="Rate a referee's performance"
      />

      {/* Scrollable content — padded for sticky bottom bar */}
      <div className="flex-1 overflow-y-auto pb-40 lg:pb-28">
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

          {editingEvalId && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Pencil size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <b>Editing an existing evaluation.</b> Changes update this evaluation and flow automatically into the day digest and the end-of-tournament summary.
                {editLoading && <span className="block text-xs mt-0.5 text-amber-700">Loading…</span>}
              </div>
            </div>
          )}

          {/* ── Section 1: Match Context ──────────────────────────────────── */}
          <Card>
            <CardHeader className="py-3">
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-[#2D3270]">
                Match Context
              </h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Pick mode: by schedule game, by round (assignments), or manual */}
              <div className="grid grid-cols-3 gap-2">
                {[['match', 'By game'], ['round', 'By round'], ['manual', 'Manual']].map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setPickMode(m)
                      if (m !== 'match') { setSchedMatch(null); setSchedMatchId(null) }
                      if (m !== 'round') setRoundNumber(null)
                    }}
                    className={cn(
                      'py-2 rounded-lg text-sm font-bold transition-all duration-150',
                      pickMode === m
                        ? 'bg-[#2D3270] text-white border border-[#2D3270]'
                        : 'bg-gray-50 text-gray-500 border border-gray-200 hover:text-gray-700'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* ── By-game picker: gare reali dalle Schedule Designations ── */}
              {pickMode === 'match' && (
                <div className="space-y-2">
                  {!tournamentId ? (
                    <p className="text-xs text-gray-500">Select a tournament below to load its games.</p>
                  ) : loadingSched ? (
                    <p className="text-xs text-gray-400">Loading games…</p>
                  ) : designatedGames.length === 0 ? (
                    <p className="text-xs text-gray-500">No designated games for this day yet. Assign referees in Schedule, or use By round / Manual.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Tap the game to evaluate its referee
                      </label>
                      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                        {designatedGames.map((m) => {
                          const a = schedAssign[m.id]
                          const ref = a?.referee || referees.find((r) => r.id === a?.referee_id)
                          const selected = schedMatch?.id === m.id
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSchedMatch(m)
                                setSchedMatchId(m.id)
                                setRefereeId(a.referee_id)
                                setCourtNumber(m.court)
                                setRoundNumber(null)
                                setRole('R1')
                                setErrors((p) => { const n = { ...p }; delete n.refereeId; return n })
                              }}
                              className={cn(
                                'w-full text-left px-3 py-2 rounded-xl border transition-all duration-150',
                                selected
                                  ? 'bg-[#2D3270] text-white border-[#2D3270] ring-2 ring-[#2D3270]/30'
                                  : 'bg-white text-gray-800 border-gray-200 hover:border-gray-300'
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-bold truncate">
                                  {m.is_final ? '🏆 ' : ''}#{m.match_number} · C{m.court} · {hhmm(m.scheduled_time)}
                                </span>
                                <span className={cn('text-[11px] font-bold uppercase shrink-0', selected ? 'text-white/80' : 'text-[#E85D26]')}>
                                  {gameTag(m)}
                                </span>
                              </div>
                              <div className={cn('text-xs truncate', selected ? 'text-white/70' : 'text-gray-400')}>
                                {m.team1 && m.team2 ? `${m.team1} / ${m.team2}` : '—'}
                              </div>
                              <div className={cn('text-xs font-semibold mt-0.5', selected ? 'text-white' : 'text-[#2D3270]')}>
                                Ref: {ref ? refereeName(ref) : '—'}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── By-round picker: mirrors the Assignments rounds ── */}
              {pickMode === 'round' && (
                <div className="space-y-3">
                  {!tournamentId ? (
                    <p className="text-xs text-gray-500">Select a tournament below to load its rounds.</p>
                  ) : loadingAssign ? (
                    <p className="text-xs text-gray-400">Loading rounds…</p>
                  ) : rounds.length === 0 ? (
                    <p className="text-xs text-gray-500">No assignments for this day yet. Create rounds in Assignments, or use Manual.</p>
                  ) : (
                    <>
                      {/* Round selector */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Round</label>
                        <div className="flex flex-wrap gap-2">
                          {rounds.map(({ round }) => (
                            <button
                              key={round}
                              type="button"
                              onClick={() => { setRoundNumber(round); setRefereeId(''); setCourtNumber(null) }}
                              className={cn(
                                'px-4 py-2 rounded-lg text-sm font-bold transition-all duration-150',
                                roundNumber === round
                                  ? 'bg-[#E85D26] text-white border border-[#E85D26]'
                                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'
                              )}
                            >
                              Round {round}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Courts of the selected round → tap a referee */}
                      {roundNumber && (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Tap the referee to evaluate
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(rounds.find((r) => r.round === roundNumber)?.courts || []).map((row) => {
                              const ref = row.referees || referees.find((r) => r.id === row.referee_id)
                              const selected = refereeId === row.referee_id && courtNumber === row.court
                              return (
                                <button
                                  key={`${row.court}-${row.referee_id}`}
                                  type="button"
                                  onClick={() => {
                                    setRefereeId(row.referee_id)
                                    setCourtNumber(row.court)
                                    setRole('R1')
                                    setSchedMatch(null); setSchedMatchId(null)
                                    setErrors((p) => { const n = { ...p }; delete n.refereeId; return n })
                                  }}
                                  className={cn(
                                    'flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-all duration-150',
                                    selected
                                      ? 'bg-[#2D3270] text-white border-[#2D3270] ring-2 ring-[#2D3270]/30'
                                      : 'bg-white text-gray-800 border-gray-200 hover:border-gray-300'
                                  )}
                                >
                                  <span className="text-sm font-semibold truncate">
                                    {ref ? refereeName(ref) : '—'}
                                  </span>
                                  <span className={cn('text-[11px] font-bold uppercase shrink-0', selected ? 'text-white/80' : 'text-[#E85D26]')}>
                                    Court {row.court}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Referee selector (manual mode, or to override) */}
              {pickMode === 'manual' && (
                <RefereeSelector
                  referees={referees}
                  value={refereeId}
                  onChange={(id) => {
                    setRefereeId(id)
                    setRoundNumber(null)
                    setSchedMatch(null); setSchedMatchId(null)
                    setErrors((p) => { const n = { ...p }; delete n.refereeId; return n })
                  }}
                  error={errors.refereeId}
                />
              )}

              {/* Role toggle */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Role <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['R1', 'R2'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        'py-3 rounded-xl text-base font-bold transition-all duration-150',
                        role === r
                          ? 'bg-[#2D3270] text-white border border-[#2D3270] ring-2 ring-[#2D3270]/30 scale-[1.02]'
                          : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700'
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tournament */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Tournament
                </label>
                <select
                  value={tournamentId}
                  onChange={(e) => setTournamentId(e.target.value)}
                  className={cn(
                    'bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5',
                    'text-gray-900 text-sm appearance-none',
                    'focus:outline-none focus:border-[#E85D26]/60 focus:ring-1 focus:ring-[#E85D26]/30',
                    'transition-colors duration-150'
                  )}
                >
                  <option value="">— No tournament —</option>
                  {sortedTournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Day + Match row */}
              <div className="grid grid-cols-2 gap-3">
                <NumberStepper
                  label="Day"
                  value={dayNumber}
                  onChange={setDayNumber}
                  min={1}
                  max={5}
                />
              </div>

              {/* Court selector */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Court
                  </label>
                  {/* Courts count (3 / 4) — shared with Assignments */}
                  <div className="flex gap-1">
                    {[3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => updateNCourts(n)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-bold transition-all duration-150',
                          nCourts === n
                            ? 'bg-[#2D3270] text-white'
                            : 'bg-gray-50 text-gray-500 border border-gray-200 hover:text-gray-700'
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={cn('grid gap-2', nCourts === 3 ? 'grid-cols-3' : 'grid-cols-4')}>
                  {Array.from({ length: nCourts }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCourtNumber(courtNumber === n ? null : n)}
                      className={cn(
                        'py-3 rounded-xl text-base font-bold transition-all duration-150',
                        courtNumber === n
                          ? 'bg-[#E85D26]/25 text-[#E85D26] border border-[#E85D26]/50 ring-2 ring-[#E85D26]/30 scale-[1.04]'
                          : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-900'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* ── Section 2: The 5 Criteria ─────────────────────────────────── */}
          <div>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-[#2D3270] mb-3 px-1">
              Evaluation Criteria
            </h2>
            <div className="space-y-3">
              {CRITERIA.map((criterion) => (
                <CriterionCard
                  key={criterion.key}
                  criterion={criterion}
                  score={criteriaData[criterion.key].score}
                  repeat={criteriaData[criterion.key].repeat}
                  note={criteriaData[criterion.key].note}
                  onScore={(v) => setCriterion(criterion.key, 'score', v)}
                  onRepeat={(v) => setCriterion(criterion.key, 'repeat', v)}
                  onNote={(v) => setCriterion(criterion.key, 'note', v)}
                  error={!!errors[`score_${criterion.key}`]}
                />
              ))}
            </div>
          </div>

          {/* ── Section 4: General Notes ──────────────────────────────────── */}
          <Card>
            <CardHeader className="py-3">
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-[#2D3270]">
                General Feedback
              </h2>
            </CardHeader>
            <CardBody>
              <NoteField
                value={generalNotes}
                onChange={setGeneralNotes}
                placeholder="Overall impressions, strengths, areas for improvement…"
                rows={4}
              />
            </CardBody>
          </Card>

          {/* ── Section 5: Save & Share ───────────────────────────────────── */}
          <div className="space-y-3">
            {/* Save button */}
            {!savedEval ? (
              <Button
                onClick={handleSave}
                loading={saving}
                disabled={saving}
                variant="primary"
                size="lg"
                className="w-full py-4 text-base font-bold rounded-xl"
              >
                {saving ? (
                  'Saving…'
                ) : (
                  <>
                    <Save size={18} />
                    {editingEvalId ? 'Update Evaluation' : 'Save Evaluation'}
                  </>
                )}
              </Button>
            ) : (
              /* Success state */
              <div className="space-y-3">
                {/* Success banner */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <CheckCircle size={22} className="text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-700">Saved successfully</p>
                    {savedEval.overall_score != null && (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        Score: {savedEval.overall_score.toFixed(1)} · {savedEval.grade}
                      </p>
                    )}
                  </div>
                </div>

                {/* PDF actions */}
                {generatingPdf ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-500">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Generating PDF…
                  </div>
                ) : pdfBlob ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="navy"
                        size="md"
                        className="w-full py-3"
                        onClick={() => exportPdf('download')}
                      >
                        <Download size={16} />
                        Download PDF
                      </Button>
                      <Button
                        variant="success"
                        size="md"
                        className="w-full py-3"
                        onClick={() => exportPdf('share')}
                      >
                        <Share2 size={16} />
                        Share PDF
                      </Button>
                    </div>
                    <Button
                      variant="success"
                      size="md"
                      className="w-full py-3"
                      onClick={sendEvalToReferee}
                    >
                      <Share2 size={16} />
                      Send evaluation to referee
                    </Button>
                    {selectedReferee && !selectedReferee.phone && (
                      <p className="text-xs text-gray-400 text-center">
                        No phone number saved for {refereeName(selectedReferee)} — WhatsApp will open so you can choose a contact manually.
                      </p>
                    )}
                  </div>
                ) : null}

                {/* New evaluation shortcut */}
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-2"
                >
                  + Evaluate another referee
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Section 3: Sticky live score bar ─────────────────────────────── */}
      <LiveScoreBar scores={scores} repeats={repeats} />
    </div>
  )
}
