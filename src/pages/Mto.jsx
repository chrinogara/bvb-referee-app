import { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Card, CardHeader, CardBody, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { toast } from '../components/ui/Toast'
import { mtoService } from '../lib/supabase'
import { useTournaments } from '../hooks/useTournaments'
import { generateBV15PDF, downloadPDF } from '../lib/pdf'
import { cn, formatDate } from '../lib/utils'
import { Plus, FileText, Trash2, Pencil, Stethoscope, X } from 'lucide-react'

const EMPTY = {
  kind: 'MTO',
  competition_name: '',
  venue_date: '',
  athlete_name: '',
  form_date: '',
  match_number: '',
  hour: '',
  reason: '',
  athlete_signature: '',
  medical_evaluation: '',
  able_to_continue: null,
  remarks: '',
  ack_event_doctor: '',
  ack_medical_delegate: '',
  ack_supervisor: '',
  cert_doctor_name: '',
  court: '',
}

function todayDMY() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}
function nowHM() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function Mto() {
  const { tournaments } = useTournaments()
  const location = useLocation()
  const navigate = useNavigate()
  const prefill = location.state || null

  const [selectedTournamentId, setSelectedTournamentId] = useState('')
  const [dayNumber, setDayNumber] = useState(1)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [busyPdf, setBusyPdf] = useState(null)

  const tournament = useMemo(
    () => tournaments.find((t) => t.id === selectedTournamentId) || null,
    [tournaments, selectedTournamentId]
  )

  // Default tournament selection
  useEffect(() => {
    if (!selectedTournamentId && tournaments.length) {
      setSelectedTournamentId(prefill?.tournamentId || tournaments[0].id)
    }
  }, [tournaments]) // eslint-disable-line

  // Load records for the tournament
  async function load(tid) {
    if (!tid) { setRecords([]); return }
    setLoading(true)
    try {
      const { data } = await mtoService.getByTournament(tid)
      setRecords(data || [])
    } catch (e) {
      toast.error('Could not load MTO records: ' + e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load(selectedTournamentId) }, [selectedTournamentId])

  // Open the form pre-filled when arriving from Live Courts
  useEffect(() => {
    if (!prefill || tournaments.length === 0) return
    const t = tournaments.find((x) => x.id === prefill.tournamentId)
    setSelectedTournamentId(prefill.tournamentId || (tournaments[0] && tournaments[0].id) || '')
    setDayNumber(prefill.dayNumber || 1)
    openNew(t, prefill)
    // clear the navigation state so a refresh doesn't reopen it
    navigate(location.pathname, { replace: true, state: null })
  }, [tournaments]) // eslint-disable-line

  function openNew(t = tournament, pre = null) {
    setEditingId(null)
    setForm({
      ...EMPTY,
      kind: pre?.kind || 'MTO',
      competition_name: (t || tournament)?.name || '',
      venue_date: [(t || tournament)?.location, formatDate((t || tournament)?.start_date)].filter(Boolean).join(' · '),
      form_date: todayDMY(),
      hour: nowHM(),
      match_number: pre?.matchNumber || '',
      court: pre?.court || '',
    })
    setShowForm(true)
  }

  function openEdit(rec) {
    setEditingId(rec.id)
    setForm({ ...EMPTY, ...rec })
    setShowForm(true)
  }

  function set(k, val) { setForm((f) => ({ ...f, [k]: val })) }

  async function save() {
    if (!selectedTournamentId) { toast.error('Select a tournament first'); return }
    if (!form.athlete_name.trim()) { toast.error('Athlete name is required'); return }
    setSaving(true)
    const payload = {
      tournament_id: selectedTournamentId,
      day_number: dayNumber,
      kind: form.kind,
      competition_name: form.competition_name,
      venue_date: form.venue_date,
      athlete_name: form.athlete_name,
      form_date: form.form_date,
      match_number: form.match_number,
      hour: form.hour,
      reason: form.reason,
      athlete_signature: form.athlete_signature,
      medical_evaluation: form.medical_evaluation,
      able_to_continue: form.able_to_continue,
      remarks: form.remarks,
      ack_event_doctor: form.ack_event_doctor,
      ack_medical_delegate: form.ack_medical_delegate,
      ack_supervisor: form.ack_supervisor,
      cert_doctor_name: form.cert_doctor_name,
      court: form.court,
    }
    try {
      if (editingId) await mtoService.update(editingId, payload)
      else await mtoService.create(payload)
      toast.success(editingId ? 'BV-15 updated' : 'BV-15 saved')
      setShowForm(false)
      setEditingId(null)
      await load(selectedTournamentId)
    } catch (e) {
      toast.error('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(rec) {
    if (!window.confirm(`Delete the BV-15 for ${rec.athlete_name}?`)) return
    try {
      await mtoService.delete(rec.id)
      await load(selectedTournamentId)
      toast.success('Deleted')
    } catch (e) { toast.error('Delete failed: ' + e.message) }
  }

  async function downloadPdf(rec) {
    setBusyPdf(rec.id)
    try {
      const blob = await generateBV15PDF(rec)
      const safe = (rec.athlete_name || 'athlete').replace(/\s+/g, '_')
      downloadPDF(blob, `BV-15_${safe}.pdf`)
    } catch (e) { toast.error('PDF failed: ' + e.message) } finally { setBusyPdf(null) }
  }

  const selectCls =
    'w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm ' +
    'focus:outline-none focus:border-[#E85D26]/60 focus:ring-1 focus:ring-[#E85D26]/30 transition-colors'
  const inputCls =
    'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm ' +
    'focus:outline-none focus:border-[#E85D26]/60 focus:ring-1 focus:ring-[#E85D26]/30 transition-colors'

  return (
    <div className="min-h-full bg-gray-50">
      <Header title="MTO · BV-15" subtitle="Medical Injury Time-Out / Forfeit" />

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Tournament + day */}
        <div className="flex gap-2">
          <select value={selectedTournamentId} onChange={(e) => setSelectedTournamentId(e.target.value)} className={selectCls}>
            <option value="">Select tournament…</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {formatDate(t.start_date)}</option>
            ))}
          </select>
          <select value={dayNumber} onChange={(e) => setDayNumber(parseInt(e.target.value, 10))} className={cn(selectCls, 'w-28')}>
            {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>Day {d}</option>)}
          </select>
        </div>

        {!showForm && (
          <Button variant="primary" onClick={() => openNew()} disabled={!selectedTournamentId} className="w-full">
            <Plus size={16} /> New BV-15 (MTO / Forfeit)
          </Button>
        )}

        {/* ── Form ── */}
        {showForm && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Stethoscope size={15} /> {editingId ? 'Edit BV-15' : 'New BV-15'}
              </CardTitle>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Kind */}
              <div className="grid grid-cols-2 gap-2">
                {[['MTO', 'Medical Time-Out'], ['FORFEIT', 'Injury Forfeit']].map(([k, lbl]) => (
                  <button key={k} type="button" onClick={() => set('kind', k)}
                    className={cn('py-2 rounded-lg text-sm font-bold border transition-all',
                      form.kind === k ? 'bg-[#2D3270] text-white border-[#2D3270]' : 'bg-gray-50 text-gray-600 border-gray-200')}>
                    {lbl}
                  </button>
                ))}
              </div>

              <Field label="Name of the Competition">
                <input className={inputCls} value={form.competition_name} onChange={(e) => set('competition_name', e.target.value)} />
              </Field>
              <Field label="Venue and date">
                <input className={inputCls} value={form.venue_date} onChange={(e) => set('venue_date', e.target.value)} />
              </Field>

              <SectionTitle>To be filled in by the athlete</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Athlete Name"><input className={inputCls} value={form.athlete_name} onChange={(e) => set('athlete_name', e.target.value)} /></Field>
                <Field label="Date (d/m/y)"><input className={inputCls} value={form.form_date} onChange={(e) => set('form_date', e.target.value)} /></Field>
                <Field label="Match #"><input className={inputCls} value={form.match_number} onChange={(e) => set('match_number', e.target.value)} /></Field>
                <Field label="Hour (h/m)"><input className={inputCls} value={form.hour} onChange={(e) => set('hour', e.target.value)} /></Field>
              </div>
              <Field label="Reason for Medical Time Out / Forfeit Injury">
                <textarea rows={2} className={inputCls} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
              </Field>
              <Field label="Athlete Signature (name)">
                <input className={inputCls} value={form.athlete_signature} onChange={(e) => set('athlete_signature', e.target.value)} />
              </Field>

              <SectionTitle>To be filled in by the official Event’s Doctor</SectionTitle>
              <Field label="Medical Evaluation">
                <textarea rows={2} className={inputCls} value={form.medical_evaluation} onChange={(e) => set('medical_evaluation', e.target.value)} />
              </Field>
              <Field label="Able to continue without putting own health at risk?">
                <div className="flex gap-2">
                  {[['YES', true], ['NO', false], ['—', null]].map(([lbl, val]) => (
                    <button key={lbl} type="button" onClick={() => set('able_to_continue', val)}
                      className={cn('flex-1 py-2 rounded-lg text-sm font-bold border transition-all',
                        form.able_to_continue === val ? 'bg-[#E85D26] text-white border-[#E85D26]' : 'bg-gray-50 text-gray-600 border-gray-200')}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Remarks">
                <input className={inputCls} value={form.remarks} onChange={(e) => set('remarks', e.target.value)} />
              </Field>

              <SectionTitle>Acknowledgement by</SectionTitle>
              <div className="grid grid-cols-1 gap-2">
                <Field label="Event’s Doctor"><input className={inputCls} value={form.ack_event_doctor} onChange={(e) => set('ack_event_doctor', e.target.value)} /></Field>
                <Field label="CEV Medical Delegate (if any)"><input className={inputCls} value={form.ack_medical_delegate} onChange={(e) => set('ack_medical_delegate', e.target.value)} /></Field>
                <Field label="CEV Supervisor"><input className={inputCls} value={form.ack_supervisor} onChange={(e) => set('ack_supervisor', e.target.value)} /></Field>
              </div>

              <SectionTitle>Team medical personnel</SectionTitle>
              <Field label="Name of the Medical Doctor (printed)">
                <input className={inputCls} value={form.cert_doctor_name} onChange={(e) => set('cert_doctor_name', e.target.value)} />
              </Field>

              <div className="flex gap-2 pt-1">
                <Button variant="primary" onClick={save} loading={saving} className="flex-1">
                  {editingId ? 'Update' : 'Save'} BV-15
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* ── Records list ── */}
        <Card>
          <CardHeader><CardTitle>Recorded BV-15 · {tournament?.name || '—'}</CardTitle></CardHeader>
          <CardBody className="space-y-2">
            {loading ? (
              <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
            ) : records.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No BV-15 recorded yet for this tournament.</p>
            ) : records.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {rec.athlete_name || '—'}
                    <span className={cn('ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded',
                      rec.kind === 'FORFEIT' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                      {rec.kind === 'FORFEIT' ? 'FORFEIT' : 'MTO'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {[rec.match_number && `Match ${rec.match_number}`, rec.court && `Court ${rec.court}`, rec.form_date]
                      .filter(Boolean).join(' · ')}
                    {rec.able_to_continue != null && (
                      <> · <span className={rec.able_to_continue ? 'text-emerald-600' : 'text-red-600'}>
                        {rec.able_to_continue ? 'can continue' : 'cannot continue'}
                      </span></>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="xs" onClick={() => downloadPdf(rec)} disabled={busyPdf === rec.id}>
                    <FileText size={12} /> {busyPdf === rec.id ? '…' : 'PDF'}
                  </Button>
                  <Button variant="outline" size="xs" onClick={() => openEdit(rec)}><Pencil size={12} /></Button>
                  <Button variant="outline" size="xs" onClick={() => remove(rec)}><Trash2 size={12} /></Button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}
function SectionTitle({ children }) {
  return <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[#2D3270] pt-1">{children}</h3>
}
