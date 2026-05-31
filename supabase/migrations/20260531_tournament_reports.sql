-- ════════════════════════════════════════════════════════════════════════════
-- TOURNAMENT REPORTS — permanent storage for uploaded report documents
-- and their AI-generated briefing suggestions.
--
-- Used by the "smart Briefing" feature: the user uploads previous tournament
-- reports (PDF/DOCX), the text is extracted client-side, Claude analyses it and
-- produces professional English suggestions mapped to the 5 briefing sections.
-- These suggestions are stored here permanently and reused for future briefings.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tournament_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID REFERENCES tournaments(id) ON DELETE SET NULL, -- optional link
  file_name       TEXT NOT NULL,
  file_type       TEXT,                          -- 'pdf' | 'docx'
  storage_path    TEXT,                          -- optional: path if raw file is stored
  tournament_name TEXT,                          -- display label, e.g. "Gent 3star"
  report_date     DATE,                          -- date the report refers to
  content_text    TEXT,                          -- extracted raw text
  suggestions     JSONB DEFAULT '{}'::JSONB,     -- AI suggestions per briefing section
  status          TEXT DEFAULT 'pending',        -- pending | analyzing | analyzed | error
  error_message   TEXT,
  analyzed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_reports_tournament
  ON tournament_reports(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_reports_status
  ON tournament_reports(status);
CREATE INDEX IF NOT EXISTS idx_tournament_reports_created
  ON tournament_reports(created_at DESC);

-- Single-user app: RLS disabled to match the rest of the schema.
ALTER TABLE tournament_reports DISABLE ROW LEVEL SECURITY;
