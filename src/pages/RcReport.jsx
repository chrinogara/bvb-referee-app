import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  Download,
  Trash2,
  FileText,
  Cloud,
  Users as UsersIcon,
  Star,
  Award,
  AlertTriangle,
  Wrench,
  Building2,
  Lightbulb,
  StickyNote,
} from 'lucide-react'

import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardBody, CardTitle } from '../components/ui/Card'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { toast } from '../components/ui/Toast'

import { useTournaments } from '../hooks/useTournaments'
import { rcReportService } from '../lib/supabase'
import { generateRcReportPDF, downloadPDF } from '../lib/pdf'
import { formatDate, formatDateTime } from '../lib/utils'

// 8 sections — comprehensive RC post-tournament report
const SECTIONS = [
  {
    key: 'context',
    label: 'Tournament Context',
    icon: Cloud,
    color: 'text-[#2D3270]',
    fields: [
      { key: 'tournament_level', label: 'Tournament Level', type: 'select', options: ['1-Star', '2-Star', '3-Star', '4-Star', '5-Star', 'CEV', 'Continental', 'World Tour'] },
      { key: 'weather_conditions', label: 'Weather Conditions', type: 'textarea', placeholder: 'e.g. sunny days 1-2, heavy rain day 3, strong wind in afternoons…', rows: 3 },
    ],
  },
  {
    key: 'team',
    label: 'Refereeing Team',
    icon: UsersIcon,
    color: 'text-blue-600',
    fields: [
      { key: 'total_referees',   label: 'Total Referees', type: 'number' },
      { key: 'referees_a_level', label: 'Level A',        type: 'number' },
      { key: 'referees_b_level', label: 'Level B',        type: 'number' },
      { key: 'referees_c_level', label: 'Level C',        type: 'number' },
      { key: 'observed_count',   label: 'Personally Observed', type: 'number' },
    ],
    inline: true,
  },
  {
    key: 'performance',
    label: 'Overall Performance',
    icon: Award,
    color: 'text-emerald-600',
    fields: [
      {
        key: 'overall_performance',
        label: 'Global Rating',
        type: 'select',
        options: ['EXCELLENT', 'GOOD', 'ADEQUATE', 'BELOW STANDARD', 'POOR'],
      },
      { key: 'strengths',              label: 'Strengths Observed',     type: 'textarea', rows: 4 },
      { key: 'areas_for_improvement',  label: 'Areas for Improvement',  type: 'textarea', rows: 4 },
    ],
  },
  {
    key: 'highlights',
    label: 'Individual Highlights',
    icon: Star,
    color: 'text-amber-600',
    fields: [
      { key: 'top_performers',        label: 'Top Performers',          type: 'textarea', rows: 3 },
      { key: 'refs_needing_followup', label: 'Referees Needing Follow-up', type: 'textarea', rows: 3 },
    ],
  },
  {
    key: 'technical',
    label: 'Technical Aspects',
    icon: Wrench,
    color: 'text-purple-600',
    fields: [
      { key: 'rules_application',    label: 'Rules Application',     type: 'textarea', rows: 3 },
      { key: 'three_step_protocol',  label: 'Three-Step Protocol',   type: 'textarea', rows: 3 },
      { key: 'signals_consistency',  label: 'Signals Consistency',   type: 'textarea', rows: 3 },
      { key: 'captain_communication',label: 'Captain Communication', type: 'textarea', rows: 3 },
    ],
  },
  {
    key: 'organizational',
    label: 'Organizational Aspects',
    icon: Building2,
    color: 'text-cyan-600',
    fields: [
      { key: 'court_conditions',  label: 'Court Conditions',  type: 'textarea', rows: 3 },
      { key: 'equipment_quality', label: 'Equipment Quality', type: 'textarea', rows: 3 },
      { key: 'scheduling',        label: 'Scheduling',        type: 'textarea', rows: 3 },
      { key: 'hospitality',       label: 'Hospitality',       type: 'textarea', rows: 3 },
    ],
  },
  {
    key: 'incidents',
    label: 'Incidents & Protests',
    icon: AlertTriangle,
    color: 'text-red-600',
    fields: [
      { key: 'incidents', label: 'Notable Incidents', type: 'textarea', rows: 3 },
      { key: 'protests',  label: 'Protests Lodged',   type: 'textarea', rows: 3 },
    ],
  },
  {
    key: 'recommendations',
    label: 'Recommendations',
    icon: Lightbulb,
    color: 'text-orange-600',
    fields: [
      { key: 'recs_referees',       label: 'For the Referees',       type: 'textarea', rows: 3 },
      { key: 'recs_organizers',     label: 'For the Organizers',     type: 'textarea', rows: 3 },
      { key: 'recs_rc_commission',  label: 'For the RC Commission',  type: 'textarea', rows: 3 },
    ],
  },
  {
    key: 'final',
    label: 'Final Remarks',
    icon: StickyNote,
    color: 'text-gray-600',
    fields: [
      { key: 'final_remarks', label: 'Closing Notes', type: 'textarea', rows: 4 },
    ],
  },
]

const EMPTY_REPORT = {
  tournament_level: '',
  weather_conditions: '',
  total_referees: '',
  referees_a_level: '',
  referees_b_level: '',
  referees_c_level: '',
  observed_count: '',
  overall_performance: '',
  strengths: '',
  areas_for_improvement: '',
  top_performers: '',
  refs_needing_followup: '',
  rules_application: '',
  three_step_protocol: '',
  signals_consistency: '',
  captain_communication: '',
  court_conditions: '',
  equipment_quality: '',
  scheduling: '',
  hospitality: '',
  incidents: '',
  protests: '',
  recs_referees: '',
  recs_organizers: '',
  recs_rc_commission: '',
  final_remarks: '',
}

export default function RcReport() {
  const [searchParams] = useSearchParams()
  const { tournaments } = useTournaments()

  const [tournamentId, setTournamentId] = useState(searchParams.get('tournamentId') || '')
  const [report, setReport] = useState(EMPTY_REPORT)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
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

  // Load report
  const loadReport = useCallback(async () => {
    if (!tournamentId) return
    setLoading(true)
    const { data } = await rcReportService.getByTournament(tournamentId)
    if (data) {
      setReport({ ...EMPTY_REPORT, ...data })
      setLastSavedAt(data.updated_at)
    } else {
      setReport(EMPTY_REPORT)
      setLastSavedAt(null)
    }
    setDirty(false)
    setLoading(false)
  }, [tournamentId])

  useEffect(() => { loadReport() }, [loadReport])

  function setField(key, value) {
    setReport((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function handleSave() {
    if (!tournamentId) {
      toast.error('Select a tournament first')
      return
    }
    setSaving(true)
    try {
      // Coerce numeric fields
      const payload = { tournament_id: tournamentId, ...report }
      for (const k of ['total_referees', 'referees_a_level', 'referees_b_level', 'referees_c_level', 'observed_count']) {
        payload[k] = payload[k] === '' || payload[k] == null ? null : Number(payload[k])
      }
      // Strip empty UI-only fields the DB doesn't have
      delete payload.id
      delete payload.created_at
      delete payload.updated_at

      const { data, error } = await rcReportService.upsert(payload)
      if (error) throw new Error(error.message)
      setLastSavedAt(data.updated_at)
      setDirty(false)
      toast.success('RC Report saved')
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDownload() {
    if (!tournamentId || !tournament) {
      toast.error('Select a tournament first')
      return
    }
    if (dirty) {
      toast.error('Save first, then download')
      return
    }
    setDownloading(true)
    try {
      const blob = await generateRcReportPDF(report, tournament)
      const filename = `BVB_RC_Report_${tournament.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      downloadPDF(blob, filename)
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error(`PDF failed: ${err.message}`)
    } finally {
      setDownloading(false)
    }
  }

  async function handleClear() {
    if (!confirm('Delete the entire RC report for this tournament? This cannot be undone.')) return
    await rcReportService.delete(tournamentId)
    setReport(EMPTY_REPORT)
    setLastSavedAt(null)
    setDirty(false)
    toast('Report cleared', 'info')
  }

  // Count filled fields (excluding numeric defaults of '')
  const filledCount = Object.values(report).filter((v) => v !== '' && v != null).length
  const totalFields = Object.keys(EMPTY_REPORT).length

  return (
    <div className="flex flex-col h-full">
      <Header
        title="RC Post-Tournament Report"
        subtitle={
          tournament
            ? `${tournament.name} — ${formatDate(tournament.start_date)}`
            : 'Compile the RC report for the selected tournament'
        }
        actions={
          <Link
            to="/reports"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-gray-100 text-xs text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={12} /> Back
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full pb-24">
        {/* Tournament selector + progress */}
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
            <div className="flex gap-2 items-center">
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Progress</p>
                <p className="text-sm font-bold text-gray-900">
                  {filledCount} / {totalFields} fields
                </p>
              </div>
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#E85D26] transition-all"
                  style={{ width: `${(filledCount / totalFields) * 100}%` }}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {tournament && (
          <>
            {/* Sections */}
            {SECTIONS.map((s) => {
              const Icon = s.icon
              return (
                <Card key={s.key}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={s.color} />
                      <CardTitle>{s.label}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardBody className={s.inline ? 'grid grid-cols-2 sm:grid-cols-5 gap-3' : 'space-y-3'}>
                    {s.fields.map((f) => {
                      if (f.type === 'select') {
                        return (
                          <Select
                            key={f.key}
                            label={f.label}
                            value={report[f.key] || ''}
                            onChange={(e) => setField(f.key, e.target.value)}
                          >
                            <option value="">—</option>
                            {f.options.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </Select>
                        )
                      }
                      if (f.type === 'number') {
                        return (
                          <Input
                            key={f.key}
                            label={f.label}
                            type="number"
                            min="0"
                            value={report[f.key] ?? ''}
                            onChange={(e) => setField(f.key, e.target.value)}
                          />
                        )
                      }
                      if (f.type === 'textarea') {
                        return (
                          <Textarea
                            key={f.key}
                            label={f.label}
                            value={report[f.key] || ''}
                            onChange={(e) => setField(f.key, e.target.value)}
                            placeholder={f.placeholder || ''}
                            rows={f.rows || 3}
                          />
                        )
                      }
                      return null
                    })}
                  </CardBody>
                </Card>
              )
            })}

            {/* Action buttons */}
            <Card>
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  {loading
                    ? 'Loading…'
                    : lastSavedAt
                    ? `Last saved: ${formatDateTime(lastSavedAt)}`
                    : 'Not yet saved'}
                  {dirty && <Badge variant="amber" size="xs" className="ml-2">Unsaved</Badge>}
                </div>
                <div className="flex gap-2">
                  {lastSavedAt && (
                    <Button variant="ghost" size="sm" onClick={handleClear}>
                      <Trash2 size={13} /> Clear
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleDownload}
                    loading={downloading}
                    disabled={dirty || !lastSavedAt}
                    title={dirty ? 'Save first, then download' : 'Download PDF'}
                  >
                    <Download size={14} /> Download PDF
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSave}
                    loading={saving}
                    disabled={!dirty}
                  >
                    <Save size={14} /> Save
                  </Button>
                </div>
              </CardBody>
            </Card>
          </>
        )}

        {!tournament && (
          <Card>
            <CardBody className="text-center py-10 text-sm text-gray-500">
              Select a tournament to begin compiling the RC report.
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
