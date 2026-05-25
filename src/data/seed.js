// Run this once to seed the database: import and call seedDatabase()
import { supabase } from '../lib/supabase'

const REFEREES = [
  { last_name: 'Derycke',           first_name: 'Esther',   gender: 'F', ranking_level: 'A' },
  { last_name: 'Van Schuerbeeck',   first_name: 'Jarne',    gender: 'M', ranking_level: 'A' },
  { last_name: 'Hoernaert',         first_name: 'Matthias', gender: 'M', ranking_level: 'A' },
  { last_name: 'Vandooren',         first_name: 'Pascal',   gender: 'M', ranking_level: 'B' },
  { last_name: 'Humblet',           first_name: 'Matthis',  gender: 'M', ranking_level: 'A' },
  { last_name: 'Lievens',           first_name: 'Steven',   gender: 'M', ranking_level: 'B' },
  { last_name: 'Weenen',            first_name: 'Bert',     gender: 'M', ranking_level: 'A' },
  { last_name: 'Poriau',            first_name: 'Etienne',  gender: 'M', ranking_level: 'A' },
  { last_name: 'Kesteloot',         first_name: 'Pieter',   gender: 'M', ranking_level: 'B' },
  { last_name: 'Willems',           first_name: 'Florian',  gender: 'M', ranking_level: 'A' },
  { last_name: 'Hermans',           first_name: 'Joran',    gender: 'M', ranking_level: 'A' },
  { last_name: 'Coens',             first_name: 'Peter',    gender: 'M', ranking_level: 'A' },
  { last_name: 'Devlieger',         first_name: 'Marc',     gender: 'M', ranking_level: 'B' },
  { last_name: 'Gatez',             first_name: 'Gregoire', gender: 'M', ranking_level: 'A' },
  { last_name: 'Dagnelies',         first_name: 'Pauline',  gender: 'F', ranking_level: 'B' },
  { last_name: 'Lengliz',           first_name: 'Achref',   gender: 'M', ranking_level: 'C' },
  { last_name: 'Francescangeli',    first_name: 'Samuel',   gender: 'M', ranking_level: 'B' },
  { last_name: 'Noble',             first_name: 'Bert',     gender: 'M', ranking_level: 'B' },
]

const TOURNAMENTS = [
  {
    name: 'Hemiksem',
    location: 'Hemiksem',
    start_date: '2026-06-20',
    end_date: '2026-06-21',
    star_rating: 1,
    is_finals: false,
  },
  {
    name: 'Wolvertem',
    location: 'Wolvertem',
    start_date: '2026-07-04',
    end_date: '2026-07-05',
    star_rating: 1,
    is_finals: false,
  },
  {
    name: 'Future Leuven',
    location: 'Leuven',
    start_date: '2026-08-08',
    end_date: '2026-08-12',
    star_rating: 2,
    is_finals: false,
  },
  {
    name: 'Nieuwpoort Finals',
    location: 'Nieuwpoort',
    start_date: '2026-08-14',
    end_date: '2026-08-16',
    star_rating: 3,
    is_finals: true,
  },
]

export async function seedDatabase() {
  console.log('Seeding referees...')
  const { error: refErr } = await supabase
    .from('referees')
    .upsert(REFEREES, { onConflict: 'last_name,first_name', ignoreDuplicates: true })
  if (refErr) console.error('Referee seed error:', refErr)
  else console.log(`✓ ${REFEREES.length} referees seeded`)

  console.log('Seeding tournaments...')
  const { error: tourErr } = await supabase
    .from('tournaments')
    .upsert(TOURNAMENTS, { onConflict: 'name', ignoreDuplicates: true })
  if (tourErr) console.error('Tournament seed error:', tourErr)
  else console.log(`✓ ${TOURNAMENTS.length} tournaments seeded`)

  console.log('Seed complete.')
}
