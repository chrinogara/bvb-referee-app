import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  Save,
  AlertTriangle,
  Target,
  Wrench,
  MessageSquare,
  StickyNote,
  Download,
  Trash2,
} from 'lucide-react'

import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardBody, CardTitle } from '../components/ui/Card'
import { Select, Textarea } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { toast } from '../components/ui/Toast'

import { useTournaments } from '../hooks/useTournaments'
import { briefingService } from '../lib/supabase'
import { formatDate, formatDateTime } from '../lib/utils'

// 5 sections of the briefing, in order
const SECTIONS = [
  {
    key: 'key_points',
    label: 'Key Points',
    icon: Target,
    placeholder:
      'Top messages for the team: tournament-specific rules, what to emphasise this weekend, schedule notes…',
    color: 'text-[#E85D26]',
  },
  {
    key: 'common_faults',
    label: 'Common Faults from previous tournaments',
    icon: AlertTriangle,
    placeholder:
      'Recurring mistakes from feedback received: e.g. delayed whistle on net touch, weak captain communication, inconsistent ball-mark protocol…',
    color: 'text-amber-600',
  },
  {
    key: 'technical_focus',
    label: 'Technical Focus',
    icon: Wrench,
    placeholder:
      'Aspects to reinforce: 3-step protocol timing, line-judge eye contact, scoresheet accuracy, positioning during long rallies…',
    color: 'text-blue-600',
  },
  {
    key: 'captain_communication',
    label: 'Captain Communication',
    icon: MessageSquare,
    placeholder:
      'Standards for how referees interact with captains: tone, when to invoke Protest Protocol, handling of disagreements…',
    color: 'text-purple-600',
  },
  {
    key: 'general_notes',
    label: 'Free Notes',
    icon: StickyNote,
    placeholder: 'Anything else: weather, logistics, contacts, special procedures…',
    color: 'text-gray-600',
  },
]

export default function Briefing() {
  const [searchParams] = useSearchParams()
  const { tournaments } = useTournaments()

  const [tournamentId, setTournamentId] = useState(searchParams.get('tournamentId') || '')
  const [briefing, setBriefing] = useState({
    key_points: '',
    common_faults: '',
    technical_focus: '',
    captain_communication: '',
    general_notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)

  const tournament = tournaments.find((t) => t.id === tournamentId)

  // Auto-select closest tournament
  useEffect(() => {
    if (!tournamentId && tournaments.length > 0) {
      const now = new Date()
      const closest = [...tournaments].sort(
        (a, b) =>
          Math.abs(new Date(a.start_date) - now) - Math.abs(new Date(b.start_date) - now)
      )[0]
      if (closest) setTournamentId(closest.id)
    }
  }, [tournaments, tournamentId])

  // Load briefing for selected tournament
  const loadBriefing = useCallback(async () => {
    if (!tournamentId) return
    setLoading(true)
    const { data } = await briefingService.getByTournament(tournamentId)
    if (data) {
      setBriefing({
        key_points: data.key_points || '',
        common_faults: data.common_faults || '',
        technical_focus: data.technical_focus || '',
        captain_communication: data.captain_communication || '',
        general_notes: data.general_notes || '',
      })
      setLastSavedAt(data.updated_at)
    } else {
      setBriefing({
        key_points: '',
        common_faults: '',
        technical_focus: '',
        captain_communication: '',
        general_notes: '',
      })
      setLastSavedAt(null)
    }
    setDirty(false)
    setLoading(false)
  }, [tournamentId])

  useEffect(() => { loadBriefing() }, [loadBriefing])

  function setField(key, value) {
    setBriefing((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function handleSave() {
    if (!tournamentId) {
      toast.error('Select a tournament first')
      return
    }
    setSaving(true)
    try {
      const { data, error } = await briefingService.upsert({
        tournament_id: tournamentId,
        ...briefing,
      })
      if (error) throw new Error(error.message)
      setLastSavedAt(data.updated_at)
      setDirty(false)
      toast.success('Briefing saved')
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!confirm('Clear the briefing for this tournament? This cannot be undone.')) return
    await briefingService.delete(tournamentId)
    setBriefing({
      key_points: '',
      common_faults: '',
      technical_focus: '',
      captain_communication: '',
      general_notes: '',
    })
    setDirty(false)
    setLastSavedAt(null)
    toast('Briefing cleared', 'info')
  }

  function handleExport() {
    if (!tournament) return
    const lines = [
      `BVB Referee Briefing`,
      `${tournament.name} — ${formatDate(tournament.start_date)} → ${formatDate(tournament.end_date)}`,
      '='.repeat(60),
      '',
    ]
    for (const s of SECTIONS) {
      const content = briefing[s.key]?.trim()
      if (!content) continue
      lines.push(`### ${s.label} ###`)
      lines.push(content)
      lines.push('')
    }
    lines.push('')
    lines.push(`— RC Nogara Christian, CEV Referee Coach · Generated ${formatDate(new Date())}`)

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `BVB_Briefing_${tournament.name.replace(/\s+/g, '_')}_${formatDate(tournament.start_date).replace(/\s+/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Briefing exported')
  }

  const filledCount = SECTIONS.filter((s) => briefing[s.key]?.trim()).length

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Tournament Briefing"
        subtitle={
          tournament
            ? `${tournament.name} — ${formatDate(tournament.start_date)}`
            : 'Pre-tournament team briefing'
        }
        actions={
          dirty && (
            <Badge variant="amber" size="sm">
              Unsaved
            </Badge>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">
        {/* Tournament selector */}
        <Card>
          <CardBody className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
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
            <div className="flex gap-2">
              <Button variant="ghost" size="md" onClick={handleExport} disabled={!tournament}>
                <Download size={14} /> Export
              </Button>
              {lastSavedAt && (
                <Button variant="ghost" size="md" onClick={handleClear} disabled={!tournament}>
                  <Trash2 size={14} /> Clear
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        {tournament && (
          <>
            {/* Progress bar */}
            <Card>
              <CardBody className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen size={18} className="text-[#E85D26]" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Briefing progress
                    </p>
                    <p className="text-xs text-gray-500">
                      {filledCount} / {SECTIONS.length} sections completed
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E85D26] transition-all"
                      style={{ width: `${(filledCount / SECTIONS.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700">
                    {Math.round((filledCount / SECTIONS.length) * 100)}%
                  </span>
                </div>
              </CardBody>
            </Card>

            {/* Sections */}
            {SECTIONS.map((s) => {
              const Icon = s.icon
              const value = briefing[s.key] || ''
              return (
                <Card key={s.key}>
                  <CardHeader className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={s.color} />
                      <CardTitle>{s.label}</CardTitle>
                    </div>
                    {value.trim() && (
                      <Badge variant="green" size="xs">
                        {value.split(/\s+/).filter(Boolean).length} words
                      </Badge>
                    )}
                  </CardHeader>
                  <CardBody>
                    <Textarea
                      value={value}
                      onChange={(e) => setField(s.key, e.target.value)}
                      placeholder={s.placeholder}
                      rows={5}
                    />
                  </CardBody>
                </Card>
              )
            })}

            {/* Save bar */}
            <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
                <span className="text-xs text-gray-500">
                  {loading
                    ? 'Loading…'
                    : lastSavedAt
                    ? `Last saved: ${formatDateTime(lastSavedAt)}`
                    : 'Not yet saved'}
                </span>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSave}
                  loading={saving}
                  disabled={!dirty}
                >
                  <Save size={14} /> Save briefing
                </Button>
              </div>
            </div>
          </>
        )}

        {!tournament && (
          <Card>
            <CardBody className="text-center py-10 text-sm text-gray-500">
              Select a tournament above to start writing the briefing.
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
