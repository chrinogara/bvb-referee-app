import { trackSave } from '../lib/saveTracker'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useReferees } from '../hooks/useReferees'
import { useTournaments } from '../hooks/useTournaments'
import { useEvaluations } from '../hooks/useEvaluations'
import { evaluationService } from '../lib/supabase'
import { supabase, courtAssignmentService, matchService, designationService, tournamentService, draftService } from '../lib/supabase'
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
  try {
    const d = new Date(t)
    if (isNaN(d)) throw new Error()
    return d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels', hour12: false })
  } catch {
    const s = String(t)
    const m = s.match(/(\d{1,2}):(\d{2})/)
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s
  }
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
            {/* List (grouped: Referees vs Line judges) */}
            <ul className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-gray-500 text-center">No referees found</li>
              ) : (() => {
                const isLJ = (r) => (r.notes || '').toLowerCase().includes('line judge')
                const refs = filtered.filter((r) => !isLJ(r))
                const ljs = filtered.filter((r) => isLJ(r))
                const hasLJ = ljs.length > 0
                const item = (r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => { onChange(r.id); setOpen(false); setQuery('') }}
                      className={cn(
                        'w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2',
                        r.id === value
                          ? 'bg-[#E85D26]/15 text-[#E85D26] font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <span className="flex-1">
                        <span className="font-medium">{r.last_name}</span>{' '}
                        <span className="text-gray-500">{r.first_name}</span>
                      </span>
                      {isLJ(r) && (
                        <span className="text-[9px] font-bold uppercase text-white bg-gray-500 rounded px-1.5 py-0.5 shrink-0">LJ</span>
                      )}
                    </button>
                  </li>
                )
                const header = (t, n) => (
                  <li className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100/80 sticky top-0">
                    {t} ({n})
                  </li>
                )
                if (!hasLJ) return refs.map(item)
                return (
                  <>
                    {refs.length > 0 && header('Referees', refs.length)}
                    {refs.map(item)}
                    {header('Line judges', ljs.length)}
                    {ljs.map(item)}
                  </>
                )
              })()}
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

function CriterionCard({ criterion, score, repeat, note, na, onScore, onRepeat, onNote, onNa, error }) {
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
        {criterion.threeStep && !na && <ThreeStepProtocol />}

        {/* Score buttons: 5 large tap targets */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Score {!na && <span className="text-red-400">*</span>}
            </p>
            <button
              type="button"
              onClick={() => onNa(!na)}
              className={cn(
                'text-[11px] font-bold rounded-full px-2.5 py-1 border transition-all duration-150',
                na
                  ? 'bg-gray-700 text-white border-gray-700'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              {na ? '✓ Not evaluable' : 'Not evaluable'}
            </button>
          </div>

          {na ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-center">
              <p className="text-xs font-semibold text-gray-600">Not evaluable — situation did not occur</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Excluded from the score (does not count as zero)</p>
            </div>
          ) : (
            <>
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
                <p className="text-xs text-red-400 mt-1">Please select a score or mark it not evaluable</p>
              )}
            </>
          )}
        </div>

        {/* Repeat fault toggle (hidden when not evaluable) */}
        {!na && (
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
        )}

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

function LiveScoreBar({ scores, repeats, difficulty }) {
  const result = useMemo(() => {
    const allSet = Object.values(scores).every((v) => v != null && v > 0)
    if (!allSet) {
      // Compute partial score for whatever's filled
      const partial = computeScore(scores, repeats, difficulty)
      return { ...partial, partial: true }
    }
    return { ...computeScore(scores, repeats, difficulty), partial: false }
  }, [scores, repeats, difficulty])

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
          {result.adjustment ? (
            <p className={cn('text-[10px] font-medium', result.adjustment > 0 ? 'text-green-600' : 'text-gray-500')}>
              {result.adjustment > 0 ? '↑' : '↓'} {result.adjustment > 0 ? '+' : ''}{result.adjustment.toFixed(1)} difficulty
            </p>
          ) : null}
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
function evalHasContent(cd, gn, extra = {}) {
  return Boolean(
    (gn && gn.trim()) ||
    extra.leadershipScore != null || extra.leadershipNa ||
    (extra.leadershipNote && extra.leadershipNote.trim()) ||
    extra.benchScore != null || extra.benchNa ||
    (extra.benchNote && extra.benchNote.trim()) ||
    CRITERIA.some((c) => cd[c.key].score || cd[c.key].repeat || (cd[c.key].note && cd[c.key].note.trim()))
  )
}

// Leadership / collegiality rating — how the referee helps and sets an example
// to colleagues (esp. pre-match management). Separate from the official weighted
// score; carried into the final report.
const LEADERSHIP_LEVELS = [
  { value: 1, label: 'Needs support', hint: 'Rarely helps peers / limited pre-match example' },
  { value: 2, label: 'Developing',    hint: 'Occasionally supports colleagues' },
  { value: 3, label: 'Solid',         hint: 'Reliably helps peers; good pre-match example' },
  { value: 4, label: 'Role model',    hint: 'Exemplary — sets the standard others follow' },
]
export const LEADERSHIP_LABEL = Object.fromEntries(LEADERSHIP_LEVELS.map((l) => [l.value, l.label]))

// R2 only — management of benches / team areas and everything off the court.
const BENCH_LEVELS = [
  { value: 1, label: 'Needs work',  hint: 'Struggles to control benches / off-court area' },
  { value: 2, label: 'Developing',  hint: 'Handles the basics, some lapses' },
  { value: 3, label: 'Solid',       hint: 'Good control of benches and surroundings' },
  { value: 4, label: 'Excellent',   hint: 'Proactive, authoritative off-court management' },
]
export const BENCH_LABEL = Object.fromEntries(BENCH_LEVELS.map((l) => [l.value, l.label]))

// Reusable "extra rating" card: a levelled judgement + Not-evaluable toggle +
// auto-translated note. Used for Leadership and for the R2 bench/off-court block.
// Kept OUT of the official weighted score; carried into the final report.
function ExtraRatingCard({ title, description, levels, score, na, note, onScore, onNa, onNote, notePlaceholder, noteLabel, disabledHint }) {
  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-[#2D3270]">{title}</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => onNa(!na)}
            className={cn(
              'text-[11px] font-bold rounded-full px-2.5 py-1 border transition-all duration-150 shrink-0',
              na
                ? 'bg-gray-700 text-white border-gray-700'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
            )}
          >
            {na ? '✓ Not evaluable' : 'Not evaluable'}
          </button>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {na ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-center">
            <p className="text-xs font-semibold text-gray-600">Not evaluable — situation did not occur</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {levels.map((lv) => {
              const active = score === lv.value
              return (
                <button
                  key={lv.value}
                  type="button"
                  onClick={() => onScore(active ? null : lv.value)}
                  className={cn(
                    'flex flex-col items-start text-left px-3 py-2 rounded-xl border transition-all duration-150',
                    active
                      ? 'bg-[#2D3270] text-white border-[#2D3270] ring-2 ring-[#2D3270]/30'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                  )}
                >
                  <span className="text-sm font-bold">{lv.label}</span>
                  <span className={cn('text-[10px] mt-0.5 leading-tight', active ? 'text-white/70' : 'text-gray-400')}>{lv.hint}</span>
                </button>
              )
            })}
          </div>
        )}
        <NoteField value={note} onChange={onNote} placeholder={notePlaceholder} rows={3} autoOpenLabel={noteLabel} />
        {disabledHint && <p className="text-[11px] text-amber-600 leading-snug">{disabledHint}</p>}
      </CardBody>
    </Card>
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
  // Tournament roster (only the referees linked to the selected tournament)
  const [roster, setRoster] = useState(null)   // null = not loaded / all-referees fallback
  const [rosterLoading, setRosterLoading] = useState(false)
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
  const [difficulty, setDifficulty] = useState('medium')
  const [tournamentId, setTournamentId] = useState(
    searchParams.get('tournamentId') || lastTournamentId || ''
  )
  const [dayNumber, setDayNumber] = useState(lastDayNumber || 1)

  // When a tournament is selected, load ITS referees (roster). Falls back to the
  // full list when no tournament is chosen or the tournament has no roster yet.
  useEffect(() => {
    let alive = true
    if (!tournamentId) { setRoster(null); return }
    setRosterLoading(true)
    tournamentService.getReferees(tournamentId)
      .then(({ data }) => {
        if (!alive) return
        const list = (data || []).map((row) => row.referees).filter(Boolean)
        setRoster(list)
      })
      .catch(() => { if (alive) setRoster(null) })
      .finally(() => { if (alive) setRosterLoading(false) })
    return () => { alive = false }
  }, [tournamentId])

  const isLineJudge = (r) => !!r && (r.notes || '').toLowerCase().includes('line judge')
  // Referees shown in the picker: the tournament roster if available, else all.
  const pickerReferees = useMemo(
    () => (roster && roster.length ? roster : referees),
    [roster, referees]
  )
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
  const [schedAssign, setSchedAssign] = useState({})     // { [match_id]: { referee_id, referee } }  (R1, for legacy uses)
  const [schedDesigs, setSchedDesigs] = useState([])     // all designations (R1/R2/LJ1/LJ2) for the tournament
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
    if (!tournamentId || !dayNumber) { setSchedMatches([]); setSchedAssign({}); setSchedDesigs([]); return }
    setLoadingSched(true)
    ;(async () => {
      try {
        // 1. Carica tutte le gare del torneo
        const mRes = await matchService.getByTournament(tournamentId)
        if (!alive) return
        const allMatches = mRes.data || []
        const mts = allMatches
          .filter((m) => Number(m.day_number || 1) === Number(dayNumber))
          .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || '') || (a.match_number || 0) - (b.match_number || 0))
        setSchedMatches(mts)

        // 2. Carica le designazioni del torneo
        const dRes = await designationService.getByTournament(tournamentId)
        if (!alive) return
        const desigs = dRes.data || []
        setSchedDesigs(desigs)

        // 3. Costruisce la mappa match_id → {referee_id, referee} solo per R1
        const map = {}
        for (const d of desigs) {
          if (!d.match_id || !d.referee_id) continue
          // Includi sia R1 esplicito sia righe senza role (vecchi record)
          if (d.role === 'R2') continue
          map[d.match_id] = { referee_id: d.referee_id, referee: d.referees || null }
        }
        setSchedAssign(map)
      } catch (err) {
        console.error('[By game] load error:', err)
        if (alive) { setSchedMatches([]); setSchedAssign({}) }
      } finally {
        if (alive) setLoadingSched(false)
      }
    })()
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
  // Designated games for the currently selected referee (optional match attach)
  // Designated games for the currently selected official — across ALL roles
  // (R1, R2, LJ1, LJ2), so both referees and line judges see their own games.
  const refDesignatedGames = useMemo(() => {
    if (!refereeId) return []
    const roleByMatch = {}
    for (const d of schedDesigs) {
      if (d.referee_id !== refereeId || !d.match_id) continue
      // keep the most specific role if a match somehow has several
      roleByMatch[d.match_id] = d.role || roleByMatch[d.match_id] || 'R1'
    }
    return schedMatches
      .filter((m) => roleByMatch[m.id])
      .map((m) => ({ ...m, _role: roleByMatch[m.id] }))
  }, [refereeId, schedDesigs, schedMatches])
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
      CRITERIA.map((c) => [c.key, { score: null, repeat: false, note: '', na: false }])
    )
  )

  const [generalNotes, setGeneralNotes] = useState('')
  // Leadership / example-to-colleagues rating (1–4) + note. Separate from score.
  const [leadershipScore, setLeadershipScore] = useState(null)
  const [leadershipNa, setLeadershipNa] = useState(false)
  const [leadershipNote, setLeadershipNote] = useState('')
  const [leadershipEnabled, setLeadershipEnabled] = useState(true) // DB has the columns?
  // R2 only — bench / off-court management rating (1–4) + note.
  const [benchScore, setBenchScore] = useState(null)
  const [benchNa, setBenchNa] = useState(false)
  const [benchNote, setBenchNote] = useState('')
  const [benchEnabled, setBenchEnabled] = useState(true) // DB has the columns?

  // ── Post-save state ─────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [savedEval, setSavedEval] = useState(null)
  const [draftSavedAt, setDraftSavedAt] = useState(null) // when the in-progress draft was last stored on this device
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
        setDifficulty(e.match_difficulty || 'medium')
        if (e.tournament_id) setTournamentId(e.tournament_id)
        if (e.day_number) setDayNumber(e.day_number)
        setOrigMatchDesc(e.match_description || null)
        setCriteriaData(Object.fromEntries(CRITERIA.map((c) => [c.key, {
          score: e[`score_${c.key}`] ?? null,
          repeat: !!e[`repeat_${c.key}`],
          note: e[`note_${c.key}`] || '',
          na: e[`score_${c.key}`] == null,
        }])))
        setGeneralNotes(e.general_notes || '')
        setLeadershipNa(e.leadership_score === 0)
        setLeadershipScore(e.leadership_score > 0 ? e.leadership_score : null)
        setLeadershipNote(e.leadership_note || '')
        setBenchNa(e.bench_score === 0)
        setBenchScore(e.bench_score > 0 ? e.bench_score : null)
        setBenchNote(e.bench_note || '')
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

  // One-time probe: do the leadership_* columns exist in the DB? If not, the
  // rating still works locally (draft) but isn't sent to the server until the
  // columns are added, so saving an evaluation never fails.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { error } = await supabase.from('evaluations').select('leadership_score').limit(1)
        if (alive && error) setLeadershipEnabled(false)
      } catch { if (alive) setLeadershipEnabled(false) }
      try {
        const { error } = await supabase.from('evaluations').select('bench_score').limit(1)
        if (alive && error) setBenchEnabled(false)
      } catch { if (alive) setBenchEnabled(false) }
    })()
    return () => { alive = false }
  }, [])

  // ── Resume in-progress evaluation (draft persistence) ───────────────────────
  const skipNextSaveRef = useRef(false)
  const wipMountedRef = useRef(false)
  const serverSyncTimer = useRef(null)

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
      toast('Draft restored — pick up where you left off', 'info', 4000)
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
        if (d.difficulty) setDifficulty(d.difficulty)
        setGeneralNotes(d.generalNotes || '')
        if (d.courtNumber != null) setCourtNumber(d.courtNumber)
        if (d.roundNumber != null) setRoundNumber(d.roundNumber)
        if (d.schedMatchId != null) setSchedMatchId(d.schedMatchId)
        if (d.pickMode) setPickMode(d.pickMode)
        setLeadershipScore(d.leadershipScore ?? null)
        setLeadershipNa(!!d.leadershipNa)
        setLeadershipNote(d.leadershipNote || '')
        setBenchScore(d.benchScore ?? null)
        setBenchNa(!!d.benchNa)
        setBenchNote(d.benchNote || '')
        setDraftSavedAt(d.updatedAt || Date.now())
      } else {
        setCriteriaData(Object.fromEntries(CRITERIA.map((c) => [c.key, { score: null, repeat: false, note: '', na: false }])))
        setGeneralNotes('')
        setLeadershipScore(null)
        setLeadershipNa(false)
        setLeadershipNote('')
        setBenchScore(null)
        setBenchNa(false)
        setBenchNote('')
        setDraftSavedAt(null)
      }
    } catch { /* ignore */ }
  }, [refereeId, role, tournamentId, dayNumber]) // eslint-disable-line

  // Autosave the in-progress draft on every change
  useEffect(() => {
    if (savedEval || !refereeId || editingEvalId) return
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return }
    const key = wipKey(tournamentId, dayNumber, refereeId, role)
    try {
      if (evalHasContent(criteriaData, generalNotes, { leadershipScore, leadershipNa, leadershipNote, benchScore, benchNa, benchNote })) {
        const now = Date.now()
        const draftObj = { criteriaData, generalNotes, leadershipScore, leadershipNa, leadershipNote, benchScore, benchNa, benchNote, courtNumber, roundNumber, schedMatchId, pickMode, difficulty, updatedAt: now }
        localStorage.setItem(key, JSON.stringify(draftObj))
        localStorage.setItem(LAST_WIP_KEY, JSON.stringify({ tournamentId, dayNumber, refereeId, role }))
        setDraftSavedAt(now)
        if (serverSyncTimer.current) clearTimeout(serverSyncTimer.current)
        serverSyncTimer.current = setTimeout(() => pushDraftServer(key, draftObj), 2500)
      } else {
        localStorage.removeItem(key)
        setDraftSavedAt(null)
        deleteDraftServer(key)
      }
    } catch { /* ignore */ }
  }, [criteriaData, generalNotes, leadershipScore, leadershipNa, leadershipNote, benchScore, benchNa, benchNote, courtNumber, roundNumber, schedMatchId, pickMode, difficulty, refereeId, role, tournamentId, dayNumber, savedEval]) // eslint-disable-line

  function clearWipDraft() {
    const key = wipKey(tournamentId, dayNumber, refereeId, role)
    try {
      localStorage.removeItem(key)
      localStorage.removeItem(LAST_WIP_KEY)
    } catch { /* ignore */ }
    deleteDraftServer(key)
    setDraftSavedAt(null)
    refreshDrafts()
  }

  // Explicit "Save draft" — same local store the autosave uses, with confirmation.
  function saveDraftNow() {
    if (!refereeId) { toast.error('Pick a referee first'); return }
    try {
      const now = Date.now()
      const key = wipKey(tournamentId, dayNumber, refereeId, role)
      const draftObj = { criteriaData, generalNotes, leadershipScore, leadershipNa, leadershipNote, benchScore, benchNa, benchNote, courtNumber, roundNumber, schedMatchId, pickMode, difficulty, updatedAt: now }
      localStorage.setItem(key, JSON.stringify(draftObj))
      localStorage.setItem(LAST_WIP_KEY, JSON.stringify({ tournamentId, dayNumber, refereeId, role }))
      setDraftSavedAt(now)
      pushDraftServer(key, draftObj)
      toast.success('Draft saved — synced, you can resume it on any device')
      refreshDrafts()
    } catch {
      toast.error('Could not save the draft on this device')
    }
  }

  // Discard the current in-progress draft and reset the scorecard.
  function discardDraft() {
    clearWipDraft()
    setCriteriaData(Object.fromEntries(CRITERIA.map((c) => [c.key, { score: null, repeat: false, note: '', na: false }])))
    setGeneralNotes('')
    setLeadershipScore(null)
    setLeadershipNa(false)
    setLeadershipNote('')
    setBenchScore(null)
    setBenchNa(false)
    setBenchNote('')
    toast('Draft discarded', 'info')
    refreshDrafts()
  }

  // ── All unfinished evaluations (one draft per referee/role) ─────────────────
  const [drafts, setDrafts] = useState([])
  const refreshDrafts = useCallback(() => {
    const out = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k || !k.startsWith('bvb_eval_wip::')) continue
        const [, t, d, r, ro] = k.split('::')
        let data = null
        try { data = JSON.parse(localStorage.getItem(k) || 'null') } catch { data = null }
        if (!data) continue
        out.push({
          key: k,
          tournamentId: t === '-' ? null : t,
          dayNumber: d === '-' ? null : Number(d),
          refereeId: r,
          role: ro,
          updatedAt: data.updatedAt || 0,
          courtNumber: data.courtNumber ?? null,
          roundNumber: data.roundNumber ?? null,
          schedMatchId: data.schedMatchId ?? null,
        })
      }
    } catch { /* ignore */ }
    out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    setDrafts(out)
  }, [])

  // ── Cross-device draft sync (best-effort; no-op if the DB table is absent) ──
  const serverRowFrom = (id, obj) => {
    const [, t, d, r, ro] = id.split('::')
    return {
      id,
      tournament_id: t === '-' ? null : t,
      day_number: d === '-' ? null : Number(d),
      referee_id: r || null,
      role: ro || null,
      data: obj,
      updated_at: new Date(obj?.updatedAt || Date.now()).toISOString(),
    }
  }
  const pushDraftServer = (id, obj) => {
    try { draftService.upsert(serverRowFrom(id, obj)).then(() => {}, () => {}) } catch { /* ignore */ }
  }
  const deleteDraftServer = (id) => {
    try { draftService.remove(id).then(() => {}, () => {}) } catch { /* ignore */ }
  }
  const readLocalDrafts = () => {
    const list = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k || !k.startsWith('bvb_eval_wip::')) continue
        let obj = null
        try { obj = JSON.parse(localStorage.getItem(k) || 'null') } catch { obj = null }
        if (obj) list.push({ id: k, obj })
      }
    } catch { /* ignore */ }
    return list
  }
  // Pull server drafts into localStorage and push local ones up (last-write-wins).
  const hydrateFromServer = useCallback(async () => {
    try {
      const { data, error } = await draftService.getAll()
      if (!error && Array.isArray(data)) {
        const serverById = {}
        for (const row of data) {
          if (!row?.id || !row?.data) continue
          serverById[row.id] = row
          let localUpdated = 0
          try {
            const raw = localStorage.getItem(row.id)
            if (raw) localUpdated = JSON.parse(raw)?.updatedAt || 0
          } catch { /* ignore */ }
          const serverUpdated = row.data?.updatedAt || (row.updated_at ? Date.parse(row.updated_at) : 0)
          if (serverUpdated >= localUpdated) {
            try { localStorage.setItem(row.id, JSON.stringify(row.data)) } catch { /* ignore */ }
          }
        }
        // Push local drafts that the server doesn't have (or that are newer here).
        for (const { id, obj } of readLocalDrafts()) {
          const s = serverById[id]
          const serverUpdated = s ? (s.data?.updatedAt || (s.updated_at ? Date.parse(s.updated_at) : 0)) : -1
          if ((obj?.updatedAt || 0) > serverUpdated) pushDraftServer(id, obj)
        }
      }
    } catch { /* server unavailable / table missing — local only */ }
    refreshDrafts()
  }, [refreshDrafts])

  // Rebuild locally on context change; hydrate from the server on mount + focus.
  useEffect(() => { refreshDrafts() }, [refreshDrafts, refereeId, role, tournamentId, dayNumber, savedEval])
  useEffect(() => {
    hydrateFromServer()
    const onFocus = () => hydrateFromServer()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [hydrateFromServer])

  // Reopen a saved draft — load its context so the restore effect fills the form.
  function openDraft(d) {
    setSavedEval(null)
    setPdfBlob(null)
    setErrors({})
    if (d.tournamentId) setTournamentId(d.tournamentId)
    if (d.dayNumber) setDayNumber(d.dayNumber)
    if (d.role) setRole(d.role)
    setRefereeId(d.refereeId) // triggers the restore effect
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Delete one draft (and, if it's the one on screen, clear the form too).
  function deleteDraft(d, e) {
    if (e) e.stopPropagation()
    try {
      localStorage.removeItem(d.key)
      const last = JSON.parse(localStorage.getItem(LAST_WIP_KEY) || 'null')
      if (last && wipKey(last.tournamentId, last.dayNumber, last.refereeId, last.role) === d.key) {
        localStorage.removeItem(LAST_WIP_KEY)
      }
    } catch { /* ignore */ }
    deleteDraftServer(d.key)
    if (d.key === wipKey(tournamentId, dayNumber, refereeId, role)) {
      setCriteriaData(Object.fromEntries(CRITERIA.map((c) => [c.key, { score: null, repeat: false, note: '', na: false }])))
      setGeneralNotes('')
      setLeadershipScore(null)
      setLeadershipNa(false)
      setLeadershipNote('')
      setBenchScore(null)
      setBenchNa(false)
      setBenchNote('')
      setDraftSavedAt(null)
    }
    refreshDrafts()
  }

  // Short context line for a draft row.
  function draftContext(d) {
    const m = d.schedMatchId ? schedMatches.find((x) => x.id === d.schedMatchId) : null
    if (m) return `#${m.match_number} · C${m.court}`
    if (d.courtNumber != null) return `Court ${d.courtNumber}`
    if (d.roundNumber != null) return `Round ${d.roundNumber}`
    return '—'
  }

  // ── Score snapshot for live preview ────────────────────────────────────────
  const scores = useMemo(
    () =>
      Object.fromEntries(CRITERIA.map((c) => {
        const cd = criteriaData[c.key]
        return [c.key, cd.na ? null : (cd.score ?? null)]
      })),
    [criteriaData]
  )
  const repeats = useMemo(
    () =>
      Object.fromEntries(CRITERIA.map((c) => [c.key, criteriaData[c.key].na ? false : criteriaData[c.key].repeat])),
    [criteriaData]
  )

  // ── Helpers to update criteria ───────────────────────────────────────────────
  function setCriterion(key, field, value) {
    setCriteriaData((prev) => {
      const cur = prev[key]
      let next
      if (field === 'na' && value) {
        next = { ...cur, na: true, score: null, repeat: false }
      } else if (field === 'score') {
        next = { ...cur, score: value, na: false }
      } else {
        next = { ...cur, [field]: value }
      }
      return { ...prev, [key]: next }
    })
    // Clear score error on change
    if (field === 'score' || field === 'na') {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[`score_${key}`]
        delete next.noScore
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
    // Line judges: written evaluation only — no numeric criteria required.
    const _selLj = referees.find((r) => r.id === refereeId)
    if (_selLj && isLineJudge(_selLj)) {
      if (!generalNotes || !generalNotes.trim()) errs.noScore = 'Write the line judge evaluation'
      setErrors(errs)
      return Object.keys(errs).length === 0
    }
    let scoredCount = 0
    CRITERIA.forEach((c) => {
      const cd = criteriaData[c.key]
      if (cd.na) return
      if (!cd.score) errs[`score_${c.key}`] = 'Required'
      else scoredCount++
    })
    if (scoredCount === 0) errs.noScore = 'At least one criterion must be scored'
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

    const _selLjSave = referees.find((r) => r.id === refereeId)
    const _isLj = !!(_selLjSave && isLineJudge(_selLjSave))
    const scoreOf  = (k) => (_isLj || criteriaData[k].na ? null : criteriaData[k].score)
    const repeatOf = (k) => (_isLj ? false : (criteriaData[k].na ? false : criteriaData[k].repeat))
    const noteOf   = (k) => (_isLj ? null : (criteriaData[k].note || null))
    const _scores  = Object.fromEntries(CRITERIA.map((c) => [c.key, scoreOf(c.key)]))
    const _repeats = Object.fromEntries(CRITERIA.map((c) => [c.key, repeatOf(c.key)]))
    const _calc = _isLj
      ? { overall: null, grade: null, penalty: 0 }
      : computeScore(_scores, _repeats, difficulty)

    const payload = {
      referee_id: refereeId,
      role,
      tournament_id: tournamentId || null,
      day_number: dayNumber || null,
      match_description: matchLabel(),
      match_difficulty: difficulty,
      score_positioning:  scoreOf('positioning'),
      score_signals:      scoreOf('signals'),
      score_attitude:     scoreOf('attitude'),
      score_captain_comm: scoreOf('captain_comm'),
      score_presentation: scoreOf('presentation'),
      repeat_positioning:  repeatOf('positioning'),
      repeat_signals:      repeatOf('signals'),
      repeat_attitude:     repeatOf('attitude'),
      repeat_captain_comm: repeatOf('captain_comm'),
      repeat_presentation: repeatOf('presentation'),
      note_positioning:  noteOf('positioning'),
      note_signals:      noteOf('signals'),
      note_attitude:     noteOf('attitude'),
      note_captain_comm: noteOf('captain_comm'),
      note_presentation: noteOf('presentation'),
      overall_score: _calc.overall,
      grade: _calc.grade ? _calc.grade.grade : null,
      repeat_penalty: _calc.penalty,
      general_notes: generalNotes || null,
      evaluated_at: new Date().toISOString(),
    }

    // Leadership + R2 bench ratings — "Not evaluable" stored as 0.
    // Only sent if the columns exist (otherwise kept in the local draft).
    if (leadershipEnabled) {
      payload.leadership_score = leadershipNa ? 0 : (leadershipScore ?? null)
      payload.leadership_note = leadershipNote ? leadershipNote.trim() : null
    }
    if (benchEnabled) {
      payload.bench_score = benchNa ? 0 : (benchScore ?? null)
      payload.bench_note = benchNote ? benchNote.trim() : null
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

    // Persist. If the DB doesn't have the optional rating columns yet, strip
    // them and retry so a save never gets stuck on "Save error" for that reason.
    const persistOnce = async (pl) => {
      if (editingEvalId) {
        const { data, error } = await evaluationService.update(editingEvalId, pl)
        if (error) throw new Error(error.message)
        return data
      }
      return await create(pl)
    }
    const persistEval = async (pl) => {
      try {
        return await persistOnce(pl)
      } catch (err) {
        const msg = (err?.message || '').toLowerCase()
        if (/leadership_score|leadership_note|bench_score|bench_note|schema cache|could not find the/.test(msg)) {
          setLeadershipEnabled(false)
          setBenchEnabled(false)
          const { leadership_score, leadership_note, bench_score, bench_note, ...core } = pl
          const data = await persistOnce(core)
          toast('Saved. The leadership/bench columns aren’t in the database yet — run the SQL to store those ratings.', 'info', 6500)
          return data
        }
        if (/role/.test(msg) && /(constraint|check|invalid|violat|enum)/.test(msg)) {
          toast('The database rejected the LJ role — run the SQL to allow LJ1/LJ2 for evaluations.', 'error', 7000)
        }
        throw err
      }
    }

    setSaving(true)
    try {
      const saved = await trackSave(() => persistEval(payload))
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
  // Line judges are evaluated with a written comment only — no numeric criteria.
  const ljMode = !!(selectedReferee && isLineJudge(selectedReferee))

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

          {/* ── Unfinished evaluations — reopen any (multiple in parallel) ──── */}
          {!editingEvalId && drafts.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <h2 className="font-display text-base font-bold uppercase tracking-wide text-[#2D3270]">
                  Unfinished evaluations ({drafts.length})
                </h2>
              </CardHeader>
              <CardBody className="space-y-1.5">
                <p className="text-[11px] text-gray-500 leading-snug">
                  Tap to reopen and finish. Each referee is kept separately — you can keep several open at once (e.g. all officials of one match).
                </p>
                {drafts.map((d) => {
                  const ref = referees.find((r) => r.id === d.refereeId)
                  const isCurrent = d.key === wipKey(tournamentId, dayNumber, refereeId, role)
                  return (
                    <div
                      key={d.key}
                      onClick={() => openDraft(d)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-xl border cursor-pointer flex items-center gap-2 transition-colors',
                        isCurrent ? 'bg-[#E85D26]/10 border-[#E85D26]/40' : 'bg-white border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1.5">
                          {ref ? refereeName(ref) : 'Referee'}
                          <span className="text-[9px] font-bold uppercase text-white bg-gray-500 rounded px-1.5 py-0.5">{d.role}</span>
                          {isCurrent && <span className="text-[9px] font-bold uppercase text-[#E85D26]">• open</span>}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {draftContext(d)}{d.updatedAt ? ` · saved ${new Date(d.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => deleteDraft(d, e)}
                        className="text-gray-400 hover:text-red-500 p-1 shrink-0"
                        title="Delete this draft"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}
              </CardBody>
            </Card>
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
                {[['match', 'By referee'], ['round', 'By round'], ['manual', 'Manual']].map(([m, label]) => (
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

              {/* ── By-referee picker: pick from the tournament roster ── */}
              {pickMode === 'match' && (
                <div className="space-y-3">
                  <RefereeSelector
                    referees={pickerReferees}
                    value={refereeId}
                    onChange={(id) => {
                      setRefereeId(id)
                      setSchedMatch(null); setSchedMatchId(null)
                      setRoundNumber(null)
                      setErrors((p) => { const n = { ...p }; delete n.refereeId; return n })
                    }}
                    error={errors.refereeId}
                  />

                  {selectedReferee && isLineJudge(selectedReferee) && (
                    <div className="rounded-xl bg-gray-100 border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase text-white bg-gray-500 rounded px-1.5 py-0.5">LJ</span>
                      Line judge — {refereeName(selectedReferee)} · written evaluation only, no score
                    </div>
                  )}

                  {!tournamentId ? (
                    <p className="text-xs text-gray-500">Select a tournament below to load its referees.</p>
                  ) : rosterLoading ? (
                    <p className="text-xs text-gray-400">Loading referees…</p>
                  ) : roster && roster.length === 0 ? (
                    <p className="text-xs text-orange-500">This tournament has no referees yet — add them first.</p>
                  ) : !refereeId ? (
                    <p className="text-xs text-gray-500">Pick a referee from the roster above, then score below.</p>
                  ) : refDesignatedGames.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Designated game (optional)
                      </label>
                      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                        {refDesignatedGames.map((m) => {
                          const selected = schedMatch?.id === m.id
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                if (selected) { setSchedMatch(null); setSchedMatchId(null); return }
                                setSchedMatch(m)
                                setSchedMatchId(m.id)
                                setCourtNumber(m.court)
                                setRoundNumber(null)
                                setRole(m._role || 'R1')
                                if (m.day_number) setDayNumber(m.day_number)
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
                                <span className="flex items-center gap-1.5 shrink-0">
                                  {m._role && (
                                    <span className={cn('text-[9px] font-bold uppercase rounded px-1.5 py-0.5', selected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600')}>
                                      {m._role}
                                    </span>
                                  )}
                                  <span className={cn('text-[11px] font-bold uppercase', selected ? 'text-white/80' : 'text-[#E85D26]')}>
                                    {gameTag(m)}
                                  </span>
                                </span>
                              </div>
                              <div className={cn('text-xs truncate', selected ? 'text-white/70' : 'text-gray-400')}>
                                {m.team1 && m.team2 ? `${m.team1} / ${m.team2}` : '—'}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No designated games for this referee — you can still score below.</p>
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
                  referees={pickerReferees}
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
                <div className="grid grid-cols-4 gap-2">
                  {['R1', 'R2', 'LJ1', 'LJ2'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        'py-3 rounded-xl text-sm font-bold transition-all duration-150',
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

              {/* Match difficulty — influences the final score (hidden for line judges) */}
              {!ljMode && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Match difficulty
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'easy',   label: 'Easy',   adj: '−0.3' },
                    { key: 'medium', label: 'Medium', adj: '0' },
                    { key: 'hard',   label: 'Hard',   adj: '+0.3' },
                  ].map((d) => {
                    const active = difficulty === d.key
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => setDifficulty(d.key)}
                        className={cn(
                          'flex flex-col items-center justify-center py-2.5 rounded-xl text-sm font-bold transition-all duration-150',
                          active
                            ? 'bg-[#2D3270] text-white border border-[#2D3270] ring-2 ring-[#2D3270]/30 scale-[1.02]'
                            : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700'
                        )}
                      >
                        <span>{d.label}</span>
                        <span className={cn('text-[10px] font-medium mt-0.5', active ? 'text-white/70' : 'text-gray-400')}>
                          {d.adj}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Adjusts the final score: harder match adds credit, easier subtracts (Medium = neutral).
                </p>
              </div>
              )}
            </CardBody>
          </Card>

          {/* ── Leadership & example to colleagues (top of the eval; referees only) ── */}
          {!ljMode && (
            <ExtraRatingCard
              title="Leadership & Example"
              description="How the referee helps colleagues and sets the example — pre-match management and role-model behaviour. Included in the final report."
              levels={LEADERSHIP_LEVELS}
              score={leadershipScore}
              na={leadershipNa}
              note={leadershipNote}
              onScore={setLeadershipScore}
              onNa={(v) => { setLeadershipNa(v); if (v) setLeadershipScore(null) }}
              onNote={setLeadershipNote}
              notePlaceholder="Concrete example: how they ran the pre-match, helped a colleague, set the standard…"
              noteLabel="Example for colleagues"
              disabledHint={!leadershipEnabled ? 'Kept in your draft for now — a quick database update is needed before this rating is stored on the server.' : ''}
            />
          )}

          {/* ── R2 only: benches / off-court management ─────────────────────── */}
          {!ljMode && role === 'R2' && (
            <ExtraRatingCard
              title="Benches & Off-court (R2)"
              description="How the 2nd referee manages the benches, team areas and everything off the court. Included in the final report."
              levels={BENCH_LEVELS}
              score={benchScore}
              na={benchNa}
              note={benchNote}
              onScore={setBenchScore}
              onNa={(v) => { setBenchNa(v); if (v) setBenchScore(null) }}
              onNote={setBenchNote}
              notePlaceholder="How they handled team areas, substitutions, sanctions, spectators/coaches off the court…"
              noteLabel="Bench & off-court notes"
              disabledHint={!benchEnabled ? 'Kept in your draft for now — a quick database update is needed before this rating is stored on the server.' : ''}
            />
          )}

          {/* ── Section 2: The 5 Criteria (hidden for line judges) ────────── */}
          {!ljMode && (
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
                  na={criteriaData[criterion.key].na}
                  onScore={(v) => setCriterion(criterion.key, 'score', v)}
                  onRepeat={(v) => setCriterion(criterion.key, 'repeat', v)}
                  onNote={(v) => setCriterion(criterion.key, 'note', v)}
                  onNa={(v) => setCriterion(criterion.key, 'na', v)}
                  error={!!errors[`score_${criterion.key}`]}
                />
              ))}
            </div>
          </div>
          )}

          {/* ── Section 4: General Notes ──────────────────────────────────── */}
          <Card>
            <CardHeader className="py-3">
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-[#2D3270]">
                {ljMode ? 'Line Judge Evaluation' : 'General Feedback'}
              </h2>
            </CardHeader>
            <CardBody>
              {ljMode && (
                <p className="text-[11px] text-gray-500 mb-2">
                  Written evaluation only — no numeric score. Write in any language; it is translated to English automatically.
                </p>
              )}
              <NoteField
                value={generalNotes}
                onChange={setGeneralNotes}
                placeholder={ljMode
                  ? 'Assess the line judge: accuracy of calls, positioning, focus, communication with the referee…'
                  : 'Overall impressions, strengths, areas for improvement…'}
                rows={ljMode ? 6 : 4}
              />
            </CardBody>
          </Card>

          {/* ── Section 5: Save & Share ───────────────────────────────────── */}
          <div className="space-y-3">
            {/* Save button */}
            {!savedEval ? (
              <>
                {/* Draft controls — save progress and resume later */}
                {refereeId && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={saveDraftNow}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Pencil size={14} /> Save draft
                      </Button>
                      {draftSavedAt && (
                        <button
                          type="button"
                          onClick={discardDraft}
                          className="text-xs font-semibold text-gray-500 hover:text-red-500 px-2 py-1 transition-colors shrink-0"
                        >
                          Discard
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      {draftSavedAt
                        ? `Draft saved · ${new Date(draftSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. You can close the app or switch pages — it resumes here automatically.`
                        : 'Your progress is saved automatically on this device. Tap “Save draft” to keep it and resume later.'}
                    </p>
                  </div>
                )}

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
              </>
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

      {/* ── Section 3: Sticky live score bar (hidden for line judges) ────── */}
      {!ljMode && <LiveScoreBar scores={scores} repeats={repeats} difficulty={difficulty} />}
    </div>
  )
}
