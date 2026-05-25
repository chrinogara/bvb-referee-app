import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft,
  Pencil,
  AlertTriangle,
  ClipboardList,
  TrendingUp,
  User,
  CalendarDays,
  Activity,
  Trash2,
  RotateCcw,
} from 'lucide-react'
import { toast } from '../components/ui/Toast'

import { Header } from '../components/layout/Header'
import { Card, CardHeader, CardBody, CardTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { ScoreCircle } from '../components/ui/ScoreCircle'

import { useReferee, useReferees } from '../hooks/useReferees'
import { useEvaluations } from '../hooks/useEvaluations'
import { useRanking } from '../hooks/useRanking'

import {
  cn,
  formatDate,
  refereeName,
  refereeInitials,
  levelColor,
  scoreColor,
  roleColor,
} from '../lib/utils'
import { CRITERIA, getGrade, getGradeColor, getGradeBg } from '../lib/scoring'

// ─── helpers ─────────────────────────────────────────────────────────────────

function hasRepeat(ev) {
  return (
    ev.repeat_positioning ||
    ev.repeat_signals ||
    ev.repeat_attitude ||
    ev.repeat_captain_comm ||
    ev.repeat_presentation
  )
}

function repeatCount(ev) {
  return [
    ev.repeat_positioning,
    ev.repeat_signals,
    ev.repeat_attitude,
    ev.repeat_captain_comm,
    ev.repeat_presentation,
  ].filter(Boolean).length
}

const CRITERION_SCORE_KEYS = {
  positioning:  'score_positioning',
  signals:      'score_signals',
  attitude:     'score_attitude',
  captain_comm: 'score_captain_comm',
  presentation: 'score_presentation',
}

const CRITERION_REPEAT_KEYS = {
  positioning:  'repeat_positioning',
  signals:      'repeat_signals',
  attitude:     'repeat_attitude',
  captain_comm: 'repeat_captain_comm',
  presentation: 'repeat_presentation',
}

// ─── CriterionBar (simple CSS bar) ───────────────────────────────────────────

function CriterionBar({ label, score, weight }) {
  if (score == null) return null
  const pct = Math.round((score / 5) * 100)
  const barColor =
    score >= 4.5 ? 'bg-emerald-500' :
    score >= 3.5 ? 'bg-green-500' :
    score >= 2.5 ? 'bg-yellow-500' :
    score >= 1.5 ? 'bg-orange-500' :
    'bg-red-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 truncate pr-2">{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-gray-600">{weight}%</span>
          <span className={cn('font-bold w-8 text-right', scoreColor(score))}>
            {score.toFixed(2)}
          </span>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Edit Referee Modal ───────────────────────────────────────────────────────

function EditRefereeModal({ open, onClose, referee, onSave }) {
  const [form, setForm] = useState({
    first_name: referee?.first_name || '',
    last_name: referee?.last_name || '',
    gender: referee?.gender || 'M',
    ranking_level: referee?.ranking_level || 'B',
    notes: referee?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  // Sync when referee changes
  useMemo(() => {
    if (referee) {
      setForm({
        first_name: referee.first_name || '',
        last_name: referee.last_name || '',
        gender: referee.gender || 'M',
        ranking_level: referee.ranking_level || 'B',
        notes: referee.notes || '',
      })
    }
  }, [referee])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  function validate() {
    const errs = {}
    if (!form.first_name.trim()) errs.first_name = 'Required'
    if (!form.last_name.trim()) errs.last_name = 'Required'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      await onSave({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        gender: form.gender,
        ranking_level: form.ranking_level,
        notes: form.notes.trim() || null,
      })
      onClose()
    } catch (err) {
      setErrors({ submit: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Referee">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            error={errors.first_name}
          />
          <Input
            label="Last Name"
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            error={errors.last_name}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Gender"
            name="gender"
            value={form.gender}
            onChange={handleChange}
          >
            <option value="M">Male</option>
            <option value="F">Female</option>
          </Select>
          <Select
            label="Level"
            name="ranking_level"
            value={form.ranking_level}
            onChange={handleChange}
          >
            <option value="A">Level A</option>
            <option value="B">Level B</option>
            <option value="C">Level C</option>
          </Select>
        </div>
        <Textarea
          label="Notes"
          name="notes"
          value={form.notes}
          onChange={handleChange}
          placeholder="Internal notes about this referee…"
          rows={3}
        />
        {errors.submit && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {errors.submit}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" loading={saving}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── RefereeProfile Page ──────────────────────────────────────────────────────

export default function RefereeProfile() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { referee, loading: refLoading } = useReferee(id)
  const { update } = useReferees()
  const { evaluations, loading: evalLoading, remove, resetForReferee, refetch } = useEvaluations({ refereeId: id })
  const { ranking } = useRanking()

  const [editOpen, setEditOpen] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function handleDeleteEval(evId) {
    if (!confirm('Delete this evaluation? This cannot be undone.')) return
    setDeletingId(evId)
    try {
      await remove(evId)
      toast.success('Evaluation deleted')
      // Trigger ranking refresh so RefereeProfile stats update
      refetch()
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleResetAll() {
    setResetting(true)
    try {
      await resetForReferee(id)
      setResetConfirmOpen(false)
      toast.success('All evaluations cleared')
      refetch()
    } catch (err) {
      toast.error(err.message || 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  // Ranking data for this referee
  const rankData = useMemo(
    () => ranking.find((r) => r.id === id) || null,
    [ranking, id]
  )

  // Evaluations sorted newest first
  const sortedEvals = useMemo(
    () =>
      [...evaluations].sort(
        (a, b) =>
          new Date(b.match_date || b.created_at) -
          new Date(a.match_date || a.created_at)
      ),
    [evaluations]
  )

  // Avg score per criterion
  const criterionAvgs = useMemo(() => {
    if (!evaluations.length) return {}
    const sums = {}
    CRITERIA.forEach((c) => { sums[c.key] = 0 })
    evaluations.forEach((ev) => {
      CRITERIA.forEach((c) => {
        const val = ev[CRITERION_SCORE_KEYS[c.key]]
        if (val != null) sums[c.key] += val
      })
    })
    const avgs = {}
    CRITERIA.forEach((c) => {
      avgs[c.key] = Math.round((sums[c.key] / evaluations.length) * 100) / 100
    })
    return avgs
  }, [evaluations])

  // Total repeat faults across all evaluations
  const totalRepeatFaults = useMemo(
    () => evaluations.reduce((acc, ev) => acc + repeatCount(ev), 0),
    [evaluations]
  )

  // Last evaluated date
  const lastEvalDate = useMemo(() => {
    if (!sortedEvals.length) return null
    return sortedEvals[0].match_date || sortedEvals[0].created_at
  }, [sortedEvals])

  // ── Loading skeleton ──
  if (refLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Loading…"
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft size={15} /> Back
            </Button>
          }
        />
        <div className="p-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!referee) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Not Found" />
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center p-8">
          <User size={40} className="text-gray-700" />
          <p className="text-sm text-gray-500">Referee not found.</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/referees')}>
            <ArrowLeft size={14} /> Back to Referees
          </Button>
        </div>
      </div>
    )
  }

  const lvlColor = levelColor(referee.ranking_level)
  const initials = refereeInitials(referee)

  return (
    <div className="flex flex-col h-full">
      <Header
        title={refereeName(referee)}
        subtitle={`Level ${referee.ranking_level}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil size={14} /> Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft size={15} /> Back
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* ── Profile Card ── */}
        <Card>
          <CardBody className="flex items-start gap-4">
            {/* Large avatar */}
            <div
              className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl shrink-0',
                lvlColor
              )}
            >
              {initials}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <h2 className="text-base font-bold text-gray-900">{refereeName(referee)}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {referee.gender === 'M' ? 'Male' : 'Female'} · Joined{' '}
                  {referee.created_at
                    ? formatDistanceToNow(new Date(referee.created_at), { addSuffix: true })
                    : '—'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-xs px-2.5 py-1 rounded-full font-bold', lvlColor)}>
                  Level {referee.ranking_level}
                </span>
                <Badge variant={referee.gender === 'M' ? 'blue' : 'amber'} size="xs">
                  {referee.gender === 'M' ? 'Male' : 'Female'}
                </Badge>
                {rankData?.avg_score != null && (
                  <Badge variant="green" size="xs">
                    Avg {rankData.avg_score.toFixed(2)}
                  </Badge>
                )}
              </div>

              {referee.notes && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-white/8">
                  {referee.notes}
                </p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* ── Ranking Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              icon: ClipboardList,
              label: 'Evaluations',
              value: evaluations.length,
            },
            {
              icon: TrendingUp,
              label: 'Avg Score',
              value: rankData?.avg_score != null ? rankData.avg_score.toFixed(2) : '—',
            },
            {
              icon: AlertTriangle,
              label: 'Repeat Faults',
              value: totalRepeatFaults,
              warn: totalRepeatFaults > 0,
            },
            {
              icon: CalendarDays,
              label: 'Last Evaluated',
              value: lastEvalDate
                ? formatDistanceToNow(new Date(lastEvalDate), { addSuffix: true })
                : '—',
              small: true,
            },
          ].map((s) => (
            <Card key={s.label} className="p-3 flex items-start gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  s.warn ? 'bg-orange-500/15' : 'bg-[#2D3270]/30'
                )}
              >
                <s.icon
                  size={16}
                  className={s.warn ? 'text-orange-400' : 'text-[#2D3270]'}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">
                  {s.label}
                </p>
                <p
                  className={cn(
                    'font-bold text-gray-900 mt-0.5',
                    s.small ? 'text-xs' : 'text-lg',
                    s.warn && totalRepeatFaults > 0 && 'text-orange-400'
                  )}
                >
                  {s.value}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* ── Performance Charts ── */}
        {evaluations.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-[#2D3270]" />
                <CardTitle>Performance by Criterion</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {CRITERIA.map((c) => (
                <CriterionBar
                  key={c.key}
                  label={c.label}
                  score={criterionAvgs[c.key]}
                  weight={c.weight}
                />
              ))}
              <p className="text-[10px] text-gray-600 text-right pt-1">
                Based on {evaluations.length} evaluation{evaluations.length !== 1 ? 's' : ''}
              </p>
            </CardBody>
          </Card>
        )}

        {/* ── Evaluation History ── */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList size={15} className="text-[#2D3270]" />
              <CardTitle>Evaluation History</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{evaluations.length} total</span>
              {evaluations.length > 0 && (
                <Button
                  variant="danger"
                  size="xs"
                  onClick={() => setResetConfirmOpen(true)}
                >
                  <RotateCcw size={11} /> Reset all
                </Button>
              )}
            </div>
          </CardHeader>

          {evalLoading ? (
            <CardBody className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </CardBody>
          ) : sortedEvals.length === 0 ? (
            <CardBody>
              <div className="text-center py-8 text-sm text-gray-500">
                No evaluations recorded yet.
              </div>
            </CardBody>
          ) : (
            <div className="divide-y divide-gray-100">
              {sortedEvals.map((ev) => {
                const grade = getGrade(ev.overall_score)
                const repeatWarning = hasRepeat(ev)
                const faultCount = repeatCount(ev)

                return (
                  <div key={ev.id} className="px-4 py-3 hover:bg-white/3 transition-colors">
                    {/* Row top: date + tournament + role + score */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500">
                            {formatDate(ev.match_date)}
                          </span>
                          {ev.tournaments?.name && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[130px]">
                              {ev.tournaments.name}
                            </span>
                          )}
                          {ev.role && (
                            <span
                              className={cn(
                                'text-xs px-2 py-0.5 rounded-full font-medium',
                                roleColor(ev.role)
                              )}
                            >
                              {ev.role}
                            </span>
                          )}
                          {repeatWarning && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5">
                              <AlertTriangle size={10} />
                              {faultCount} repeat{faultCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {ev.match_number && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            Match #{ev.match_number}
                            {ev.court ? ` · Court ${ev.court}` : ''}
                          </p>
                        )}
                      </div>

                      {/* Overall score */}
                      <div className="text-right shrink-0 flex items-start gap-2">
                        <div>
                          <span
                            className={cn('text-lg font-bold', scoreColor(ev.overall_score))}
                          >
                            {ev.overall_score?.toFixed(1) ?? '—'}
                          </span>
                          <p
                            className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                              grade.color,
                              grade.bg
                            )}
                          >
                            {grade.grade}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteEval(ev.id)}
                          disabled={deletingId === ev.id}
                          className="p-1.5 rounded-lg hover:bg-red-500/15 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
                          aria-label="Delete evaluation"
                          title="Delete this evaluation"
                        >
                          {deletingId === ev.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Criteria scores row */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {CRITERIA.map((c) => {
                        const scoreVal = ev[CRITERION_SCORE_KEYS[c.key]]
                        const isRepeat = ev[CRITERION_REPEAT_KEYS[c.key]]
                        if (scoreVal == null) return null
                        return (
                          <div
                            key={c.key}
                            title={c.label}
                            className={cn(
                              'flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs',
                              isRepeat
                                ? 'bg-orange-500/10 border border-orange-500/20'
                                : 'bg-gray-50'
                            )}
                          >
                            <span className="text-gray-500 text-[10px] uppercase tracking-wide">
                              {c.key === 'captain_comm' ? 'Capt' : c.key.slice(0, 4)}
                            </span>
                            <span
                              className={cn(
                                'font-bold',
                                isRepeat ? 'text-orange-400' : scoreColor(scoreVal)
                              )}
                            >
                              {scoreVal}
                              {isRepeat && '⚠'}
                            </span>
                          </div>
                        )
                      })}
                      {ev.repeat_penalty > 0 && (
                        <span className="text-xs text-orange-400 ml-auto">
                          −{ev.repeat_penalty.toFixed(1)} penalty
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {ev.notes && (
                      <p className="text-xs text-gray-500 mt-2 bg-white/3 rounded-lg px-2 py-1.5 italic">
                        "{ev.notes}"
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

      </div>

      {/* Edit Modal */}
      <EditRefereeModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        referee={referee}
        onSave={(data) => update(id, data)}
      />

      {/* Reset confirmation modal */}
      <Modal
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title="Reset all evaluations?"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
            <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">
              <p className="font-semibold mb-1">This action cannot be undone.</p>
              <p className="text-xs text-red-300/80">
                All <span className="font-bold">{evaluations.length}</span> evaluation
                {evaluations.length !== 1 ? 's' : ''} for{' '}
                <span className="font-bold">
                  {referee?.first_name} {referee?.last_name}
                </span>{' '}
                will be permanently deleted. The referee profile and ranking will remain
                but the average score and history will be cleared.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setResetConfirmOpen(false)}
              disabled={resetting}
              className="w-full"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleResetAll}
              loading={resetting}
              className="w-full"
            >
              <RotateCcw size={14} /> Reset all
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
