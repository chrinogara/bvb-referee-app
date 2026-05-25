import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Users } from 'lucide-react'

import { Header } from '../components/layout/Header'
import { Card, CardBody } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { ScoreCircle } from '../components/ui/ScoreCircle'

import { useReferees } from '../hooks/useReferees'
import { useRanking } from '../hooks/useRanking'

import { cn, refereeName, refereeInitials, levelColor } from '../lib/utils'

// ─── Level Filter Tabs ────────────────────────────────────────────────────────

const LEVEL_TABS = ['All', 'A', 'B', 'C']

function LevelTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
        active
          ? 'bg-[#2D3270] text-white'
          : 'text-gray-400 hover:text-white hover:bg-white/8'
      )}
    >
      {children}
    </button>
  )
}

// ─── Gender badge helper ──────────────────────────────────────────────────────

function GenderBadge({ gender }) {
  if (!gender) return null
  return (
    <Badge
      variant={gender === 'M' ? 'blue' : 'amber'}
      size="xs"
    >
      {gender === 'M' ? 'Male' : 'Female'}
    </Badge>
  )
}

// ─── Referee Card ─────────────────────────────────────────────────────────────

function RefereeCard({ referee, rankData, onClick }) {
  const initials = refereeInitials(referee)
  const lvlColor = levelColor(referee.ranking_level)

  return (
    <div
      onClick={onClick}
      className="bg-gray-900 border border-white/10 rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:border-white/20 hover:bg-gray-800/60 transition-all group"
    >
      {/* Top row: avatar + score */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {/* Initials avatar */}
          <div
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shrink-0',
              lvlColor
            )}
          >
            {initials}
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate group-hover:text-[#E85D26] transition-colors">
              {refereeName(referee)}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {/* Level badge */}
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-bold',
                  lvlColor
                )}
              >
                Level {referee.ranking_level}
              </span>
              <GenderBadge gender={referee.gender} />
            </div>
          </div>
        </div>

        {/* Avg score circle */}
        {rankData?.avg_score != null && (
          <ScoreCircle score={rankData.avg_score} size="sm" />
        )}
      </div>

      {/* Bottom row: eval count */}
      <div className="flex items-center justify-between text-xs text-gray-500 border-t border-white/5 pt-2">
        <span>
          {rankData?.total_evaluations ?? 0} evaluation
          {(rankData?.total_evaluations ?? 0) !== 1 ? 's' : ''}
        </span>
        {rankData?.total_evaluations > 0 && (
          <span className="text-gray-600">View profile →</span>
        )}
      </div>
    </div>
  )
}

// ─── Add Referee Modal ────────────────────────────────────────────────────────

const BLANK_FORM = {
  first_name: '',
  last_name: '',
  gender: 'M',
  ranking_level: 'B',
  notes: '',
}

function AddRefereeModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  function validate() {
    const errs = {}
    if (!form.first_name.trim()) errs.first_name = 'First name is required'
    if (!form.last_name.trim()) errs.last_name = 'Last name is required'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      await onCreate({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        gender: form.gender,
        ranking_level: form.ranking_level,
        notes: form.notes.trim() || null,
      })
      setForm(BLANK_FORM)
      onClose()
    } catch (err) {
      setErrors({ submit: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Referee">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            placeholder="Jan"
            error={errors.first_name}
          />
          <Input
            label="Last Name"
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            placeholder="Peeters"
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
          label="Notes (optional)"
          name="notes"
          value={form.notes}
          onChange={handleChange}
          placeholder="Any additional notes about this referee…"
          rows={3}
        />

        {errors.submit && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {errors.submit}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={saving}>
            <Plus size={15} />
            Add Referee
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Referees Page ────────────────────────────────────────────────────────────

export default function Referees() {
  const navigate = useNavigate()
  const { referees, loading, create } = useReferees()
  const { ranking } = useRanking()

  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('All')
  const [addOpen, setAddOpen] = useState(false)

  // Build a ranking map by referee id for O(1) lookup
  const rankMap = useMemo(() => {
    const m = {}
    ranking.forEach((r) => { m[r.id] = r })
    return m
  }, [ranking])

  // Filtered referees
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return referees.filter((r) => {
      const matchLevel = levelFilter === 'All' || r.ranking_level === levelFilter
      const matchSearch =
        !q ||
        r.first_name.toLowerCase().includes(q) ||
        r.last_name.toLowerCase().includes(q)
      return matchLevel && matchSearch
    })
  }, [referees, search, levelFilter])

  // Count per level for tab labels
  const counts = useMemo(() => {
    const c = { All: referees.length, A: 0, B: 0, C: 0 }
    referees.forEach((r) => { if (r.ranking_level in c) c[r.ranking_level]++ })
    return c
  }, [referees])

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Referees"
        subtitle="Belgian Beach Tour 2026"
        actions={
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={15} />
            Add Referee
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Search */}
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search referees by name…"
            className={cn(
              'w-full pl-9 pr-4 py-2 rounded-xl text-sm',
              'bg-gray-900 border border-white/10 text-white placeholder-gray-500',
              'focus:outline-none focus:border-[#E85D26]/50 focus:ring-1 focus:ring-[#E85D26]/20',
              'transition-colors'
            )}
          />
        </div>

        {/* Level filter tabs */}
        <div className="flex items-center gap-1 bg-gray-900 border border-white/10 rounded-xl p-1 w-fit">
          {LEVEL_TABS.map((tab) => (
            <LevelTab
              key={tab}
              active={levelFilter === tab}
              onClick={() => setLevelFilter(tab)}
            >
              {tab === 'All' ? `All (${counts.All})` : `Level ${tab} (${counts[tab]})`}
            </LevelTab>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-gray-900 border border-white/10 rounded-xl p-4 h-28 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardBody>
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
                  <Users size={26} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">No referees found</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {search
                      ? 'Try adjusting your search or filter'
                      : 'Add the first referee to get started'}
                  </p>
                </div>
                {!search && (
                  <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
                    <Plus size={14} /> Add Referee
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((ref) => (
              <RefereeCard
                key={ref.id}
                referee={ref}
                rankData={rankMap[ref.id]}
                onClick={() => navigate(`/referees/${ref.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <AddRefereeModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={create}
      />
    </div>
  )
}
