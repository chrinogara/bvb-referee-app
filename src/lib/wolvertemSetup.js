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
