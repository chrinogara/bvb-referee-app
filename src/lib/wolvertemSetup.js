// One-tap fix: ensure the 6 Wolvertem referees exist, have phone numbers, are
// linked to the tournament, and that attendance is cleared (so the whole roster
// shows). Runs in the browser with the anon client (RLS is disabled).

import { supabase } from './supabase'

export const WOLVERTEM_REFS = [
  { last: 'Lengliz',   first: 'Achref',   phone: '+32474569088', gender: 'M' },
  { last: 'Derycke',   first: 'Esther',   phone: '+32498590137', gender: 'F' },
  { last: 'Masseaux',  first: 'Frederic', phone: '+32483021899', gender: 'M' },
  { last: 'Devlieger', first: 'Marc',     phone: '+32468024524', gender: 'M' },
  { last: 'Hoernaert', first: 'Matthias', phone: '+32471670854', gender: 'M' },
  { last: 'Dagnelies', first: 'Pauline',  phone: '+32491734495', gender: 'F' },
]

// Returns { linked, created } counts. Idempotent — safe to run multiple times.
export async function ensureWolvertemReferees(tournamentId) {
  const ids = []
  let created = 0
  for (const r of WOLVERTEM_REFS) {
    let id = null
    const { data: found } = await supabase
      .from('referees').select('id').ilike('last_name', r.last).limit(1)
    if (found && found.length) {
      id = found[0].id
      await supabase.from('referees').update({ phone: r.phone }).eq('id', id)
    } else {
      const { data: ins } = await supabase
        .from('referees')
        .insert({ last_name: r.last, first_name: r.first, gender: r.gender, ranking_level: 'B', phone: r.phone })
        .select('id').single()
      if (ins) { id = ins.id; created += 1 }
    }
    if (id) ids.push(id)
  }
  // Link all to the tournament and clear attendance so the whole roster shows.
  for (const id of ids) {
    await supabase.from('tournament_referees')
      .upsert({ tournament_id: tournamentId, referee_id: id, attendance: {} }, { onConflict: 'tournament_id,referee_id' })
  }
  return { linked: ids.length, created }
}

// ── Wolvertem schedule (84 matches): Day 1 Sat self-refereed, Day 2 Sun refereed ──
// referees_needed is computed in code (computeWolvertemRefCount) so no DB column is required.
export const WOLVERTEM_MATCHES = [
  {"match_number": 25, "court": "2", "scheduled_time": "2026-07-04T09:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "F", "is_final": false, "team1": "Seed 7", "team2": "Seed 12"},
  {"match_number": 26, "court": "1", "scheduled_time": "2026-07-04T09:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "M", "is_final": false, "team1": "Seed 7", "team2": "Seed 12"},
  {"match_number": 27, "court": "3", "scheduled_time": "2026-07-04T09:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "F", "is_final": false, "team1": "Seed 8", "team2": "Seed 10"},
  {"match_number": 28, "court": "4", "scheduled_time": "2026-07-04T09:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "M", "is_final": false, "team1": "Seed 8", "team2": "Seed 10"},
  {"match_number": 29, "court": "2", "scheduled_time": "2026-07-04T09:45:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "F", "is_final": false, "team1": "Seed 5", "team2": "Seed 11"},
  {"match_number": 30, "court": "1", "scheduled_time": "2026-07-04T09:45:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "M", "is_final": false, "team1": "Seed 5", "team2": "Seed 11"},
  {"match_number": 31, "court": "3", "scheduled_time": "2026-07-04T09:45:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "F", "is_final": false, "team1": "Seed 6", "team2": "Seed 9"},
  {"match_number": 32, "court": "4", "scheduled_time": "2026-07-04T09:45:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "M", "is_final": false, "team1": "Seed 6", "team2": "Seed 9"},
  {"match_number": 33, "court": "2", "scheduled_time": "2026-07-04T10:30:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "F", "is_final": false, "team1": "Perdente 25", "team2": "Seed 1"},
  {"match_number": 34, "court": "1", "scheduled_time": "2026-07-04T10:30:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "M", "is_final": false, "team1": "Perdente 26", "team2": "Seed 1"},
  {"match_number": 35, "court": "3", "scheduled_time": "2026-07-04T10:30:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "F", "is_final": false, "team1": "Perdente 27", "team2": "Seed 2"},
  {"match_number": 36, "court": "4", "scheduled_time": "2026-07-04T10:30:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "M", "is_final": false, "team1": "Perdente 28", "team2": "Seed 2"},
  {"match_number": 37, "court": "2", "scheduled_time": "2026-07-04T11:15:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "F", "is_final": false, "team1": "Perdente 29", "team2": "Seed 3"},
  {"match_number": 38, "court": "1", "scheduled_time": "2026-07-04T11:15:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "M", "is_final": false, "team1": "Perdente 30", "team2": "Seed 3"},
  {"match_number": 39, "court": "3", "scheduled_time": "2026-07-04T11:15:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "F", "is_final": false, "team1": "Perdente 31", "team2": "Seed 4"},
  {"match_number": 40, "court": "4", "scheduled_time": "2026-07-04T11:15:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "M", "is_final": false, "team1": "Perdente 32", "team2": "Seed 4"},
  {"match_number": 41, "court": "2", "scheduled_time": "2026-07-04T12:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "F", "is_final": false, "team1": "Vincente 25", "team2": "Seed 1"},
  {"match_number": 42, "court": "1", "scheduled_time": "2026-07-04T12:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "M", "is_final": false, "team1": "Vincente 26", "team2": "Seed 1"},
  {"match_number": 43, "court": "3", "scheduled_time": "2026-07-04T12:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "F", "is_final": false, "team1": "Vincente 27", "team2": "Seed 2"},
  {"match_number": 44, "court": "4", "scheduled_time": "2026-07-04T12:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "M", "is_final": false, "team1": "Vincente 28", "team2": "Seed 2"},
  {"match_number": 45, "court": "2", "scheduled_time": "2026-07-04T12:50:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "F", "is_final": false, "team1": "Vincente 29", "team2": "Seed 3"},
  {"match_number": 46, "court": "1", "scheduled_time": "2026-07-04T12:50:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "M", "is_final": false, "team1": "Vincente 30", "team2": "Seed 3"},
  {"match_number": 47, "court": "3", "scheduled_time": "2026-07-04T12:50:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "F", "is_final": false, "team1": "Vincente 31", "team2": "Seed 4"},
  {"match_number": 48, "court": "4", "scheduled_time": "2026-07-04T12:50:00+02:00", "day_number": 1, "round": "Pool play", "series": "PRO", "gender": "M", "is_final": false, "team1": "Vincente 32", "team2": "Seed 4"},
  {"match_number": 1, "court": "1", "scheduled_time": "2026-07-04T13:40:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Seed 19", "team2": "Seed 24"},
  {"match_number": 2, "court": "2", "scheduled_time": "2026-07-04T13:40:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Seed 19", "team2": "Seed 24"},
  {"match_number": 3, "court": "3", "scheduled_time": "2026-07-04T13:40:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Seed 20", "team2": "Seed 22"},
  {"match_number": 4, "court": "4", "scheduled_time": "2026-07-04T13:40:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Seed 20", "team2": "Seed 22"},
  {"match_number": 5, "court": "1", "scheduled_time": "2026-07-04T14:30:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Seed 17", "team2": "Seed 23"},
  {"match_number": 6, "court": "2", "scheduled_time": "2026-07-04T14:30:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Seed 17", "team2": "Seed 23"},
  {"match_number": 7, "court": "3", "scheduled_time": "2026-07-04T14:30:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Seed 18", "team2": "Seed 21"},
  {"match_number": 8, "court": "4", "scheduled_time": "2026-07-04T14:30:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Seed 18", "team2": "Seed 21"},
  {"match_number": 9, "court": "1", "scheduled_time": "2026-07-04T15:20:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Perdente 1", "team2": "Seed 13"},
  {"match_number": 10, "court": "2", "scheduled_time": "2026-07-04T15:20:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Perdente 2", "team2": "Seed 13"},
  {"match_number": 11, "court": "3", "scheduled_time": "2026-07-04T15:20:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Perdente 3", "team2": "Seed 14"},
  {"match_number": 12, "court": "4", "scheduled_time": "2026-07-04T15:20:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Perdente 4", "team2": "Seed 14"},
  {"match_number": 13, "court": "1", "scheduled_time": "2026-07-04T16:10:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Perdente 5", "team2": "Seed 15"},
  {"match_number": 14, "court": "2", "scheduled_time": "2026-07-04T16:10:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Perdente 6", "team2": "Seed 15"},
  {"match_number": 15, "court": "3", "scheduled_time": "2026-07-04T16:10:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Perdente 7", "team2": "Seed 16"},
  {"match_number": 16, "court": "4", "scheduled_time": "2026-07-04T16:10:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Perdente 8", "team2": "Seed 16"},
  {"match_number": 17, "court": "1", "scheduled_time": "2026-07-04T17:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Vincente 1", "team2": "Seed 13"},
  {"match_number": 18, "court": "2", "scheduled_time": "2026-07-04T17:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Vincente 2", "team2": "Seed 13"},
  {"match_number": 19, "court": "3", "scheduled_time": "2026-07-04T17:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Vincente 3", "team2": "Seed 14"},
  {"match_number": 20, "court": "4", "scheduled_time": "2026-07-04T17:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Vincente 4", "team2": "Seed 14"},
  {"match_number": 21, "court": "1", "scheduled_time": "2026-07-04T18:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Vincente 5", "team2": "Seed 15"},
  {"match_number": 22, "court": "2", "scheduled_time": "2026-07-04T18:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Vincente 6", "team2": "Seed 15"},
  {"match_number": 23, "court": "3", "scheduled_time": "2026-07-04T18:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Vincente 7", "team2": "Seed 16"},
  {"match_number": 24, "court": "4", "scheduled_time": "2026-07-04T18:00:00+02:00", "day_number": 1, "round": "Pool play", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Vincente 8", "team2": "Seed 16"},
  {"match_number": 57, "court": "2", "scheduled_time": "2026-07-04T19:00:00+02:00", "day_number": 1, "round": "Quarterfinals", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Girone I #1", "team2": "Girone J #2"},
  {"match_number": 58, "court": "4", "scheduled_time": "2026-07-04T19:00:00+02:00", "day_number": 1, "round": "Quarterfinals", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Girone J #1", "team2": "Girone I #2"},
  {"match_number": 61, "court": "1", "scheduled_time": "2026-07-04T19:00:00+02:00", "day_number": 1, "round": "Quarterfinals", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Girone N #1", "team2": "Girone O #2"},
  {"match_number": 62, "court": "3", "scheduled_time": "2026-07-04T19:00:00+02:00", "day_number": 1, "round": "Quarterfinals", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Girone O #1", "team2": "Girone N #2"},
  {"match_number": 59, "court": "2", "scheduled_time": "2026-07-04T20:00:00+02:00", "day_number": 1, "round": "Quarterfinals", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Girone K #1", "team2": "Girone M #2"},
  {"match_number": 60, "court": "4", "scheduled_time": "2026-07-04T20:00:00+02:00", "day_number": 1, "round": "Quarterfinals", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Girone M #1", "team2": "Girone K #2"},
  {"match_number": 63, "court": "1", "scheduled_time": "2026-07-04T20:00:00+02:00", "day_number": 1, "round": "Quarterfinals", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Girone P #1", "team2": "Girone Q #2"},
  {"match_number": 64, "court": "3", "scheduled_time": "2026-07-04T20:00:00+02:00", "day_number": 1, "round": "Quarterfinals", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Girone Q #1", "team2": "Girone P #2"},
  {"match_number": 49, "court": "1", "scheduled_time": "2026-07-05T09:00:00+02:00", "day_number": 2, "round": "Quarterfinals", "series": "PRO", "gender": "F", "is_final": false, "team1": "Maertens Louka - Van den Vonder Lisa", "team2": "Thant Lente - Bombeke Lola"},
  {"match_number": 51, "court": "2", "scheduled_time": "2026-07-05T09:00:00+02:00", "day_number": 2, "round": "Quarterfinals", "series": "PRO", "gender": "F", "is_final": false, "team1": "Piret Inès - Reul Océane", "team2": "Troshina Olga - Rousseaux Helene"},
  {"match_number": 53, "court": "3", "scheduled_time": "2026-07-05T09:00:00+02:00", "day_number": 2, "round": "Quarterfinals", "series": "PRO", "gender": "F", "is_final": false, "team1": "Vervloet Simone - Waegeneers Tes", "team2": "De Clercq Lotte - Bex Annelore"},
  {"match_number": 55, "court": "4", "scheduled_time": "2026-07-05T09:00:00+02:00", "day_number": 2, "round": "Quarterfinals", "series": "PRO", "gender": "F", "is_final": false, "team1": "Van Hout Joke - Pareyn Lotte", "team2": "van Doren Emma - van Doren Ilya"},
  {"match_number": 50, "court": "1", "scheduled_time": "2026-07-05T09:50:00+02:00", "day_number": 2, "round": "Quarterfinals", "series": "PRO", "gender": "M", "is_final": false, "team1": "Willems Casper - Darras Arne", "team2": "Witvrouwen Christophe - Hendrikx Daan"},
  {"match_number": 52, "court": "2", "scheduled_time": "2026-07-05T09:50:00+02:00", "day_number": 2, "round": "Quarterfinals", "series": "PRO", "gender": "M", "is_final": false, "team1": "Lemmens Tim - Ver Eecke Anshel", "team2": "Winters Pieter - De Gaspari Timo"},
  {"match_number": 54, "court": "3", "scheduled_time": "2026-07-05T09:50:00+02:00", "day_number": 2, "round": "Quarterfinals", "series": "PRO", "gender": "M", "is_final": false, "team1": "Pirick Jordan - Laenen Louis", "team2": "Van Leemputten Arnor - Christiaens Jens"},
  {"match_number": 56, "court": "4", "scheduled_time": "2026-07-05T09:50:00+02:00", "day_number": 2, "round": "Quarterfinals", "series": "PRO", "gender": "M", "is_final": false, "team1": "Van de Vijver Kasper - Lievens Daan", "team2": "Peters Berre - Nuyttens Wout"},
  {"match_number": 65, "court": "1", "scheduled_time": "2026-07-05T10:40:00+02:00", "day_number": 2, "round": "Semifinals", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Vincente 57", "team2": "Vincente 60"},
  {"match_number": 66, "court": "2", "scheduled_time": "2026-07-05T10:40:00+02:00", "day_number": 2, "round": "Semifinals", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Vincente 58", "team2": "Vincente 59"},
  {"match_number": 67, "court": "3", "scheduled_time": "2026-07-05T10:40:00+02:00", "day_number": 2, "round": "Place 5-7", "series": "PRO", "gender": "F", "is_final": false, "team1": "Perdente 49", "team2": "Perdente 55"},
  {"match_number": 68, "court": "4", "scheduled_time": "2026-07-05T10:40:00+02:00", "day_number": 2, "round": "Place 5-7", "series": "PRO", "gender": "F", "is_final": false, "team1": "Perdente 51", "team2": "Perdente 53"},
  {"match_number": 69, "court": "1", "scheduled_time": "2026-07-05T11:30:00+02:00", "day_number": 2, "round": "Semifinals", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Vincente 61", "team2": "Vincente 64"},
  {"match_number": 70, "court": "2", "scheduled_time": "2026-07-05T11:30:00+02:00", "day_number": 2, "round": "Semifinals", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Vincente 62", "team2": "Vincente 63"},
  {"match_number": 71, "court": "3", "scheduled_time": "2026-07-05T11:30:00+02:00", "day_number": 2, "round": "Place 5-7", "series": "PRO", "gender": "M", "is_final": false, "team1": "Perdente 50", "team2": "Perdente 56"},
  {"match_number": 72, "court": "4", "scheduled_time": "2026-07-05T11:30:00+02:00", "day_number": 2, "round": "Place 5-7", "series": "PRO", "gender": "M", "is_final": false, "team1": "Perdente 52", "team2": "Perdente 54"},
  {"match_number": 73, "court": "1", "scheduled_time": "2026-07-05T12:20:00+02:00", "day_number": 2, "round": "Semifinals", "series": "PRO", "gender": "F", "is_final": false, "team1": "Vincente 49", "team2": "Vincente 55"},
  {"match_number": 74, "court": "2", "scheduled_time": "2026-07-05T12:20:00+02:00", "day_number": 2, "round": "Semifinals", "series": "PRO", "gender": "F", "is_final": false, "team1": "Vincente 51", "team2": "Vincente 53"},
  {"match_number": 75, "court": "1", "scheduled_time": "2026-07-05T13:30:00+02:00", "day_number": 2, "round": "Semifinals", "series": "PRO", "gender": "M", "is_final": false, "team1": "Vincente 50", "team2": "Vincente 56"},
  {"match_number": 76, "court": "2", "scheduled_time": "2026-07-05T13:30:00+02:00", "day_number": 2, "round": "Semifinals", "series": "PRO", "gender": "M", "is_final": false, "team1": "Vincente 52", "team2": "Vincente 54"},
  {"match_number": 77, "court": "3", "scheduled_time": "2026-07-05T13:30:00+02:00", "day_number": 2, "round": "Bronze medal match", "series": "CHALLENGE", "gender": "M", "is_final": false, "team1": "Perdente 65", "team2": "Perdente 66"},
  {"match_number": 78, "court": "4", "scheduled_time": "2026-07-05T13:30:00+02:00", "day_number": 2, "round": "Bronze medal match", "series": "CHALLENGE", "gender": "F", "is_final": false, "team1": "Perdente 69", "team2": "Perdente 70"},
  {"match_number": 79, "court": "1", "scheduled_time": "2026-07-05T14:30:00+02:00", "day_number": 2, "round": "Final", "series": "CHALLENGE", "gender": "M", "is_final": true, "team1": "Vincente 65", "team2": "Vincente 66"},
  {"match_number": 80, "court": "2", "scheduled_time": "2026-07-05T14:30:00+02:00", "day_number": 2, "round": "Final", "series": "CHALLENGE", "gender": "F", "is_final": true, "team1": "Vincente 69", "team2": "Vincente 70"},
  {"match_number": 81, "court": "3", "scheduled_time": "2026-07-05T14:30:00+02:00", "day_number": 2, "round": "Bronze medal match", "series": "PRO", "gender": "F", "is_final": false, "team1": "Perdente 73", "team2": "Perdente 74"},
  {"match_number": 82, "court": "4", "scheduled_time": "2026-07-05T14:30:00+02:00", "day_number": 2, "round": "Bronze medal match", "series": "PRO", "gender": "M", "is_final": false, "team1": "Perdente 75", "team2": "Perdente 76"},
  {"match_number": 83, "court": "1", "scheduled_time": "2026-07-05T15:30:00+02:00", "day_number": 2, "round": "Final", "series": "PRO", "gender": "F", "is_final": true, "team1": "Vincente 73", "team2": "Vincente 74"},
  {"match_number": 84, "court": "1", "scheduled_time": "2026-07-05T16:30:00+02:00", "day_number": 2, "round": "Final", "series": "PRO", "gender": "M", "is_final": true, "team1": "Vincente 75", "team2": "Vincente 76"},
]

// Day 1 (Saturday) = self-refereed (0). Day 2: PRO finals = 2 referees, else 1.
export function computeWolvertemRefCount(m) {
  if ((m.day_number || 1) === 1) return 0
  return (m.is_final && m.series === 'PRO') ? 2 : 1
}

// Insert any missing Wolvertem matches (idempotent — skips match_numbers already present).
export async function loadWolvertemMatches(tournamentId) {
  const { data: existing } = await supabase.from('matches').select('match_number').eq('tournament_id', tournamentId)
  const have = new Set((existing || []).map((m) => m.match_number))
  const rows = WOLVERTEM_MATCHES.filter((m) => !have.has(m.match_number)).map((m) => ({ ...m, tournament_id: tournamentId }))
  if (rows.length) {
    const { error } = await supabase.from('matches').insert(rows)
    if (error) throw error
  }
  return rows.length
}
