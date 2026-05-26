import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'
import { formatDate, formatDateTime, refereeName } from './utils'
import { CRITERIA, getGrade } from './scoring'

const NAVY = '#2D3270'
const ORANGE = '#E85D26'
const LIGHT_GRAY = '#F8F9FA'
const DARK_GRAY = '#374151'
const MED_GRAY = '#6B7280'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK_GRAY,
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 35,
  },
  // Header
  header: {
    backgroundColor: NAVY,
    marginHorizontal: -35,
    marginTop: -30,
    paddingHorizontal: 35,
    paddingVertical: 18,
    marginBottom: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: '#CBD5E1',
    fontSize: 10,
    marginTop: 3,
  },
  headerAccent: {
    width: 40,
    height: 3,
    backgroundColor: ORANGE,
    marginTop: 10,
  },
  // Info grid
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    width: 120,
    color: MED_GRAY,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    flex: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  // Section header
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    paddingBottom: 4,
    marginTop: 16,
    marginBottom: 10,
  },
  // Criteria table
  criteriaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  criteriaRowAlt: {
    backgroundColor: LIGHT_GRAY,
  },
  criteriaNum: {
    width: 18,
    fontSize: 9,
    color: MED_GRAY,
  },
  criteriaLabel: {
    flex: 1,
    fontSize: 9,
  },
  criteriaWeight: {
    width: 35,
    fontSize: 9,
    color: MED_GRAY,
    textAlign: 'right',
  },
  criteriaScore: {
    width: 45,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  criteriaRepeat: {
    width: 70,
    textAlign: 'right',
    fontSize: 8,
    color: '#D97706',
  },
  // Score summary
  summaryBox: {
    backgroundColor: NAVY,
    borderRadius: 4,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  summaryScore: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    marginRight: 16,
  },
  summaryGrade: {
    color: ORANGE,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  summaryPenalty: {
    color: '#94A3B8',
    fontSize: 8,
    marginTop: 3,
  },
  // Notes
  noteBlock: {
    marginBottom: 8,
  },
  noteLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  noteText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: DARK_GRAY,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 35,
    right: 35,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: MED_GRAY,
  },
  footerBold: {
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
})

function EvaluationDocument({ evaluation, referee, match, tournament }) {
  const grade = getGrade(evaluation.overall_score)

  const scoreForKey = (key) => {
    const map = {
      positioning:  evaluation.score_positioning,
      signals:      evaluation.score_signals,
      attitude:     evaluation.score_attitude,
      captain_comm: evaluation.score_captain_comm,
      presentation: evaluation.score_presentation,
    }
    return map[key]
  }

  const repeatForKey = (key) => {
    const map = {
      positioning:  evaluation.repeat_positioning,
      signals:      evaluation.repeat_signals,
      attitude:     evaluation.repeat_attitude,
      captain_comm: evaluation.repeat_captain_comm,
      presentation: evaluation.repeat_presentation,
    }
    return map[key]
  }

  const noteForKey = (key) => {
    const map = {
      positioning:  evaluation.note_positioning,
      signals:      evaluation.note_signals,
      attitude:     evaluation.note_attitude,
      captain_comm: evaluation.note_captain_comm,
      presentation: evaluation.note_presentation,
    }
    return map[key]
  }

  const hasNotes = CRITERIA.some((c) => noteForKey(c.key))

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>BVB REFEREE EVALUATION REPORT</Text>
          <Text style={styles.headerSubtitle}>Belgian Beach Tour 2026</Text>
          <View style={styles.headerAccent} />
        </View>

        {/* Match Info */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Referee</Text>
          <Text style={styles.infoValue}>{refereeName(referee)}</Text>
          <Text style={styles.infoLabel}>Role</Text>
          <Text style={styles.infoValue}>{evaluation.role}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tournament</Text>
          <Text style={styles.infoValue}>{tournament?.name || '—'}</Text>
          <Text style={styles.infoLabel}>Date</Text>
          <Text style={styles.infoValue}>
            {formatDateTime(evaluation.evaluated_at)}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Court</Text>
          <Text style={styles.infoValue}>
            {match?.match_description || '—'}
          </Text>
          <Text style={styles.infoLabel}>Day</Text>
          <Text style={styles.infoValue}>
            {evaluation.day_number ? `Day ${evaluation.day_number}` : '—'}
          </Text>
        </View>

        {/* Criteria Scores */}
        <Text style={styles.sectionTitle}>Criteria Scores</Text>
        {CRITERIA.map((c, i) => (
          <View
            key={c.key}
            style={[styles.criteriaRow, i % 2 === 1 && styles.criteriaRowAlt]}
          >
            <Text style={styles.criteriaNum}>{i + 1}.</Text>
            <Text style={styles.criteriaLabel}>{c.label}</Text>
            <Text style={styles.criteriaWeight}>{c.weight}%</Text>
            <Text
              style={[
                styles.criteriaScore,
                {
                  color:
                    scoreForKey(c.key) >= 4
                      ? '#10B981'
                      : scoreForKey(c.key) >= 3
                      ? '#F59E0B'
                      : '#EF4444',
                },
              ]}
            >
              {scoreForKey(c.key) ?? '—'}/5
            </Text>
            {repeatForKey(c.key) && (
              <Text style={styles.criteriaRepeat}>⚠ Repeated Fault</Text>
            )}
          </View>
        ))}

        {/* Overall Score */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryScore}>
            {evaluation.overall_score?.toFixed(1)}/5.0
          </Text>
          <View>
            <Text style={styles.summaryGrade}>{grade.grade}</Text>
            {evaluation.repeat_penalty > 0 && (
              <Text style={styles.summaryPenalty}>
                Repeat fault penalty: -{evaluation.repeat_penalty?.toFixed(1)}
              </Text>
            )}
          </View>
        </View>

        {/* Observations */}
        {hasNotes && (
          <>
            <Text style={styles.sectionTitle}>Observations per Criterion</Text>
            {CRITERIA.map((c) => {
              const note = noteForKey(c.key)
              if (!note) return null
              return (
                <View key={c.key} style={styles.noteBlock}>
                  <Text style={styles.noteLabel}>{c.label}</Text>
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              )
            })}
          </>
        )}

        {/* General Feedback */}
        {evaluation.general_notes && (
          <>
            <Text style={styles.sectionTitle}>General Feedback</Text>
            <Text style={styles.noteText}>{evaluation.general_notes}</Text>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View>
            <Text style={[styles.footerText, styles.footerBold]}>
              RC Nogara Christian
            </Text>
            <Text style={styles.footerText}>
              CEV Referee Coach
            </Text>
          </View>
          <Text style={styles.footerText}>
            Generated {formatDate(new Date())}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

// ─── Designation Sheet PDF ────────────────────────────────────────────────────

const designationStyles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK_GRAY,
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 35,
  },
  header: {
    backgroundColor: NAVY,
    marginHorizontal: -35,
    marginTop: -30,
    paddingHorizontal: 35,
    paddingVertical: 18,
    marginBottom: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: '#CBD5E1',
    fontSize: 10,
    marginTop: 3,
  },
  headerAccent: {
    width: 40,
    height: 3,
    backgroundColor: ORANGE,
    marginTop: 10,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
    paddingHorizontal: 4,
  },
  metaItem: {
    width: '50%',
    flexDirection: 'row',
    marginBottom: 4,
  },
  metaLabel: {
    color: MED_GRAY,
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 80,
  },
  metaValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  courtBlock: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
  },
  courtHeader: {
    backgroundColor: NAVY,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courtTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  courtAccent: {
    color: ORANGE,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  sessionRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  sessionRowAlt: { backgroundColor: LIGHT_GRAY },
  sessionLabel: {
    width: 40,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  refName: { flex: 1, fontSize: 10 },
  refLevel: { width: 35, fontSize: 8, color: MED_GRAY, textAlign: 'right' },
  refRole: { width: 50, fontSize: 9, color: ORANGE, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  pauseText: { color: MED_GRAY, fontStyle: 'italic', flex: 1 },
})

function DesignationDocument({ tournament, dayNumber, assignmentsByCourt, rotationPattern }) {
  return (
    <Document>
      <Page size="A4" style={designationStyles.page}>
        <View style={designationStyles.header}>
          <Text style={designationStyles.headerTitle}>BVB REFEREE DESIGNATIONS</Text>
          <Text style={designationStyles.headerSubtitle}>
            {tournament?.name || 'Tournament'} — Day {dayNumber}
          </Text>
          <View style={designationStyles.headerAccent} />
        </View>

        <View style={designationStyles.meta}>
          <View style={designationStyles.metaItem}>
            <Text style={designationStyles.metaLabel}>Tournament</Text>
            <Text style={designationStyles.metaValue}>{tournament?.name || '—'}</Text>
          </View>
          <View style={designationStyles.metaItem}>
            <Text style={designationStyles.metaLabel}>Date</Text>
            <Text style={designationStyles.metaValue}>
              {tournament?.start_date ? formatDate(tournament.start_date) : '—'}
            </Text>
          </View>
          <View style={designationStyles.metaItem}>
            <Text style={designationStyles.metaLabel}>Day</Text>
            <Text style={designationStyles.metaValue}>Day {dayNumber}</Text>
          </View>
          <View style={designationStyles.metaItem}>
            <Text style={designationStyles.metaLabel}>Pattern</Text>
            <Text style={designationStyles.metaValue}>{rotationPattern || '—'}</Text>
          </View>
        </View>

        {Object.entries(assignmentsByCourt).map(([court, sessions]) => (
          <View key={court} style={designationStyles.courtBlock} wrap={false}>
            <View style={designationStyles.courtHeader}>
              <Text style={designationStyles.courtTitle}>{court}</Text>
              <Text style={designationStyles.courtAccent}>{sessions.length} sessions</Text>
            </View>
            {sessions
              .sort((a, b) => a.session_order - b.session_order)
              .map((s, i) => (
                <View
                  key={s.id || i}
                  style={[
                    designationStyles.sessionRow,
                    i % 2 === 1 && designationStyles.sessionRowAlt,
                  ]}
                >
                  <Text style={designationStyles.sessionLabel}>M{s.session_order}</Text>
                  {s.role === 'PAUSE' ? (
                    <Text style={designationStyles.pauseText}>⏸ Pause</Text>
                  ) : (
                    <>
                      <Text style={designationStyles.refName}>
                        {s.referees ? refereeName(s.referees) : '—'}
                      </Text>
                      <Text style={designationStyles.refRole}>{s.role}</Text>
                    </>
                  )}
                </View>
              ))}
          </View>
        ))}

        <View style={styles.footer}>
          <View>
            <Text style={[styles.footerText, styles.footerBold]}>
              RC Nogara Christian
            </Text>
            <Text style={styles.footerText}>
              CEV Referee Coach
            </Text>
          </View>
          <Text style={styles.footerText}>Generated {formatDate(new Date())}</Text>
        </View>
      </Page>
    </Document>
  )
}

// ─── RC Post-Tournament Report PDF ────────────────────────────────────────────

const rcStyles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: DARK_GRAY,
    paddingTop: 28,
    paddingBottom: 30,
    paddingHorizontal: 35,
  },
  header: {
    backgroundColor: NAVY,
    marginHorizontal: -35,
    marginTop: -28,
    paddingHorizontal: 35,
    paddingVertical: 16,
    marginBottom: 14,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
  },
  headerSubtitle: { color: '#CBD5E1', fontSize: 9, marginTop: 3 },
  headerAccent: { width: 40, height: 3, backgroundColor: ORANGE, marginTop: 8 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  metaItem: { width: '50%', flexDirection: 'row', marginBottom: 3 },
  metaLabel: { color: MED_GRAY, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.4, width: 90 },
  metaValue: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    paddingBottom: 3,
    marginTop: 12,
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: MED_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
    marginBottom: 2,
  },
  fieldText: { fontSize: 9, lineHeight: 1.45, color: DARK_GRAY },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6 },
  inlineCell: { width: '23%', marginBottom: 4 },
  inlineLabel: { fontSize: 7, color: MED_GRAY, textTransform: 'uppercase', letterSpacing: 0.4 },
  inlineValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 1 },
  gradeBox: {
    backgroundColor: NAVY,
    borderRadius: 4,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gradeLabel: { color: '#94A3B8', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 12 },
  gradeValue: { color: ORANGE, fontSize: 14, fontFamily: 'Helvetica-Bold' },
})

function RcReportDocument({ report, tournament }) {
  // Map enum → display label
  const RATING_LABEL = {
    VERY_GOOD: 'Very Good',
    GOOD: 'Good',
    BAD: 'Bad',
  }
  const RATING_COLOR = {
    VERY_GOOD: '#059669',
    GOOD: '#2563EB',
    BAD: '#DC2626',
  }
  const globalRating = RATING_LABEL[report.overall_performance] || '—'

  const Section = ({ title, children }) => (
    <View wrap={false}>
      <Text style={rcStyles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )

  const Field = ({ label, value }) => {
    if (!value || !String(value).trim()) return null
    return (
      <View>
        {label ? <Text style={rcStyles.fieldLabel}>{label}</Text> : null}
        <Text style={rcStyles.fieldText}>{value}</Text>
      </View>
    )
  }

  const OrgRating = ({ label, value, note }) => {
    if (!value) return null
    const color = RATING_COLOR[value] || MED_GRAY
    return (
      <View style={{ marginTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={rcStyles.fieldLabel}>{label}</Text>
          <View
            style={{
              backgroundColor: `${color}15`,
              borderColor: color,
              borderWidth: 0.8,
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 3,
              marginLeft: 4,
              marginTop: -3,
            }}
          >
            <Text style={{ color, fontSize: 8, fontFamily: 'Helvetica-Bold' }}>
              {RATING_LABEL[value]}
            </Text>
          </View>
        </View>
        {value === 'BAD' && note ? (
          <Text style={[rcStyles.fieldText, { fontStyle: 'italic', color: '#991B1B', marginTop: 2 }]}>
            Note: {note}
          </Text>
        ) : null}
      </View>
    )
  }

  const RefereeRow = ({ entry }) => {
    const r = entry.referee
    const s = entry.summary
    return (
      <View
        wrap={false}
        style={{
          flexDirection: 'row',
          paddingVertical: 5,
          paddingHorizontal: 8,
          borderBottomWidth: 0.5,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>
            {refereeName(r)}{' '}
            <Text style={{ fontSize: 8, color: MED_GRAY, fontFamily: 'Helvetica' }}>
              · Lv.{r.ranking_level}
            </Text>
          </Text>
          {s ? (
            <Text style={{ fontSize: 8.5, color: MED_GRAY, marginTop: 1 }}>
              {s.count} evals · avg {s.avg?.toFixed(2) ?? '—'} · best {s.best?.toFixed(1) ?? '—'} · {s.repeatCount} repeat fault{s.repeatCount !== 1 ? 's' : ''}
              {s.bestCriterion ? ` · ✓ ${s.bestCriterion.label}` : ''}
              {s.worstCriterion ? ` · ⚠ ${s.worstCriterion.label}` : ''}
            </Text>
          ) : (
            <Text style={{ fontSize: 8.5, fontStyle: 'italic', color: MED_GRAY, marginTop: 1 }}>
              No evaluations recorded yet.
            </Text>
          )}
        </View>
      </View>
    )
  }

  const topPerformers = report.top_performers_details || []
  const followups = report.followup_referees_details || []

  return (
    <Document>
      <Page size="A4" style={rcStyles.page}>
        <View style={rcStyles.header}>
          <Text style={rcStyles.headerTitle}>RC POST-TOURNAMENT REPORT</Text>
          <Text style={rcStyles.headerSubtitle}>
            {tournament?.name || 'Tournament'} ·{' '}
            {tournament?.start_date ? formatDate(tournament.start_date) : ''} →{' '}
            {tournament?.end_date ? formatDate(tournament.end_date) : ''}
          </Text>
          <View style={rcStyles.headerAccent} />
        </View>

        {/* 1. Tournament Context */}
        <Section title="Tournament Context">
          <View style={rcStyles.meta}>
            <View style={rcStyles.metaItem}>
              <Text style={rcStyles.metaLabel}>Tournament</Text>
              <Text style={rcStyles.metaValue}>{tournament?.name || '—'}</Text>
            </View>
            <View style={rcStyles.metaItem}>
              <Text style={rcStyles.metaLabel}>Location</Text>
              <Text style={rcStyles.metaValue}>{tournament?.location || '—'}</Text>
            </View>
            <View style={rcStyles.metaItem}>
              <Text style={rcStyles.metaLabel}>Dates</Text>
              <Text style={rcStyles.metaValue}>
                {tournament?.start_date ? formatDate(tournament.start_date) : '—'} →{' '}
                {tournament?.end_date ? formatDate(tournament.end_date) : '—'}
              </Text>
            </View>
            <View style={rcStyles.metaItem}>
              <Text style={rcStyles.metaLabel}>Level</Text>
              <Text style={rcStyles.metaValue}>{report.tournament_level || '—'}</Text>
            </View>
          </View>
          <Field label="Weather Conditions" value={report.weather_conditions} />
        </Section>

        {/* 2. Refereeing Team */}
        <Section title="Refereeing Team">
          <View style={rcStyles.inlineRow}>
            <View style={rcStyles.inlineCell}>
              <Text style={rcStyles.inlineLabel}>Total Refs</Text>
              <Text style={rcStyles.inlineValue}>{report.total_referees ?? '—'}</Text>
            </View>
            <View style={rcStyles.inlineCell}>
              <Text style={rcStyles.inlineLabel}>Level A</Text>
              <Text style={rcStyles.inlineValue}>{report.referees_a_level ?? '—'}</Text>
            </View>
            <View style={rcStyles.inlineCell}>
              <Text style={rcStyles.inlineLabel}>Level B</Text>
              <Text style={rcStyles.inlineValue}>{report.referees_b_level ?? '—'}</Text>
            </View>
            <View style={rcStyles.inlineCell}>
              <Text style={rcStyles.inlineLabel}>Level C</Text>
              <Text style={rcStyles.inlineValue}>{report.referees_c_level ?? '—'}</Text>
            </View>
            <View style={rcStyles.inlineCell}>
              <Text style={rcStyles.inlineLabel}>Personally Observed</Text>
              <Text style={rcStyles.inlineValue}>{report.observed_count ?? '—'}</Text>
            </View>
          </View>
        </Section>

        {/* 3. Overall Performance */}
        <Section title="Overall Performance">
          <View style={rcStyles.gradeBox}>
            <Text style={rcStyles.gradeLabel}>Global Rating</Text>
            <Text style={rcStyles.gradeValue}>{globalRating}</Text>
          </View>
          <Field label="Strengths Observed" value={report.strengths} />
          <Field label="Areas for Improvement" value={report.areas_for_improvement} />
        </Section>

        {/* 4. Individual Highlights */}
        <Section title="Individual Highlights">
          {topPerformers.length > 0 ? (
            <>
              <Text style={rcStyles.fieldLabel}>Top Performers</Text>
              <View style={{ borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 3, marginBottom: 6 }}>
                {topPerformers.map((entry, i) => (
                  <RefereeRow key={i} entry={entry} />
                ))}
              </View>
            </>
          ) : null}
          {followups.length > 0 ? (
            <>
              <Text style={rcStyles.fieldLabel}>Referees Needing Follow-up</Text>
              <View style={{ borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 3, marginBottom: 6 }}>
                {followups.map((entry, i) => (
                  <RefereeRow key={i} entry={entry} />
                ))}
              </View>
            </>
          ) : null}
          {topPerformers.length === 0 && followups.length === 0 && (
            <Text style={[rcStyles.fieldText, { fontStyle: 'italic', color: MED_GRAY }]}>
              No referees selected.
            </Text>
          )}
        </Section>

        {/* 5. Organizational Aspects (with mandatory note when BAD) */}
        <Section title="Organizational Aspects">
          <OrgRating label="Court Conditions"  value={report.court_conditions}  note={report.court_conditions_note} />
          <OrgRating label="Equipment Quality" value={report.equipment_quality} note={report.equipment_quality_note} />
          <OrgRating label="Scheduling"        value={report.scheduling}        note={report.scheduling_note} />
          <OrgRating label="Hospitality"       value={report.hospitality}       note={report.hospitality_note} />
        </Section>

        {/* 6. Incidents */}
        {(report.incidents || report.protests) && (
          <Section title="Incidents & Protests">
            <Field label="Notable Incidents" value={report.incidents} />
            <Field label="Protests Lodged" value={report.protests} />
          </Section>
        )}

        {/* 7. Recommendations */}
        <Section title="Recommendations">
          <Field label="For the Referees" value={report.recs_referees} />
          <Field label="For the Organizers" value={report.recs_organizers} />
          <Field label="For the RC Commission" value={report.recs_rc_commission} />
        </Section>

        {/* 8. Final Remarks */}
        {report.final_remarks?.trim() && (
          <Section title="Final Remarks">
            <Field label="" value={report.final_remarks} />
          </Section>
        )}

        <View style={styles.footer}>
          <View>
            <Text style={[styles.footerText, styles.footerBold]}>
              {report.rc_name || 'RC Nogara Christian'}
            </Text>
            <Text style={styles.footerText}>CEV Referee Coach</Text>
          </View>
          <Text style={styles.footerText}>
            Report date: {report.report_date ? formatDate(report.report_date) : formatDate(new Date())}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateRcReportPDF(report, tournament) {
  const blob = await pdf(<RcReportDocument report={report} tournament={tournament} />).toBlob()
  return blob
}

// ─── Tournament Evaluations Summary PDF ──────────────────────────────────────
function EvaluationsSummaryDocument({ tournament, evaluations, refereeStats }) {
  return (
    <Document>
      <Page size="A4" style={rcStyles.page}>
        <View style={rcStyles.header}>
          <Text style={rcStyles.headerTitle}>REFEREE EVALUATIONS SUMMARY</Text>
          <Text style={rcStyles.headerSubtitle}>
            {tournament?.name} · {tournament?.start_date && formatDate(tournament.start_date)}
          </Text>
          <View style={rcStyles.headerAccent} />
        </View>

        <Text style={rcStyles.sectionTitle}>Per-Referee Statistics</Text>
        {refereeStats.map((r) => (
          <View
            key={r.refereeId}
            style={{
              flexDirection: 'row',
              paddingVertical: 5,
              borderBottomWidth: 0.5,
              borderBottomColor: '#E5E7EB',
              alignItems: 'center',
            }}
          >
            <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold' }}>
              {r.name}
            </Text>
            <Text style={{ width: 50, fontSize: 9, color: MED_GRAY, textAlign: 'right' }}>
              Lv.{r.level}
            </Text>
            <Text style={{ width: 40, fontSize: 9, color: MED_GRAY, textAlign: 'right' }}>
              {r.count} eval{r.count !== 1 ? 's' : ''}
            </Text>
            <Text
              style={{
                width: 50,
                fontSize: 11,
                fontFamily: 'Helvetica-Bold',
                color:
                  r.avg >= 4 ? '#059669' : r.avg >= 3 ? '#CA8A04' : r.avg >= 2 ? '#EA580C' : '#DC2626',
                textAlign: 'right',
              }}
            >
              {r.avg?.toFixed(1)}/5
            </Text>
          </View>
        ))}

        <Text style={rcStyles.sectionTitle}>All Evaluations (chronological)</Text>
        {evaluations.map((ev) => (
          <View
            key={ev.id}
            style={{
              flexDirection: 'row',
              paddingVertical: 4,
              borderBottomWidth: 0.5,
              borderBottomColor: '#E5E7EB',
              alignItems: 'center',
            }}
          >
            <Text style={{ width: 60, fontSize: 8, color: MED_GRAY }}>
              {ev.evaluated_at ? formatDate(ev.evaluated_at) : '—'}
            </Text>
            <Text style={{ flex: 1, fontSize: 9 }}>
              {ev.referees ? refereeName(ev.referees) : '—'}
            </Text>
            <Text style={{ width: 30, fontSize: 8, color: MED_GRAY }}>{ev.role || ''}</Text>
            <Text
              style={{
                width: 55,
                fontSize: 9,
                fontFamily: 'Helvetica-Bold',
                textAlign: 'right',
                color: ev.overall_score >= 3.5 ? '#059669' : ev.overall_score >= 2.5 ? '#CA8A04' : '#DC2626',
              }}
            >
              {ev.overall_score?.toFixed(1)} {ev.grade}
            </Text>
          </View>
        ))}

        <View style={styles.footer}>
          <View>
            <Text style={[styles.footerText, styles.footerBold]}>RC Nogara Christian</Text>
            <Text style={styles.footerText}>CEV Referee Coach</Text>
          </View>
          <Text style={styles.footerText}>Generated {formatDate(new Date())}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateEvaluationsSummaryPDF({ tournament, evaluations }) {
  // Per-referee aggregation
  const statsMap = {}
  for (const ev of evaluations) {
    const r = ev.referees
    if (!r) continue
    if (!statsMap[r.id]) {
      statsMap[r.id] = {
        refereeId: r.id,
        name: refereeName(r),
        level: r.ranking_level,
        scores: [],
      }
    }
    if (ev.overall_score != null) statsMap[r.id].scores.push(ev.overall_score)
  }
  const refereeStats = Object.values(statsMap)
    .map((s) => ({
      ...s,
      count: s.scores.length,
      avg: s.scores.length > 0 ? s.scores.reduce((a, b) => a + b, 0) / s.scores.length : 0,
    }))
    .sort((a, b) => b.avg - a.avg)

  const blob = await pdf(
    <EvaluationsSummaryDocument
      tournament={tournament}
      evaluations={evaluations}
      refereeStats={refereeStats}
    />
  ).toBlob()
  return blob
}

export async function generateDesignationPDF({
  tournament,
  dayNumber,
  assignments,
  rotationPattern,
}) {
  // Group by court
  const byCourt = {}
  for (const a of assignments) {
    const c = a.court || 'Unassigned'
    if (!byCourt[c]) byCourt[c] = []
    byCourt[c].push(a)
  }

  // Sort courts naturally
  const sorted = Object.keys(byCourt)
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || '0', 10)
      const nb = parseInt(b.match(/\d+/)?.[0] || '0', 10)
      return na - nb
    })
    .reduce((acc, k) => {
      acc[k] = byCourt[k]
      return acc
    }, {})

  const blob = await pdf(
    <DesignationDocument
      tournament={tournament}
      dayNumber={dayNumber}
      assignmentsByCourt={sorted}
      rotationPattern={rotationPattern}
    />
  ).toBlob()
  return blob
}

// ─── Evaluation PDF (existing) ────────────────────────────────────────────────

export async function generateEvaluationPDF(evaluation, referee, match, tournament) {
  const blob = await pdf(
    <EvaluationDocument
      evaluation={evaluation}
      referee={referee}
      match={match}
      tournament={tournament}
    />
  ).toBlob()
  return blob
}

export function downloadPDF(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function sharePDFWhatsApp(blob, filename) {
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: 'application/pdf' })
    if (navigator.canShare({ files: [file] })) {
      return navigator.share({
        files: [file],
        title: 'BVB Referee Evaluation',
      })
    }
  }
  // Fallback to download
  downloadPDF(blob, filename)
}
