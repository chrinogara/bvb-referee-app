import { useState, useMemo } from 'react'
import { CalendarRange, CheckCircle, AlertTriangle, Save } from 'lucide-react'

import { Header } from '../components/layout/Header'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Select, Textarea } from '../components/ui/Input'
import { toast } from '../components/ui/Toast'
import { cn } from '../lib/utils'
import { useTournaments } from '../hooks/useTournaments'
import { useReferees } from '../hooks/useReferees'
import { supabase, matchService, designationService, refereeService } from '../lib/supabase'
import {
  parseSchedule, findReferee, applyLineJudge, isLineJudgeNotes,
  OFFICIAL_ROLES, LINE_JUDGE_ROLES,
} from '../lib/scheduleImport'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const ROLE_LABEL = { R1: 'R1', R2: 'R2', LJ1: 'LJ1', LJ2: 'LJ2' }

export default function ImportSchedule() {
  const { tournaments } = useTournaments()
  const { referees, refetch } = useReferees()

  const [tournamentId, setTournamentId] = useState('')
  const [court, setCourt] = useState('')
  const [dateISO, setDateISO] = useState(todayISO())
  const [dayNumber, setDayNumber] = useState(1)
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const parsed = useMemo(
    () => parseSchedule(text, { court: court.trim(), dateISO, dayNumber: Number(dayNumber) || 1 }),
    [text, court, dateISO, dayNumber]
  )

  // Resolve officials to referees for the live preview.
  const preview = useMemo(() => {
    const unmatched = new Set()
    const rows = parsed.rows.map((r) => {
      const officials = OFFICIAL_ROLES.map((role) => {
        const name = (r.officials[role] || '').trim()
        if (!name) return null
        const ref = findReferee(referees, name)
        if (!ref) unmatched.add(name)
        return { role, name, matched: !!ref }
      }).filter(Boolean)
      return { ...r, officials }
    })
    return { rows, unmatched: [...unmatched] }
  }, [parsed, referees])

  const canImport = !!tournamentId && !!court.trim() && parsed.rows.length > 0 && !importing

  async function runImport() {
    if (!canImport) return
    setImporting(true)
    setResult(null)
    try {
      const { data: existing } = await matchService.getByTournament(tournamentId)
      const ex = existing || []
      let nextNum = ex.reduce((mx, m) => Math.max(mx, m.match_number || 0), 0) + 1

      const unmatched = new Set()
      let created = 0, updated = 0, desigOk = 0, ljTagged = 0
      let ljRoleError = null
      const refs = referees.slice() // local copy so LJ-tagging dedupes within the run

      for (const row of parsed.rows) {
        // Find an existing match for this court + time + gender + day (so re-import updates).
        let m = ex.find(
          (x) =>
            x.court === row.court &&
            x.scheduled_time === row.scheduled_time &&
            (x.gender || '') === (row.gender || '') &&
            Number(x.day_number || 1) === Number(row.day_number)
        )
        let matchId
        if (m) {
          matchId = m.id
          await matchService.update(m.id, { team1: row.team1, team2: row.team2, round: row.phase || m.round || null })
          updated++
        } else {
          const rec = {
            tournament_id: tournamentId,
            match_number: nextNum++,
            court: row.court,
            scheduled_time: row.scheduled_time,
            day_number: row.day_number,
            gender: row.gender || null,
            team1: row.team1,
            team2: row.team2,
            is_final: false,
            round: row.phase || null,
          }
          const { data: ins, error } = await matchService.create(rec)
          if (error || !ins) { console.error('match create failed', error); continue }
          matchId = ins.id
          ex.push(ins)
          created++
        }

        for (const role of OFFICIAL_ROLES) {
          const name = (row.officials[role] || '').trim()
          if (!name) continue
          const ref = findReferee(refs, name)
          if (!ref) { unmatched.add(name); continue }

          // Ensure the official is on the tournament roster.
          try {
            await supabase
              .from('tournament_referees')
              .upsert({ tournament_id: tournamentId, referee_id: ref.id, attendance: {} }, { onConflict: 'tournament_id,referee_id' })
          } catch { /* ignore roster link errors */ }

          // Tag line judges automatically so they group correctly and get written-only eval.
          if (LINE_JUDGE_ROLES.includes(role) && !isLineJudgeNotes(ref.notes)) {
            try {
              const newNotes = applyLineJudge(ref.notes, true)
              await refereeService.update(ref.id, { notes: newNotes })
              ref.notes = newNotes
              ljTagged++
            } catch (e) { console.error('LJ tag failed', e) }
          }

          const { error: dErr } = await designationService.upsert({ match_id: matchId, referee_id: ref.id, role })
          if (dErr) {
            console.error('designation upsert failed', role, dErr)
            if (LINE_JUDGE_ROLES.includes(role)) ljRoleError = dErr.message || String(dErr)
          } else desigOk++
        }
      }

      setResult({ created, updated, desigOk, ljTagged, unmatched: [...unmatched], ljRoleError })
      if (ljTagged) refetch()
      toast.success(`Imported: ${created} new · ${updated} updated`)
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Import schedule" subtitle="Paste a court's table — matches & officials" />

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Settings */}
        <Card>
          <CardBody className="space-y-3">
            <Select label="Tournament" value={tournamentId} onChange={(e) => setTournamentId(e.target.value)}>
              <option value="">Select tournament…</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Court" value={court} onChange={(e) => setCourt(e.target.value)} placeholder="C2" />
              <Input label="Date" type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />
              <Input label="Day" type="number" min="1" value={dayNumber} onChange={(e) => setDayNumber(e.target.value)} />
            </div>
          </CardBody>
        </Card>

        {/* Paste */}
        <Card>
          <CardHeader className="py-3">
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-[#2D3270]">Paste the table</h2>
          </CardHeader>
          <CardBody className="space-y-2">
            <p className="text-[11px] text-gray-500 leading-snug">
              Copy one court's rows from your sheet and paste here. Columns: <b>time · M/W · phase · team1 · team2 · R1 · R2 · LJ1 · LJ2</b>. Empty rows and a header row are ignored.
            </p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={'9:00\tW\tQ\tGER\tAUT\tHoernaert\tFrancescangeli\tPoriau\tCleuren'}
            />
            <p className="text-xs text-gray-500">
              {parsed.rows.length} match{parsed.rows.length !== 1 ? 'es' : ''} detected
              {parsed.skipped ? ` · ${parsed.skipped} row${parsed.skipped !== 1 ? 's' : ''} skipped` : ''}
            </p>
          </CardBody>
        </Card>

        {/* Preview */}
        {preview.rows.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-[#2D3270]">Preview</h2>
            </CardHeader>
            <CardBody className="space-y-2">
              {preview.unmatched.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Not found in your referees: <b>{preview.unmatched.join(', ')}</b>. Add them (or fix the spelling) — their games won't be linked until they exist.
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                {preview.rows.map((r, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-gray-900">
                        {r.time} · {r.gender === 'F' ? 'W' : r.gender} · C{r.court}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{r.team1} / {r.team2}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {r.officials.map((o) => (
                        <span
                          key={o.role}
                          className={cn(
                            'inline-flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5',
                            o.matched ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          )}
                        >
                          {o.matched ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
                          <b>{ROLE_LABEL[o.role]}</b> {o.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {/* Import */}
        <Button onClick={runImport} loading={importing} disabled={!canImport} variant="primary" size="lg" className="w-full py-4 text-base font-bold rounded-xl">
          <Save size={18} /> Import {parsed.rows.length > 0 ? `${parsed.rows.length} match${parsed.rows.length !== 1 ? 'es' : ''}` : 'schedule'}
        </Button>
        <p className="text-[11px] text-gray-500 text-center">
          Re-paste an updated table and import again — existing matches (same court + time) are updated, not duplicated.
        </p>

        {/* Result */}
        {result && (
          <Card>
            <CardBody className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-emerald-500" />
                <p className="text-sm font-semibold text-gray-900">
                  {result.created} created · {result.updated} updated · {result.desigOk} designations
                  {result.ljTagged ? ` · ${result.ljTagged} tagged as line judge` : ''}
                </p>
              </div>
              {result.unmatched.length > 0 && (
                <p className="text-xs text-amber-700">
                  Unmatched (not linked): <b>{result.unmatched.join(', ')}</b>
                </p>
              )}
              {result.ljRoleError && (
                <p className="text-xs text-red-600">
                  Line-judge designations were rejected by the database. Ask to enable LJ roles — everything else imported fine.
                </p>
              )}
              <p className="text-[11px] text-gray-500">
                Officials now appear in Evaluate under their designated games (referees and line judges).
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
