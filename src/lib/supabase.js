import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})

// ─── Referees ────────────────────────────────────────────────────────────────
export const refereeService = {
  getAll: () => supabase.from('referees').select('*').order('last_name'),

  getById: (id) => supabase.from('referees').select('*').eq('id', id).single(),

  create: (data) => supabase.from('referees').insert(data).select().single(),

  update: (id, data) =>
    supabase.from('referees').update(data).eq('id', id).select().single(),

  delete: (id) => supabase.from('referees').delete().eq('id', id),
}

// ─── Tournaments ─────────────────────────────────────────────────────────────
export const tournamentService = {
  getAll: () => supabase.from('tournaments').select('*').order('start_date'),

  getById: (id) =>
    supabase.from('tournaments').select('*').eq('id', id).single(),

  create: (data) => supabase.from('tournaments').insert(data).select().single(),

  update: (id, data) =>
    supabase.from('tournaments').update(data).eq('id', id).select().single(),

  getReferees: (tournamentId) =>
    supabase
      .from('tournament_referees')
      .select('referee_id, referees(*)')
      .eq('tournament_id', tournamentId),

  assignReferee: (tournamentId, refereeId) =>
    supabase
      .from('tournament_referees')
      .insert({ tournament_id: tournamentId, referee_id: refereeId }),

  removeReferee: (tournamentId, refereeId) =>
    supabase
      .from('tournament_referees')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('referee_id', refereeId),
}

// ─── Matches ─────────────────────────────────────────────────────────────────
export const matchService = {
  getByTournament: (tournamentId) =>
    supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('day_number')
      .order('scheduled_time'),

  create: (data) => supabase.from('matches').insert(data).select().single(),

  update: (id, data) =>
    supabase.from('matches').update(data).eq('id', id).select().single(),

  delete: (id) => supabase.from('matches').delete().eq('id', id),
}

// ─── Designations ────────────────────────────────────────────────────────────
export const designationService = {
  getByMatch: (matchId) =>
    supabase
      .from('designations')
      .select('*, referees(*)')
      .eq('match_id', matchId),

  getByTournament: (tournamentId) =>
    supabase
      .from('designations')
      .select('*, referees(*), matches(*)')
      .eq('matches.tournament_id', tournamentId),

  upsert: (data) =>
    supabase
      .from('designations')
      .upsert(data, { onConflict: 'match_id,role' })
      .select()
      .single(),

  delete: (id) => supabase.from('designations').delete().eq('id', id),
}

// ─── Evaluations ─────────────────────────────────────────────────────────────
export const evaluationService = {
  getAll: () =>
    supabase
      .from('evaluations')
      .select('*, referees(*), matches(*), tournaments(*)')
      .order('evaluated_at', { ascending: false }),

  getByReferee: (refereeId) =>
    supabase
      .from('evaluations')
      .select('*, matches(*), tournaments(*)')
      .eq('referee_id', refereeId)
      .order('evaluated_at', { ascending: false }),

  getByTournament: (tournamentId) =>
    supabase
      .from('evaluations')
      .select('*, referees(*), matches(*)')
      .eq('tournament_id', tournamentId)
      .order('evaluated_at', { ascending: false }),

  getById: (id) =>
    supabase
      .from('evaluations')
      .select('*, referees(*), matches(*), tournaments(*)')
      .eq('id', id)
      .single(),

  create: (data) => supabase.from('evaluations').insert(data).select().single(),

  update: (id, data) =>
    supabase.from('evaluations').update(data).eq('id', id).select().single(),

  delete: (id) => supabase.from('evaluations').delete().eq('id', id),

  deleteByReferee: (refereeId) =>
    supabase.from('evaluations').delete().eq('referee_id', refereeId),

  deleteAll: () =>
    supabase.from('evaluations').delete().neq('id', '00000000-0000-0000-0000-000000000000'),

  markPdfSent: (id) =>
    supabase
      .from('evaluations')
      .update({ pdf_sent: true, pdf_sent_at: new Date().toISOString() })
      .eq('id', id),
}

// ─── Ranking ─────────────────────────────────────────────────────────────────
export const rankingService = {
  getAll: () => supabase.from('referee_ranking').select('*'),

  getByTournament: (tournamentId) =>
    supabase
      .from('evaluations')
      .select('referee_id, referees(id, last_name, first_name, ranking_level, gender), overall_score, repeat_positioning, repeat_signals, repeat_attitude, repeat_captain_comm, repeat_presentation')
      .eq('tournament_id', tournamentId),
}

// ─── RC Post-Tournament Reports (1 per tournament) ──────────────────────────
export const rcReportService = {
  getByTournament: (tournamentId) =>
    supabase
      .from('rc_reports')
      .select('*')
      .eq('tournament_id', tournamentId)
      .maybeSingle(),

  upsert: (data) =>
    supabase
      .from('rc_reports')
      .upsert({ ...data, updated_at: new Date().toISOString() }, {
        onConflict: 'tournament_id',
      })
      .select()
      .single(),

  delete: (tournamentId) =>
    supabase.from('rc_reports').delete().eq('tournament_id', tournamentId),
}

// ─── Briefings (1 per tournament, structured sections) ──────────────────────
export const briefingService = {
  getByTournament: (tournamentId) =>
    supabase
      .from('briefings')
      .select('*')
      .eq('tournament_id', tournamentId)
      .maybeSingle(),

  upsert: (data) =>
    supabase
      .from('briefings')
      .upsert({ ...data, updated_at: new Date().toISOString() }, {
        onConflict: 'tournament_id',
      })
      .select()
      .single(),

  delete: (tournamentId) =>
    supabase.from('briefings').delete().eq('tournament_id', tournamentId),
}

// ─── Live Matches (real-time court state) ───────────────────────────────────
export const liveMatchService = {
  getActive: (tournamentId, dayNumber) =>
    supabase
      .from('live_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('day_number', dayNumber)
      .eq('is_active', true),

  getAllForDay: (tournamentId, dayNumber) =>
    supabase
      .from('live_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('day_number', dayNumber),

  startMatch: ({ tournamentId, dayNumber, court, sessionOrder, startTime, isTest }) =>
    supabase
      .from('live_matches')
      .upsert(
        {
          tournament_id: tournamentId,
          day_number: dayNumber,
          court,
          session_order: sessionOrder,
          start_time: startTime || new Date().toISOString(),
          is_active: true,
          is_test: !!isTest,
        },
        { onConflict: 'tournament_id,day_number,court,session_order' }
      )
      .select()
      .single(),

  stopMatch: (id) =>
    supabase.from('live_matches').update({ is_active: false }).eq('id', id),

  updateStartTime: (id, startTime) =>
    supabase.from('live_matches').update({ start_time: startTime }).eq('id', id),
}

// ─── Sandbox cleanup (purge all is_test rows) ────────────────────────────────
export const sandboxService = {
  purgeAll: async () => {
    const tables = ['court_assignments', 'evaluations', 'feedback_alerts', 'live_matches']
    const results = []
    for (const tbl of tables) {
      const { error, count } = await supabase
        .from(tbl)
        .delete({ count: 'exact' })
        .eq('is_test', true)
      results.push({ table: tbl, count: count ?? 0, error })
    }
    return results
  },
}

// ─── Documents (RAG) ─────────────────────────────────────────────────────────
export const documentService = {
  getAll: () => supabase.from('documents').select('*').order('created_at'),

  getGlobal: () =>
    supabase.from('documents').select('*').is('tournament_id', null).order('created_at'),

  getByTournament: (tournamentId) =>
    supabase
      .from('documents')
      .select('*')
      .or(`tournament_id.eq.${tournamentId},tournament_id.is.null`)
      .order('created_at'),

  create: (data) => supabase.from('documents').insert(data).select().single(),

  delete: (id) => supabase.from('documents').delete().eq('id', id),

  deleteByType: (docType) =>
    supabase.from('documents').delete().eq('doc_type', docType).is('tournament_id', null),

  search: (query) =>
    supabase
      .from('documents')
      .select('id, name, doc_type, content_text')
      .textSearch('content_text', query),
}

// ─── MTO / BV-15 records (Medical Injury Time-Out / Forfeit) ─────────────────
export const mtoService = {
  getByTournament: (tournamentId) =>
    supabase
      .from('mto_records')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false }),

  create: (data) => supabase.from('mto_records').insert(data).select().single(),

  update: (id, data) =>
    supabase.from('mto_records').update(data).eq('id', id).select().single(),

  delete: (id) => supabase.from('mto_records').delete().eq('id', id),
}

// ─── Court Assignments (session-based designations) ───────────────────────────
export const courtAssignmentService = {
  getByDay: (tournamentId, dayNumber) =>
    supabase
      .from('court_assignments')
      .select('*, referees(*)')
      .eq('tournament_id', tournamentId)
      .eq('day_number', dayNumber)
      .order('court')
      .order('session_order'),

  create: (data) =>
    supabase.from('court_assignments').insert(data).select().single(),

  bulkCreate: (rows) =>
    supabase.from('court_assignments').insert(rows).select(),

  update: (id, data) =>
    supabase.from('court_assignments').update(data).eq('id', id).select().single(),

  delete: (id) => supabase.from('court_assignments').delete().eq('id', id),

  clearDay: (tournamentId, dayNumber) =>
    supabase
      .from('court_assignments')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('day_number', dayNumber),
}

// ─── Attendance (check-in per day) ────────────────────────────────────────────
export const attendanceService = {
  getForTournament: (tournamentId) =>
    supabase
      .from('tournament_referees')
      .select('referee_id, attendance, referees(*)')
      .eq('tournament_id', tournamentId),

  setPresent: async (tournamentId, refereeId, dayNumber, sectionNumber, present) => {
    // Read current attendance
    const { data: row } = await supabase
      .from('tournament_referees')
      .select('attendance')
      .eq('tournament_id', tournamentId)
      .eq('referee_id', refereeId)
      .single()

    const att = { ...(row?.attendance || {}) }
    const key = `${dayNumber}_${sectionNumber}`
    if (present) att[key] = new Date().toISOString()
    else delete att[key]

    return supabase
      .from('tournament_referees')
      .update({ attendance: att })
      .eq('tournament_id', tournamentId)
      .eq('referee_id', refereeId)
  },
}

// ─── Feedback Alerts (low-performance warnings) ───────────────────────────────
export const alertService = {
  getActive: () =>
    supabase
      .from('feedback_alerts')
      .select('*, referees(*), tournaments(*)')
      .eq('acknowledged', false)
      .order('triggered_at', { ascending: false }),

  getAll: () =>
    supabase
      .from('feedback_alerts')
      .select('*, referees(*), tournaments(*)')
      .order('triggered_at', { ascending: false }),

  create: (data) =>
    supabase.from('feedback_alerts').insert(data).select().single(),

  acknowledge: (id) =>
    supabase
      .from('feedback_alerts')
      .update({ acknowledged: true })
      .eq('id', id),
}

// ─── Referee summary notes (coach's holistic day / final comment) ─────────────
// day_number = 0  -> end-of-tournament (final) comment
// day_number = 1,2,3… -> that day's comment
export const summaryNoteService = {
  getForTournament: (tournamentId) =>
    supabase.from('referee_summary_notes').select('*').eq('tournament_id', tournamentId),

  upsert: ({ referee_id, tournament_id, day_number, comment }) =>
    supabase
      .from('referee_summary_notes')
      .upsert(
        { referee_id, tournament_id, day_number, comment, updated_at: new Date().toISOString() },
        { onConflict: 'referee_id,tournament_id,day_number' }
      )
      .select()
      .single(),
}
