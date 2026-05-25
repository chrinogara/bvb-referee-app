-- BVB Referee Coach App — Supabase Schema
-- Run this in the Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── REFEREES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('M', 'F')),
  ranking_level TEXT CHECK (ranking_level IN ('A', 'B', 'C')),
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TOURNAMENTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  star_rating INTEGER CHECK (star_rating IN (1, 2, 3)),
  is_finals BOOLEAN DEFAULT FALSE,
  format JSONB,
  regulations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TOURNAMENT_REFEREES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournament_referees (
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  referee_id UUID REFERENCES referees(id) ON DELETE CASCADE,
  PRIMARY KEY (tournament_id, referee_id)
);

-- ─── MATCHES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  match_number INTEGER,
  court TEXT,
  scheduled_time TIMESTAMPTZ,
  day_number INTEGER,
  round TEXT,
  series TEXT CHECK (series IN ('PRO', 'CHALLENGE')),
  gender TEXT CHECK (gender IN ('M', 'F')),
  is_final BOOLEAN DEFAULT FALSE,
  team1 TEXT,
  team2 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DESIGNATIONS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  referee_id UUID REFERENCES referees(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('R1', 'R2', 'LJ1', 'LJ2')),
  shift TEXT CHECK (shift IN ('match_1', 'match_2', 'break', 'match_3')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, role)
);

-- ─── EVALUATIONS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referee_id UUID REFERENCES referees(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id),
  tournament_id UUID REFERENCES tournaments(id),
  role TEXT CHECK (role IN ('R1', 'R2')),
  day_number INTEGER,
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 5 CRITERIA SCORES (1-5)
  score_positioning NUMERIC(3,1),
  score_signals NUMERIC(3,1),
  score_attitude NUMERIC(3,1),
  score_captain_comm NUMERIC(3,1),
  score_presentation NUMERIC(3,1),

  -- REPEATED FAULTS FLAGS
  repeat_positioning BOOLEAN DEFAULT FALSE,
  repeat_signals BOOLEAN DEFAULT FALSE,
  repeat_attitude BOOLEAN DEFAULT FALSE,
  repeat_captain_comm BOOLEAN DEFAULT FALSE,
  repeat_presentation BOOLEAN DEFAULT FALSE,

  -- NOTES PER CRITERION
  note_positioning TEXT,
  note_signals TEXT,
  note_attitude TEXT,
  note_captain_comm TEXT,
  note_presentation TEXT,

  -- OVERALL
  general_notes TEXT,
  overall_score NUMERIC(3,1),
  grade TEXT CHECK (grade IN ('EXCELLENT', 'GOOD', 'ADEQUATE', 'BELOW STANDARD', 'POOR')),
  repeat_penalty NUMERIC(3,1) DEFAULT 0,

  -- PDF
  pdf_sent BOOLEAN DEFAULT FALSE,
  pdf_sent_at TIMESTAMPTZ
);

-- ─── DOCUMENTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  doc_type TEXT CHECK (doc_type IN ('FIVB_RULES', 'CEV_REGULATIONS', 'BBT_REGULATIONS', 'RC_GUIDELINES')),
  storage_path TEXT,
  content_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REFEREE RANKING VIEW ─────────────────────────────────────────────────────
CREATE OR REPLACE VIEW referee_ranking AS
SELECT
  r.id,
  r.last_name,
  r.first_name,
  r.ranking_level,
  r.gender,
  COUNT(e.id) AS total_evaluations,
  ROUND(AVG(e.overall_score), 2) AS avg_score,
  SUM(CASE WHEN e.repeat_positioning THEN 1 ELSE 0 END +
      CASE WHEN e.repeat_signals THEN 1 ELSE 0 END +
      CASE WHEN e.repeat_attitude THEN 1 ELSE 0 END +
      CASE WHEN e.repeat_captain_comm THEN 1 ELSE 0 END +
      CASE WHEN e.repeat_presentation THEN 1 ELSE 0 END) AS total_repeat_faults,
  MAX(e.evaluated_at) AS last_evaluated
FROM referees r
LEFT JOIN evaluations e ON e.referee_id = r.id
GROUP BY r.id, r.last_name, r.first_name, r.ranking_level, r.gender
ORDER BY avg_score DESC NULLS LAST;

-- ─── ROW LEVEL SECURITY (disabled for single-user app) ────────────────────────
ALTER TABLE referees DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_referees DISABLE ROW LEVEL SECURITY;
ALTER TABLE matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE designations DISABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
