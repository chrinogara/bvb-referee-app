import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, MapPin, Plus, Star, ChevronRight, Calendar } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Input, Select } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { useTournaments } from '../hooks/useTournaments'
import {
  cn,
  formatDate,
  isUpcoming,
  isOngoing,
  isPast,
  tournamentDuration,
} from '../lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ tournament }) {
  if (isOngoing(tournament)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        ONGOING
      </span>
    )
  }
  if (isUpcoming(tournament)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 bg-blue-400/10 px-2.5 py-0.5 rounded-full">
        UPCOMING
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-500/10 px-2.5 py-0.5 rounded-full">
      PAST
    </span>
  )
}

function StarRating({ rating }) {
  if (!rating) return null
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: rating }).map((_, i) => (
        <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
      ))}
      {Array.from({ length: 3 - rating }).map((_, i) => (
        <Star key={i} size={12} className="text-gray-600" />
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

// ─── Add Tournament Modal ─────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  location: '',
  start_date: '',
  end_date: '',
  star_rating: '2',
  is_finals: false,
}

function AddTournamentModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Tournament name is required.'); return }
    if (!form.start_date) { setError('Start date is required.'); return }
    if (!form.end_date) { setError('End date is required.'); return }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      setError('End date must be on or after start date.')
      return
    }
    setSaving(true)
    try {
      await onCreate({
        ...form,
        star_rating: parseInt(form.star_rating, 10),
      })
      setForm(EMPTY_FORM)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create tournament.')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setForm(EMPTY_FORM)
    setError('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Tournament" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Tournament Name"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="e.g. BVB Tour Milano"
          required
        />
        <Input
          label="Location"
          name="location"
          value={form.location}
          onChange={handleChange}
          placeholder="e.g. Milano, Italy"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Date"
            name="start_date"
            type="date"
            value={form.start_date}
            onChange={handleChange}
            required
          />
          <Input
            label="End Date"
            name="end_date"
            type="date"
            value={form.end_date}
            onChange={handleChange}
            required
          />
        </div>
        <Select
          label="Star Rating"
          name="star_rating"
          value={form.star_rating}
          onChange={handleChange}
        >
          <option value="1">1 Star</option>
          <option value="2">2 Stars</option>
          <option value="3">3 Stars</option>
        </Select>

        {/* Finals checkbox */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              name="is_finals"
              checked={form.is_finals}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className={cn(
              'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
              form.is_finals
                ? 'bg-[#E85D26] border-[#E85D26]'
                : 'border-white/20 bg-gray-800'
            )}>
              {form.is_finals && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-gray-300">This is a Finals event</span>
        </label>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={handleClose} className="flex-1" type="button">
            Cancel
          </Button>
          <Button type="submit" loading={saving} className="flex-1">
            Create Tournament
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Tournament Card ──────────────────────────────────────────────────────────

function TournamentCard({ tournament, onClick }) {
  const ongoing = isOngoing(tournament)
  const past = isPast(tournament)

  return (
    <Card
      onClick={onClick}
      className={cn(
        'transition-all duration-200 active:scale-[0.99]',
        ongoing && 'ring-1 ring-emerald-500/30',
        past && 'opacity-75'
      )}
    >
      <CardBody className="p-4">
        <div className="flex items-start gap-3">
          {/* Left: icon */}
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            ongoing ? 'bg-emerald-500/15' : past ? 'bg-gray-700/40' : 'bg-[#2D3270]/30'
          )}>
            <Trophy size={18} className={cn(
              ongoing ? 'text-emerald-400' : past ? 'text-gray-500' : 'text-[#7B85C9]'
            )} />
          </div>

          {/* Center: info */}
          <div className="flex-1 min-w-0">
            {/* Top row: status + finals badge */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <StatusBadge tournament={tournament} />
              {tournament.is_finals && (
                <Badge variant="orange" size="xs">FINALS</Badge>
              )}
            </div>

            {/* Name */}
            <h3 className="text-sm font-semibold text-white leading-snug truncate">
              {tournament.name}
            </h3>

            {/* Date + duration */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Calendar size={11} className="text-gray-500" />
                {formatDateRange(tournament.start_date, tournament.end_date)}
              </span>
              <span className="text-xs text-gray-600">·</span>
              <span className="text-xs text-gray-500">{tournamentDuration(tournament)}</span>
            </div>

            {/* Location */}
            {tournament.location && (
              <div className="flex items-center gap-1 mt-1">
                <MapPin size={11} className="text-gray-500 flex-shrink-0" />
                <span className="text-xs text-gray-400 truncate">{tournament.location}</span>
              </div>
            )}

            {/* Star rating */}
            <div className="mt-2">
              <StarRating rating={tournament.star_rating} />
            </div>
          </div>

          {/* Right: chevron */}
          <ChevronRight size={16} className="text-gray-600 flex-shrink-0 mt-1" />
        </div>
      </CardBody>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Tournaments() {
  const navigate = useNavigate()
  const { tournaments, loading, error, create } = useTournaments()
  const [showAdd, setShowAdd] = useState(false)

  // Split by status for ordered display
  const ongoing  = tournaments.filter(isOngoing)
  const upcoming = tournaments.filter(isUpcoming)
  const past     = tournaments.filter(isPast)

  const sections = [
    { label: 'Ongoing',  items: ongoing },
    { label: 'Upcoming', items: upcoming },
    { label: 'Past',     items: past },
  ].filter((s) => s.items.length > 0)

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header
        title="Tournaments"
        subtitle="2026 Season"
        actions={
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={15} />
            Add Tournament
          </Button>
        }
      />

      <main className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full">
        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-gray-900 animate-pulse" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
            Failed to load tournaments: {error}
          </div>
        )}

        {!loading && !error && tournaments.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center">
              <Trophy size={24} className="text-gray-600" />
            </div>
            <div>
              <p className="text-white font-medium">No tournaments yet</p>
              <p className="text-sm text-gray-500 mt-1">Add your first tournament to get started.</p>
            </div>
            <Button onClick={() => setShowAdd(true)}>
              <Plus size={15} />
              Add Tournament
            </Button>
          </div>
        )}

        {!loading && !error && sections.length > 0 && (
          <div className="flex flex-col gap-6">
            {sections.map(({ label, items }) => (
              <section key={label}>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 px-0.5">
                  {label} · {items.length}
                </h2>
                <div className="flex flex-col gap-3">
                  {items.map((t) => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      onClick={() => navigate(`/tournaments/${t.id}`)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <AddTournamentModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreate={create}
      />
    </div>
  )
}
