-- BVB Referee Coach App — Seed Data
-- Belgian Beach Tour 2026 Season

-- ─── REFEREES ────────────────────────────────────────────────────────────────
INSERT INTO referees (last_name, first_name, gender, ranking_level) VALUES
  ('Derycke',           'Esther',   'F', 'A'),
  ('Van Schuerbeeck',   'Jarne',    'M', 'A'),
  ('Hoernaert',         'Matthias', 'M', 'A'),
  ('Vandooren',         'Pascal',   'M', 'B'),
  ('Humblet',           'Matthis',  'M', 'A'),
  ('Lievens',           'Steven',   'M', 'B'),
  ('Weenen',            'Bert',     'M', 'A'),
  ('Poriau',            'Etienne',  'M', 'A'),
  ('Kesteloot',         'Pieter',   'M', 'B'),
  ('Willems',           'Florian',  'M', 'A'),
  ('Hermans',           'Joran',    'M', 'A'),
  ('Coens',             'Peter',    'M', 'A'),
  ('Devlieger',         'Marc',     'M', 'B'),
  ('Gatez',             'Gregoire', 'M', 'A'),
  ('Dagnelies',         'Pauline',  'F', 'B'),
  ('Lengliz',           'Achref',   'M', 'C'),
  ('Francescangeli',    'Samuel',   'M', 'B'),
  ('Noble',             'Bert',     'M', 'B')
ON CONFLICT DO NOTHING;

-- ─── TOURNAMENTS ─────────────────────────────────────────────────────────────
INSERT INTO tournaments (name, location, start_date, end_date, star_rating, is_finals) VALUES
  ('Hemiksem',           'Hemiksem',   '2026-06-20', '2026-06-21', 1, FALSE),
  ('Wolvertem',          'Wolvertem',  '2026-07-04', '2026-07-05', 1, FALSE),
  ('Future Leuven',      'Leuven',     '2026-08-08', '2026-08-12', 2, FALSE),
  ('Nieuwpoort Finals',  'Nieuwpoort', '2026-08-14', '2026-08-16', 3, TRUE)
ON CONFLICT DO NOTHING;
