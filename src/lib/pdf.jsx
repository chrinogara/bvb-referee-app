import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'
import { formatDate, formatDateTime, refereeName } from './utils'
import { CRITERIA, getGrade } from './scoring'
import { BBT_LOGO } from './logo'
import { readLegend, LEGEND_ORDER } from './criteriaLegend'
import { translateFieldsToEnglish, translateToEnglishSafe } from './anthropic'

const NAVY = '#2D3270'
const ORANGE = '#E85D26'
const LIGHT_GRAY = '#F8F9FA'
const DARK_GRAY = '#374151'
const LEADERSHIP_PDF_LABEL = { 0: 'Not evaluable', 1: 'Needs support', 2: 'Developing', 3: 'Solid', 4: 'Role model' }
const BENCH_PDF_LABEL = { 0: 'Not evaluable', 1: 'Needs work', 2: 'Developing', 3: 'Solid', 4: 'Excellent' }
const OFFCOURT_PDF = { attento: { label: 'Attentive', pts: '+0.2' }, superficiale: { label: 'Superficial', pts: '-0.1' }, non_attento: { label: 'Not attentive', pts: '-0.3' } }
const MED_GRAY = '#6B7280'

// Logo BBT bianco su trasparente: si fonde con la banda navy dell'header (nessun riquadro)
const LOGO_STYLE = { position: 'absolute', top: 2, right: 0, width: 104 }
function HeaderLogo() {
  return <Image src={BBT_LOGO} style={LOGO_STYLE} />
}

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

// ─── PDF i18n: etichette fisse EN/FR/NL ──────────────────────────────────────
// NB: i nomi dei 5 criteri (FIVB) e i grade (EXCELLENT…) restano in inglese:
// sono terminologia ufficiale che gli arbitri riconoscono.
const PDF_T = {
  en: {
    evalTitle: 'BVB REFEREE EVALUATION REPORT', referee: 'Referee', role: 'Role',
    tournament: 'Tournament', date: 'Date', court: 'Court', day: 'Day',
    criteriaScores: 'Criteria Scores', repeatedFault: '⚠ Repeated Fault',
    repeatPenalty: 'Repeat fault penalty', observations: 'Observations per Criterion',
    generalFeedback: 'General Feedback', generated: 'Generated',
    desigTitle: 'BVB REFEREE DESIGNATIONS', pattern: 'Pattern', sessions: 'sessions',
    pause: '⏸ Pause',
  },
  fr: {
    evalTitle: "RAPPORT D'ÉVALUATION ARBITRE BVB", referee: 'Arbitre', role: 'Rôle',
    tournament: 'Tournoi', date: 'Date', court: 'Terrain', day: 'Jour',
    criteriaScores: 'Scores par critère', repeatedFault: '⚠ Faute répétée',
    repeatPenalty: 'Pénalité faute répétée', observations: 'Observations par critère',
    generalFeedback: 'Commentaire général', generated: 'Généré le',
    desigTitle: 'DÉSIGNATIONS ARBITRES BVB', pattern: 'Rotation', sessions: 'sessions',
    pause: '⏸ Pause',
  },
  nl: {
    evalTitle: 'BVB SCHEIDSRECHTER EVALUATIERAPPORT', referee: 'Scheidsrechter', role: 'Rol',
    tournament: 'Toernooi', date: 'Datum', court: 'Veld', day: 'Dag',
    criteriaScores: 'Scores per criterium', repeatedFault: '⚠ Herhaalde fout',
    repeatPenalty: 'Strafpunt herhaalde fout', observations: 'Observaties per criterium',
    generalFeedback: 'Algemene feedback', generated: 'Gegenereerd',
    desigTitle: 'BVB SCHEIDSRECHTER AANSTELLINGEN', pattern: 'Rotatie', sessions: 'sessies',
    pause: '⏸ Pauze',
  },
}

function EvaluationDocument({ evaluation, referee, match, tournament, lang = 'en' }) {
  const t = PDF_T[lang] || PDF_T.en
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
          <Text style={styles.headerTitle}>{t.evalTitle}</Text>
          <Text style={styles.headerSubtitle}>Belgian Beach Tour 2026</Text>
          <View style={styles.headerAccent} />
          <HeaderLogo />
        </View>

        {/* Match Info */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t.referee}</Text>
          <Text style={styles.infoValue}>{refereeName(referee)}</Text>
          <Text style={styles.infoLabel}>{t.role}</Text>
          <Text style={styles.infoValue}>{evaluation.role}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t.tournament}</Text>
          <Text style={styles.infoValue}>{tournament?.name || '—'}</Text>
          <Text style={styles.infoLabel}>{t.date}</Text>
          <Text style={styles.infoValue}>
            {formatDateTime(evaluation.evaluated_at)}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t.court}</Text>
          <Text style={styles.infoValue}>
            {match?.match_description || '—'}
          </Text>
          <Text style={styles.infoLabel}>{t.day}</Text>
          <Text style={styles.infoValue}>
            {evaluation.day_number ? `${t.day} ${evaluation.day_number}` : '—'}
          </Text>
        </View>

        {/* Criteria Scores */}
        <Text style={styles.sectionTitle}>{t.criteriaScores}</Text>
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
              <Text style={styles.criteriaRepeat}>{t.repeatedFault}</Text>
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
                {t.repeatPenalty}: -{evaluation.repeat_penalty?.toFixed(1)}
              </Text>
            )}
          </View>
        </View>

        {/* Leadership & Example to colleagues */}
        {(evaluation.leadership_score != null || evaluation.leadership_note) && (
          <>
            <Text style={styles.sectionTitle}>Leadership & Example</Text>
            {evaluation.leadership_score != null && (
              <Text style={styles.noteText}>
                Rating: {LEADERSHIP_PDF_LABEL[evaluation.leadership_score] || evaluation.leadership_score}
              </Text>
            )}
            {evaluation.leadership_note && (
              <Text style={styles.noteText}>{evaluation.leadership_note}</Text>
            )}
          </>
        )}

        {/* R2 — Benches & off-court management */}
        {(evaluation.bench_score != null || evaluation.bench_note) && (
          <>
            <Text style={styles.sectionTitle}>Benches & Off-court (R2)</Text>
            {evaluation.bench_score != null && (
              <Text style={styles.noteText}>
                Rating: {BENCH_PDF_LABEL[evaluation.bench_score] || evaluation.bench_score}
              </Text>
            )}
            {evaluation.bench_note && (
              <Text style={styles.noteText}>{evaluation.bench_note}</Text>
            )}
          </>
        )}

        {/* R1 — Off-court control (counts toward the final score) */}
        {(evaluation.offcourt_control || evaluation.offcourt_note) && (
          <>
            <Text style={styles.sectionTitle}>Off-court Control (R1)</Text>
            {evaluation.offcourt_control && OFFCOURT_PDF[evaluation.offcourt_control] && (
              <Text style={styles.noteText}>
                {OFFCOURT_PDF[evaluation.offcourt_control].label} ({OFFCOURT_PDF[evaluation.offcourt_control].pts} to final score)
              </Text>
            )}
            {evaluation.offcourt_note && (
              <Text style={styles.noteText}>{evaluation.offcourt_note}</Text>
            )}
          </>
        )}

        {/* Observations */}
        {hasNotes && (
          <>
            <Text style={styles.sectionTitle}>{t.observations}</Text>
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
            <Text style={styles.sectionTitle}>{t.generalFeedback}</Text>
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
            {t.generated} {formatDate(new Date())}
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
  refRole: { width: 50, fontSize: 9, color: ORANGE, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  pauseText: { color: MED_GRAY, fontStyle: 'italic', flex: 1 },
})

function DesignationDocument({ tournament, dayNumber, assignmentsByCourt, rotationPattern, lang = 'en' }) {
  const t = PDF_T[lang] || PDF_T.en
  return (
    <Document>
      <Page size="A4" style={designationStyles.page}>
        <View style={designationStyles.header}>
          <Text style={designationStyles.headerTitle}>{t.desigTitle}</Text>
          <Text style={designationStyles.headerSubtitle}>
            {tournament?.name || 'Tournament'} — {t.day} {dayNumber}
          </Text>
          <View style={designationStyles.headerAccent} />
        </View>

        <View style={designationStyles.meta}>
          <View style={designationStyles.metaItem}>
            <Text style={designationStyles.metaLabel}>{t.tournament}</Text>
            <Text style={designationStyles.metaValue}>{tournament?.name || '—'}</Text>
          </View>
          <View style={designationStyles.metaItem}>
            <Text style={designationStyles.metaLabel}>{t.date}</Text>
            <Text style={designationStyles.metaValue}>
              {tournament?.start_date ? formatDate(tournament.start_date) : '—'}
            </Text>
          </View>
          <View style={designationStyles.metaItem}>
            <Text style={designationStyles.metaLabel}>{t.day}</Text>
            <Text style={designationStyles.metaValue}>{t.day} {dayNumber}</Text>
          </View>
          <View style={designationStyles.metaItem}>
            <Text style={designationStyles.metaLabel}>{t.pattern}</Text>
            <Text style={designationStyles.metaValue}>{rotationPattern || '—'}</Text>
          </View>
        </View>

        {Object.entries(assignmentsByCourt).map(([court, sessions]) => (
          <View key={court} style={designationStyles.courtBlock} wrap={false}>
            <View style={designationStyles.courtHeader}>
              <Text style={designationStyles.courtTitle}>{court}</Text>
              <Text style={designationStyles.courtAccent}>{sessions.length} {t.sessions}</Text>
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
                    <Text style={designationStyles.pauseText}>{t.pause}</Text>
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
          <Text style={styles.footerText}>{t.generated} {formatDate(new Date())}</Text>
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
    // Manual override wins over the auto-computed criterion label.
    const strongest = entry.strongest?.trim()
      ? entry.strongest.trim()
      : s?.bestCriterion?.label || null
    const weakest = entry.weakest?.trim()
      ? entry.weakest.trim()
      : s?.worstCriterion?.label || null
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
              {strongest ? ` · ✓ ${strongest}` : ''}
              {weakest ? ` · ⚠ ${weakest}` : ''}
            </Text>
          ) : strongest || weakest ? (
            <Text style={{ fontSize: 8.5, color: MED_GRAY, marginTop: 1 }}>
              {strongest ? `✓ ${strongest}` : ''}
              {strongest && weakest ? '   ' : ''}
              {weakest ? `⚠ ${weakest}` : ''}
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
          <HeaderLogo />
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
              <Text style={rcStyles.inlineLabel}>Evaluated</Text>
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
            Report date: {formatDate(new Date())}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

const RC_TEXT_FIELDS = [
  'weather_conditions', 'strengths', 'areas_for_improvement',
  'court_conditions_note', 'equipment_quality_note', 'scheduling_note', 'hospitality_note',
  'incidents', 'protests',
  'recs_referees', 'recs_organizers', 'recs_rc_commission', 'final_remarks',
]

export async function generateRcReportPDF(report, tournament) {
  // Safety net: translate any leftover non-English free text to English so the
  // final PDF is always in English, regardless of how it was entered/saved.
  let translated = await translateFieldsToEnglish(report, RC_TEXT_FIELDS)
  const translateDetails = async (arr) =>
    Promise.all((arr || []).map((e) => translateFieldsToEnglish(e, ['strongest', 'weakest'])))
  translated = {
    ...translated,
    top_performers_details: await translateDetails(report.top_performers_details),
    followup_referees_details: await translateDetails(report.followup_referees_details),
  }
  const blob = await pdf(<RcReportDocument report={translated} tournament={tournament} />).toBlob()
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
          <HeaderLogo />
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
  lang = 'en',
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
      lang={lang}
    />
  ).toBlob()
  return blob
}

// ─── Evaluation PDF (existing) ────────────────────────────────────────────────

export async function generateEvaluationPDF(evaluation, referee, match, tournament, lang = 'en') {
  // The notes are meant to be in English (the app translates them on input);
  // translate again here as a safety net so no Italian leaks into the PDF.
  const ev = await translateFieldsToEnglish(evaluation, [
    'note_positioning', 'note_signals', 'note_attitude',
    'note_captain_comm', 'note_presentation', 'general_notes', 'leadership_note', 'bench_note', 'offcourt_note',
  ])
  const blob = await pdf(
    <EvaluationDocument
      evaluation={ev}
      referee={referee}
      match={match}
      tournament={tournament}
      lang={lang}
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

// ════════════════════════════════════════════════════════════════════════════
//  ASSIGNMENTS REPORTS (daily + full tournament) — English, for the commission
// ════════════════════════════════════════════════════════════════════════════

const reportStyles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: DARK_GRAY, paddingTop: 30, paddingBottom: 36, paddingHorizontal: 35 },
  header: { backgroundColor: NAVY, marginHorizontal: -35, marginTop: -30, paddingHorizontal: 35, paddingVertical: 18, marginBottom: 18 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  headerSubtitle: { color: '#CBD5E1', fontSize: 10, marginTop: 3 },
  headerAccent: { width: 40, height: 3, backgroundColor: ORANGE, marginTop: 10 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  metaItem: { width: '33%', marginBottom: 4 },
  metaLabel: { fontSize: 8, color: MED_GRAY, textTransform: 'uppercase' },
  metaValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: DARK_GRAY },
  tableHead: { flexDirection: 'row', backgroundColor: NAVY, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 2 },
  th: { color: '#FFFFFF', fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  tr: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  trAlt: { backgroundColor: LIGHT_GRAY },
  td: { fontSize: 9, color: DARK_GRAY },
  tip: { flexDirection: 'row', marginBottom: 4, paddingRight: 8 },
  tipDot: { width: 8, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  tipText: { flex: 1, fontSize: 9, lineHeight: 1.35 },
  footer: { position: 'absolute', bottom: 18, left: 35, right: 35, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: MED_GRAY, borderTopWidth: 0.5, borderTopColor: '#E5E7EB', paddingTop: 6 },
})

const TIP_COLOR = { good: '#059669', warn: '#D97706', info: '#2563EB' }
const TIP_MARK = { good: '+', warn: '!', info: 'i' }

function Tips({ tips }) {
  return (
    <View>
      {tips.map((t, i) => (
        <View key={i} style={reportStyles.tip}>
          <Text style={[reportStyles.tipDot, { color: TIP_COLOR[t.type] || MED_GRAY }]}>{TIP_MARK[t.type] || '-'}</Text>
          <Text style={reportStyles.tipText}>{t.text}</Text>
        </View>
      ))}
    </View>
  )
}

function DayReportDocument({ tournament, dayNumber, stats, tips, times, finals }) {
  return (
    <Document>
      <Page size="A4" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Text style={reportStyles.headerTitle}>DAY {dayNumber} — ASSIGNMENT REPORT</Text>
          <Text style={reportStyles.headerSubtitle}>{tournament?.name || 'Tournament'}{tournament?.location ? ` · ${tournament.location}` : ''}</Text>
          <View style={reportStyles.headerAccent} />
        </View>

        <View style={reportStyles.metaRow}>
          <View style={reportStyles.metaItem}><Text style={reportStyles.metaLabel}>Rounds</Text><Text style={reportStyles.metaValue}>{stats.rounds}</Text></View>
          <View style={reportStyles.metaItem}><Text style={reportStyles.metaLabel}>Courts</Text><Text style={reportStyles.metaValue}>{stats.courtsCount}</Text></View>
          <View style={reportStyles.metaItem}><Text style={reportStyles.metaLabel}>Active referees</Text><Text style={reportStyles.metaValue}>{stats.workingCount}/{stats.totalRefs}</Text></View>
          {times && (
            <View style={reportStyles.metaItem}><Text style={reportStyles.metaLabel}>Schedule</Text><Text style={reportStyles.metaValue}>{times.start} → ~{times.end}</Text></View>
          )}
          <View style={reportStyles.metaItem}><Text style={reportStyles.metaLabel}>Workload spread</Text><Text style={reportStyles.metaValue}>{stats.spread} match{stats.spread === 1 ? '' : 'es'}</Text></View>
          <View style={reportStyles.metaItem}><Text style={reportStyles.metaLabel}>Evaluated</Text><Text style={reportStyles.metaValue}>{stats.evaluatedCount}/{stats.workingCount}</Text></View>
        </View>

        <Text style={reportStyles.sectionTitle}>Referee workload</Text>
        <View style={reportStyles.tableHead}>
          <Text style={[reportStyles.th, { width: '38%' }]}>Referee</Text>
          <Text style={[reportStyles.th, { width: '12%' }]}>Level</Text>
          <Text style={[reportStyles.th, { width: '14%' }]}>Matches</Text>
          <Text style={[reportStyles.th, { width: '12%' }]}>Rest</Text>
          <Text style={[reportStyles.th, { width: '14%' }]}>Max row</Text>
          <Text style={[reportStyles.th, { width: '10%' }]}>Eval</Text>
        </View>
        {stats.perRef.map((r, i) => (
          <View key={r.id} style={[reportStyles.tr, i % 2 === 1 ? reportStyles.trAlt : {}]}>
            <Text style={[reportStyles.td, { width: '38%' }]}>{r.name}</Text>
            <Text style={[reportStyles.td, { width: '12%' }]}>{r.level}</Text>
            <Text style={[reportStyles.td, { width: '14%' }]}>{r.matches}</Text>
            <Text style={[reportStyles.td, { width: '12%' }]}>{r.rest}</Text>
            <Text style={[reportStyles.td, { width: '14%' }]}>{r.maxConsec}</Text>
            <Text style={[reportStyles.td, { width: '10%' }]}>{r.evaluated ? 'Yes' : '—'}</Text>
          </View>
        ))}

        {finals && finals.length > 0 && (
          <>
            <Text style={reportStyles.sectionTitle}>Finals & line judges</Text>
            {finals.map((f, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAVY }}>{f.court}</Text>
                <Text style={[reportStyles.td, { marginTop: 1 }]}>Referees: {f.referees || '—'}</Text>
                <Text style={[reportStyles.td, { marginTop: 1 }]}>Line judges: {f.lineJudges || '—'}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={reportStyles.sectionTitle}>Coach notes & suggestions</Text>
        <Tips tips={tips} />

        <View style={reportStyles.footer} fixed>
          <Text>BVB Referee Coach · Day {dayNumber} report</Text>
          <Text>Generated {formatDateTime(new Date())}</Text>
        </View>
      </Page>
    </Document>
  )
}

// ─── End-of-day evaluation COMMENTS recap (grouped by day) ───────────────────
const RECAP_LEAD = { 0: 'Not evaluable', 1: 'Needs support', 2: 'Developing', 3: 'Solid', 4: 'Role model' }
const RECAP_BENCH = { 0: 'Not evaluable', 1: 'Needs work', 2: 'Developing', 3: 'Solid', 4: 'Excellent' }

export function collectEvalComments(ev) {
  const out = []
  if (ev.general_notes && String(ev.general_notes).trim()) out.push({ label: null, text: String(ev.general_notes).trim() })
  if (ev.leadership_note && String(ev.leadership_note).trim()) {
    out.push({ label: `Leadership${ev.leadership_score != null ? ` (${RECAP_LEAD[ev.leadership_score] || ev.leadership_score})` : ''}`, text: String(ev.leadership_note).trim() })
  } else if (ev.leadership_score != null) {
    out.push({ label: 'Leadership', text: RECAP_LEAD[ev.leadership_score] || String(ev.leadership_score) })
  }
  if (ev.bench_note && String(ev.bench_note).trim()) {
    out.push({ label: `Benches/off-court${ev.bench_score != null ? ` (${RECAP_BENCH[ev.bench_score] || ev.bench_score})` : ''}`, text: String(ev.bench_note).trim() })
  } else if (ev.bench_score != null) {
    out.push({ label: 'Benches/off-court', text: RECAP_BENCH[ev.bench_score] || String(ev.bench_score) })
  }
  if (ev.offcourt_control && OFFCOURT_PDF[ev.offcourt_control]) {
    const oc = OFFCOURT_PDF[ev.offcourt_control]
    out.push({ label: `Off-court control (${oc.pts})`, text: (ev.offcourt_note && String(ev.offcourt_note).trim()) ? String(ev.offcourt_note).trim() : oc.label })
  } else if (ev.offcourt_note && String(ev.offcourt_note).trim()) {
    out.push({ label: 'Off-court control', text: String(ev.offcourt_note).trim() })
  }
  for (const c of CRITERIA) {
    const n = ev[`note_${c.key}`]
    if (n && String(n).trim()) out.push({ label: c.label, text: String(n).trim() })
  }
  return out
}

function CommentsRecapDocument({ tournament, byDay }) {
  return (
    <Document>
      <Page size="A4" style={reportStyles.page} wrap>
        <View style={reportStyles.header}>
          <Text style={reportStyles.headerTitle}>EVALUATION COMMENTS — RECAP</Text>
          <Text style={reportStyles.headerSubtitle}>
            {tournament?.name || 'Tournament'}{tournament?.location ? ` · ${tournament.location}` : ''}
          </Text>
          <View style={reportStyles.headerAccent} />
        </View>

        {byDay.length === 0 && (
          <Text style={reportStyles.td}>No comments recorded yet.</Text>
        )}

        {byDay.map((day) => (
          <View key={day.key}>
            <Text style={reportStyles.sectionTitle}>
              {day.label} — {day.items.length} evaluation{day.items.length !== 1 ? 's' : ''}
            </Text>
            {day.items.map((it, idx) => (
              <View key={idx} style={{ marginBottom: 9 }} wrap={false}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAVY }}>
                  {it.name}{it.role ? `   ·   ${it.role}` : ''}
                </Text>
                {(it.match || it.date) && (
                  <Text style={{ fontSize: 8, color: MED_GRAY, marginBottom: 2 }}>
                    {[it.match, it.date].filter(Boolean).join('   ·   ')}
                  </Text>
                )}
                {it.comments.map((c, ci) => (
                  <View key={ci} style={{ flexDirection: 'row', marginBottom: 2 }}>
                    <Text style={{ width: 9, fontSize: 9 }}>•</Text>
                    <Text style={{ flex: 1, fontSize: 9, lineHeight: 1.35 }}>
                      {c.label ? <Text style={{ fontFamily: 'Helvetica-Bold' }}>{c.label}: </Text> : null}{c.text}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}

        <View style={reportStyles.footer} fixed>
          <Text>BVB Referee Coach · Evaluation comments recap</Text>
          <Text>Generated {formatDateTime(new Date())}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateCommentsRecapPDF({ tournament, evaluations }) {
  const map = new Map()
  for (const ev of (evaluations || [])) {
    const comments = collectEvalComments(ev)
    if (comments.length === 0) continue
    const day = ev.day_number || 0
    if (!map.has(day)) map.set(day, [])
    map.get(day).push({
      name: ev.referees ? refereeName(ev.referees) : 'Unknown referee',
      role: ev.role || '',
      match: ev.match_description || '',
      date: ev.evaluated_at ? formatDate(ev.evaluated_at) : '',
      comments,
    })
  }
  const byDay = [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, items]) => ({
      key: String(day),
      label: day ? `Day ${day}` : 'Unassigned day',
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }))

  const blob = await pdf(<CommentsRecapDocument tournament={tournament} byDay={byDay} />).toBlob()
  return blob
}

// ─── Anonymised GROUP summary (general points, no names) ─────────────────────
const GROUP_HEADINGS = ['Positives to keep', 'Areas to improve', 'Reminders']

function GroupSummaryLines({ text }) {
  const lines = String(text || '').split(/\r?\n/)
  return (
    <View>
      {lines.map((raw, i) => {
        const line = raw.trim()
        if (!line) return <View key={i} style={{ height: 3 }} />
        if (GROUP_HEADINGS.some((h) => line.toLowerCase() === h.toLowerCase())) {
          return <Text key={i} style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 6, marginBottom: 2 }}>{line}</Text>
        }
        const bullet = line.replace(/^[-•*]\s*/, '')
        const isBullet = /^[-•*]\s+/.test(line)
        return (
          <View key={i} style={{ flexDirection: 'row', marginBottom: 2 }}>
            {isBullet && <Text style={{ width: 9, fontSize: 9 }}>•</Text>}
            <Text style={{ flex: 1, fontSize: 9, lineHeight: 1.35 }}>{isBullet ? bullet : line}</Text>
          </View>
        )
      })}
    </View>
  )
}

function GroupSummaryDocument({ tournament, byDay }) {
  return (
    <Document>
      <Page size="A4" style={reportStyles.page} wrap>
        <View style={reportStyles.header}>
          <Text style={reportStyles.headerTitle}>REFEREE GROUP DEBRIEF</Text>
          <Text style={reportStyles.headerSubtitle}>
            {tournament?.name || 'Tournament'}{tournament?.location ? ` · ${tournament.location}` : ''} · General feedback to all referees
          </Text>
          <View style={reportStyles.headerAccent} />
        </View>

        {byDay.length === 0 && <Text style={reportStyles.td}>No comments recorded yet.</Text>}

        {byDay.map((day) => (
          <View key={day.key} wrap={false}>
            <Text style={reportStyles.sectionTitle}>{day.label}</Text>
            <GroupSummaryLines text={day.text} />
          </View>
        ))}

        <View style={reportStyles.footer} fixed>
          <Text>BVB Referee Coach · Group debrief (anonymised)</Text>
          <Text>Generated {formatDateTime(new Date())}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateGroupSummaryPDF({ tournament, byDay }) {
  const blob = await pdf(<GroupSummaryDocument tournament={tournament} byDay={byDay} />).toBlob()
  return blob
}

export async function generateDayReportPDF({ tournament, dayNumber, stats, tips, times, finals }) {
  const blob = await pdf(
    <DayReportDocument tournament={tournament} dayNumber={dayNumber} stats={stats} tips={tips} times={times} finals={finals} />
  ).toBlob()
  return blob
}

function TournamentReportDocument({ tournament, tStats, tTips, dayReports }) {
  return (
    <Document>
      <Page size="A4" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Text style={reportStyles.headerTitle}>TOURNAMENT REPORT</Text>
          <Text style={reportStyles.headerSubtitle}>{tournament?.name || 'Tournament'}{tournament?.location ? ` · ${tournament.location}` : ''}</Text>
          <View style={reportStyles.headerAccent} />
        </View>

        <View style={reportStyles.metaRow}>
          <View style={reportStyles.metaItem}><Text style={reportStyles.metaLabel}>Days</Text><Text style={reportStyles.metaValue}>{tStats.days}</Text></View>
          <View style={reportStyles.metaItem}><Text style={reportStyles.metaLabel}>Total rounds</Text><Text style={reportStyles.metaValue}>{tStats.totalRounds}</Text></View>
          <View style={reportStyles.metaItem}><Text style={reportStyles.metaLabel}>Total matches</Text><Text style={reportStyles.metaValue}>{tStats.totalMatches}</Text></View>
          <View style={reportStyles.metaItem}><Text style={reportStyles.metaLabel}>Referees used</Text><Text style={reportStyles.metaValue}>{tStats.rows.filter((r) => r.matches > 0).length}</Text></View>
          <View style={reportStyles.metaItem}><Text style={reportStyles.metaLabel}>Workload spread</Text><Text style={reportStyles.metaValue}>{tStats.spread}</Text></View>
        </View>

        <Text style={reportStyles.sectionTitle}>Workload across all days</Text>
        <View style={reportStyles.tableHead}>
          <Text style={[reportStyles.th, { width: '44%' }]}>Referee</Text>
          <Text style={[reportStyles.th, { width: '12%' }]}>Level</Text>
          <Text style={[reportStyles.th, { width: '16%' }]}>Matches</Text>
          <Text style={[reportStyles.th, { width: '14%' }]}>Days</Text>
          <Text style={[reportStyles.th, { width: '14%' }]}>Max row</Text>
        </View>
        {tStats.rows.map((r, i) => (
          <View key={r.id} style={[reportStyles.tr, i % 2 === 1 ? reportStyles.trAlt : {}]}>
            <Text style={[reportStyles.td, { width: '44%' }]}>{r.name}</Text>
            <Text style={[reportStyles.td, { width: '12%' }]}>{r.level}</Text>
            <Text style={[reportStyles.td, { width: '16%' }]}>{r.matches}</Text>
            <Text style={[reportStyles.td, { width: '14%' }]}>{r.days}</Text>
            <Text style={[reportStyles.td, { width: '14%' }]}>{r.maxConsec}</Text>
          </View>
        ))}

        <Text style={reportStyles.sectionTitle}>Per-day summary</Text>
        <View style={reportStyles.tableHead}>
          <Text style={[reportStyles.th, { width: '20%' }]}>Day</Text>
          <Text style={[reportStyles.th, { width: '20%' }]}>Rounds</Text>
          <Text style={[reportStyles.th, { width: '30%' }]}>Active refs</Text>
          <Text style={[reportStyles.th, { width: '30%' }]}>Spread</Text>
        </View>
        {dayReports.map(({ dayNumber, stats }, i) => (
          <View key={dayNumber} style={[reportStyles.tr, i % 2 === 1 ? reportStyles.trAlt : {}]}>
            <Text style={[reportStyles.td, { width: '20%' }]}>Day {dayNumber}</Text>
            <Text style={[reportStyles.td, { width: '20%' }]}>{stats.rounds}</Text>
            <Text style={[reportStyles.td, { width: '30%' }]}>{stats.workingCount}/{stats.totalRefs}</Text>
            <Text style={[reportStyles.td, { width: '30%' }]}>{stats.spread}</Text>
          </View>
        ))}

        <Text style={reportStyles.sectionTitle}>Commission notes & suggestions</Text>
        <Tips tips={tTips} />

        <View style={reportStyles.footer} fixed>
          <Text>BVB Referee Coach · Tournament report</Text>
          <Text>Generated {formatDateTime(new Date())}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateTournamentReportPDF({ tournament, tStats, tTips, dayReports }) {
  const blob = await pdf(
    <TournamentReportDocument tournament={tournament} tStats={tStats} tTips={tTips} dayReports={dayReports} />
  ).toBlob()
  return blob
}

// ════════════════════════════════════════════════════════════════════════════
//  PER-REFEREE DIGESTS — evening (one day) + end-of-tournament (with evolution)
//  Sent individually to each referee via WhatsApp/PDF. English.
// ════════════════════════════════════════════════════════════════════════════
import { DIGEST_CRITERIA } from './report'

const CRIT_SHORT = { positioning: 'POS', signals: 'SIG', attitude: 'ATT', captain_comm: 'CAP', presentation: 'PRE' }

// Legenda delle sigle dei punteggi, stampata in fondo ai PDF di valutazione
const legendStyles = StyleSheet.create({
  box: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  title: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: MED_GRAY, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  row: { flexDirection: 'row', marginBottom: 1.5 },
  abbr: { width: 46, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: NAVY },
  desc: { flex: 1, fontSize: 8.5, color: MED_GRAY },
})

function CriteriaLegend() {
  const L = readLegend()
  return (
    <View style={legendStyles.box} wrap={false}>
      <Text style={legendStyles.title}>Score abbreviations</Text>
      {LEGEND_ORDER.map((k) => (
        <View key={k} style={legendStyles.row}>
          <Text style={legendStyles.abbr}>{k}</Text>
          <Text style={legendStyles.desc}>{L[k]}</Text>
        </View>
      ))}
    </View>
  )
}

function fmt(n) { return n == null ? '—' : Number(n).toFixed(1) }
function signed(n) { return n == null ? '—' : (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1)) }
function trendWord(n) { if (n == null) return ''; if (n >= 0.3) return 'improving'; if (n <= -0.3) return 'declining'; return 'stable' }

const digestStyles = StyleSheet.create({
  avgBox: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: LIGHT_GRAY, borderRadius: 4, padding: 8, marginBottom: 6 },
  avgCell: { width: '16.6%', alignItems: 'center' },
  avgLabel: { fontSize: 7, color: MED_GRAY, textTransform: 'uppercase' },
  avgVal: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 1 },
  noteBlock: { marginBottom: 5, paddingLeft: 6, borderLeftWidth: 2, borderLeftColor: '#E5E7EB' },
  noteHead: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: NAVY },
  noteText: { fontSize: 9, color: DARK_GRAY, marginTop: 1, lineHeight: 1.3 },
})

function AvgStrip({ averages, label = 'Average' }) {
  return (
    <View style={digestStyles.avgBox}>
      <View style={digestStyles.avgCell}>
        <Text style={digestStyles.avgLabel}>{label}</Text>
        <Text style={[digestStyles.avgVal, { color: ORANGE }]}>{fmt(averages.overall)}</Text>
      </View>
      {DIGEST_CRITERIA.map((c) => (
        <View key={c.key} style={digestStyles.avgCell}>
          <Text style={digestStyles.avgLabel}>{CRIT_SHORT[c.key]}</Text>
          <Text style={digestStyles.avgVal}>{fmt(averages.criteria[c.key])}</Text>
        </View>
      ))}
    </View>
  )
}

function MatchesTable({ matches }) {
  return (
    <>
      <View style={reportStyles.tableHead}>
        <Text style={[reportStyles.th, { width: '28%' }]}>Match</Text>
        <Text style={[reportStyles.th, { width: '10%' }]}>Role</Text>
        {DIGEST_CRITERIA.map((c) => (
          <Text key={c.key} style={[reportStyles.th, { width: '10%', textAlign: 'center' }]}>{CRIT_SHORT[c.key]}</Text>
        ))}
        <Text style={[reportStyles.th, { width: '12%', textAlign: 'center' }]}>Overall</Text>
      </View>
      {matches.map((m, i) => (
        <View key={i} style={[reportStyles.tr, i % 2 === 1 ? reportStyles.trAlt : {}]}>
          <Text style={[reportStyles.td, { width: '28%' }]}>{m.label}</Text>
          <Text style={[reportStyles.td, { width: '10%' }]}>{m.role}</Text>
          {DIGEST_CRITERIA.map((c) => (
            <Text key={c.key} style={[reportStyles.td, { width: '10%', textAlign: 'center', color: m.repeats[c.key] ? ORANGE : DARK_GRAY }]}>
              {m.scores[c.key] ?? '—'}{m.repeats[c.key] ? '!' : ''}
            </Text>
          ))}
          <Text style={[reportStyles.td, { width: '12%', textAlign: 'center', fontFamily: 'Helvetica-Bold' }]}>{fmt(m.overall)}</Text>
        </View>
      ))}
    </>
  )
}

function MatchNotes({ matches }) {
  const withNotes = matches.filter((m) => m.general || Object.values(m.notes).some(Boolean))
  if (!withNotes.length) return null
  return (
    <>
      <Text style={reportStyles.sectionTitle}>Observations</Text>
      {withNotes.map((m, i) => (
        <View key={i} style={digestStyles.noteBlock}>
          <Text style={digestStyles.noteHead}>{m.label}</Text>
          {DIGEST_CRITERIA.map((c) => m.notes[c.key] ? (
            <Text key={c.key} style={digestStyles.noteText}>• {CRIT_SHORT[c.key]}: {m.notes[c.key]}</Text>
          ) : null)}
          {m.general ? <Text style={digestStyles.noteText}>• General: {m.general}</Text> : null}
        </View>
      ))}
    </>
  )
}

function RefereeDayDigestDocument({ referee, tournament, dayNumber, digest, coachComment, finalNote }) {
  return (
    <Document>
      <Page size="A4" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Text style={reportStyles.headerTitle}>DAY {dayNumber} — EVALUATION DIGEST</Text>
          <Text style={reportStyles.headerSubtitle}>{refereeName(referee)}{tournament?.name ? ` · ${tournament.name}` : ''}</Text>
          <View style={reportStyles.headerAccent} />
          <HeaderLogo />
        </View>

        <Text style={reportStyles.sectionTitle}>Day average ({digest.count} match{digest.count === 1 ? '' : 'es'})</Text>
        <AvgStrip averages={digest.averages} label="Day avg" />

        <Text style={reportStyles.sectionTitle}>Matches</Text>
        <MatchesTable matches={digest.matches} />

        <MatchNotes matches={digest.matches} />

        {coachComment ? (
          <View wrap={false}>
            <Text style={reportStyles.sectionTitle}>Coach comment — Day {dayNumber}</Text>
            <Text style={{ fontSize: 10, color: DARK_GRAY, lineHeight: 1.4 }}>{coachComment}</Text>
          </View>
        ) : null}

        {finalNote ? (
          <View wrap={false}>
            <Text style={reportStyles.sectionTitle}>Final note</Text>
            <Text style={{ fontSize: 10, color: DARK_GRAY, lineHeight: 1.4 }}>{finalNote}</Text>
          </View>
        ) : null}

        <CriteriaLegend />

        <View style={reportStyles.footer} fixed>
          <Text>BVB Referee Coach · Day {dayNumber} digest · {refereeName(referee)}</Text>
          <Text>Generated {formatDateTime(new Date())}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateRefereeDayDigestPDF({ referee, tournament, dayNumber, digest, coachComment, finalNote }) {
  const comment = await translateToEnglishSafe(coachComment)
  const note = await translateToEnglishSafe(finalNote)
  return pdf(<RefereeDayDigestDocument referee={referee} tournament={tournament} dayNumber={dayNumber} digest={digest} coachComment={comment} finalNote={note} />).toBlob()
}

function RefereeTournamentDigestDocument({ referee, tournament, evolution, advice, coachComment }) {
  const ev = evolution.evolution
  return (
    <Document>
      <Page size="A4" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Text style={reportStyles.headerTitle}>TOURNAMENT EVALUATION</Text>
          <Text style={reportStyles.headerSubtitle}>{refereeName(referee)}{tournament?.name ? ` · ${tournament.name}` : ''}</Text>
          <View style={reportStyles.headerAccent} />
          <HeaderLogo />
        </View>

        <Text style={reportStyles.sectionTitle}>Tournament average ({evolution.count} match{evolution.count === 1 ? '' : 'es'})</Text>
        <AvgStrip averages={evolution.overall} label="Overall" />

        <Text style={reportStyles.sectionTitle}>Day-by-day</Text>
        <View style={reportStyles.tableHead}>
          <Text style={[reportStyles.th, { width: '20%' }]}>Day</Text>
          <Text style={[reportStyles.th, { width: '14%', textAlign: 'center' }]}>Matches</Text>
          <Text style={[reportStyles.th, { width: '16%', textAlign: 'center' }]}>Overall</Text>
          {DIGEST_CRITERIA.map((c) => (
            <Text key={c.key} style={[reportStyles.th, { width: '10%', textAlign: 'center' }]}>{CRIT_SHORT[c.key]}</Text>
          ))}
        </View>
        {evolution.perDay.map((d, i) => (
          <View key={d.day} style={[reportStyles.tr, i % 2 === 1 ? reportStyles.trAlt : {}]}>
            <Text style={[reportStyles.td, { width: '20%' }]}>Day {d.day}</Text>
            <Text style={[reportStyles.td, { width: '14%', textAlign: 'center' }]}>{d.count}</Text>
            <Text style={[reportStyles.td, { width: '16%', textAlign: 'center', fontFamily: 'Helvetica-Bold' }]}>{fmt(d.averages.overall)}</Text>
            {DIGEST_CRITERIA.map((c) => (
              <Text key={c.key} style={[reportStyles.td, { width: '10%', textAlign: 'center' }]}>{fmt(d.averages.criteria[c.key])}</Text>
            ))}
          </View>
        ))}

        {ev && (
          <>
            <Text style={reportStyles.sectionTitle}>Evolution (Day {ev.fromDay} → Day {ev.toDay})</Text>
            <View style={[digestStyles.avgBox, { backgroundColor: '#FFF7ED' }]}>
              <View style={digestStyles.avgCell}>
                <Text style={digestStyles.avgLabel}>Overall</Text>
                <Text style={[digestStyles.avgVal, { color: ev.overall > 0 ? '#059669' : ev.overall < 0 ? '#DC2626' : MED_GRAY }]}>{signed(ev.overall)}</Text>
              </View>
              {DIGEST_CRITERIA.map((c) => (
                <View key={c.key} style={digestStyles.avgCell}>
                  <Text style={digestStyles.avgLabel}>{CRIT_SHORT[c.key]}</Text>
                  <Text style={[digestStyles.avgVal, { fontSize: 11, color: ev.criteria[c.key] > 0 ? '#059669' : ev.criteria[c.key] < 0 ? '#DC2626' : MED_GRAY }]}>{signed(ev.criteria[c.key])}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 9, color: MED_GRAY }}>Trend: {trendWord(ev.overall)}</Text>
          </>
        )}

        <Text style={reportStyles.sectionTitle}>Coach summary & advice</Text>
        <Text style={{ fontSize: 10, color: DARK_GRAY, lineHeight: 1.4, marginBottom: 4 }}>{advice.summary}</Text>
        {advice.advice ? <Text style={{ fontSize: 10, color: DARK_GRAY, lineHeight: 1.4 }}>{advice.advice}</Text> : null}

        {coachComment ? (
          <View wrap={false}>
            <Text style={reportStyles.sectionTitle}>Final coach comment</Text>
            <Text style={{ fontSize: 10, color: DARK_GRAY, lineHeight: 1.4 }}>{coachComment}</Text>
          </View>
        ) : null}

        <CriteriaLegend />

        <View style={reportStyles.footer} fixed>
          <Text>BVB Referee Coach · Tournament evaluation · {refereeName(referee)}</Text>
          <Text>Generated {formatDateTime(new Date())}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateRefereeTournamentDigestPDF({ referee, tournament, evolution, advice, coachComment }) {
  const comment = await translateToEnglishSafe(coachComment)
  const advice2 = advice ? await translateFieldsToEnglish(advice, ['summary', 'advice']) : advice
  return pdf(<RefereeTournamentDigestDocument referee={referee} tournament={tournament} evolution={evolution} advice={advice2} coachComment={comment} />).toBlob()
}

// PDF combinato: tutte le valutazioni di ogni giornata (Day 1 + Day 2 …) in un unico file,
// con la nota finale del coach per ciascuna giornata.
function RefereeMultiDayDigestDocument({ referee, tournament, dayDigests }) {
  return (
    <Document>
      <Page size="A4" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Text style={reportStyles.headerTitle}>EVALUATION REPORT</Text>
          <Text style={reportStyles.headerSubtitle}>{refereeName(referee)}{tournament?.name ? ` · ${tournament.name}` : ''}</Text>
          <View style={reportStyles.headerAccent} />
          <HeaderLogo />
        </View>

        {dayDigests.map((d, i) => (
          <View key={d.dayNumber} break={i > 0}>
            <Text style={reportStyles.sectionTitle}>Day {d.dayNumber} — average ({d.digest.count} match{d.digest.count === 1 ? '' : 'es'})</Text>
            <AvgStrip averages={d.digest.averages} label={`Day ${d.dayNumber} avg`} />

            <Text style={reportStyles.sectionTitle}>Day {d.dayNumber} — matches</Text>
            <MatchesTable matches={d.digest.matches} />

            <MatchNotes matches={d.digest.matches} />

            {d.coachComment ? (
              <View wrap={false}>
                <Text style={reportStyles.sectionTitle}>Coach comment — Day {d.dayNumber}</Text>
                <Text style={{ fontSize: 10, color: DARK_GRAY, lineHeight: 1.4 }}>{d.coachComment}</Text>
              </View>
            ) : null}

            {d.finalNote ? (
              <View wrap={false}>
                <Text style={reportStyles.sectionTitle}>Final note — Day {d.dayNumber}</Text>
                <Text style={{ fontSize: 10, color: DARK_GRAY, lineHeight: 1.4 }}>{d.finalNote}</Text>
              </View>
            ) : null}
          </View>
        ))}

        <CriteriaLegend />

        <View style={reportStyles.footer} fixed>
          <Text>BVB Referee Coach · Full evaluation report · {refereeName(referee)}</Text>
          <Text>Generated {formatDateTime(new Date())}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateRefereeMultiDayDigestPDF({ referee, tournament, dayDigests }) {
  const translatedDigests = await Promise.all(
    (dayDigests || []).map(async (d) => ({
      ...d,
      coachComment: await translateToEnglishSafe(d.coachComment),
      finalNote: await translateToEnglishSafe(d.finalNote),
    }))
  )
  return pdf(<RefereeMultiDayDigestDocument referee={referee} tournament={tournament} dayDigests={translatedDigests} />).toBlob()
}

// ─── Coach Day Report (osservazioni + registro problemi partite senza arbitro) ─
const drStyles = StyleSheet.create({
  body: { fontSize: 10, color: DARK_GRAY, lineHeight: 1.45, marginBottom: 4 },
  incident: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 8, marginBottom: 8 },
  incHead: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 4 },
  incRow: { flexDirection: 'row', marginBottom: 2 },
  incLabel: { width: 56, fontSize: 9, fontFamily: 'Helvetica-Bold', color: MED_GRAY },
  incVal: { flex: 1, fontSize: 9.5, color: DARK_GRAY, lineHeight: 1.4 },
})

function CoachDayReportDocument({ tournament, dayNumber, report }) {
  const inc = report?.incidents || []
  return (
    <Document>
      <Page size="A4" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Text style={reportStyles.headerTitle}>DAY REPORT</Text>
          <Text style={reportStyles.headerSubtitle}>{tournament?.name || ''}{dayNumber ? ` · Day ${dayNumber}` : ''}</Text>
          <View style={reportStyles.headerAccent} />
          <HeaderLogo />
        </View>

        <Text style={reportStyles.sectionTitle}>What went well</Text>
        <Text style={drStyles.body}>{report?.went_well || '—'}</Text>

        <Text style={reportStyles.sectionTitle}>What needs improvement</Text>
        <Text style={drStyles.body}>{report?.to_improve || '—'}</Text>

        <Text style={reportStyles.sectionTitle}>Incidents — self-refereed matches</Text>
        {inc.length === 0 ? (
          <Text style={drStyles.body}>No incidents reported.</Text>
        ) : (
          inc.map((it, i) => (
            <View key={i} style={drStyles.incident} wrap={false}>
              <Text style={drStyles.incHead}>#{i + 1}{it.court ? ` · ${it.court}` : ''}</Text>
              <View style={drStyles.incRow}><Text style={drStyles.incLabel}>Problem</Text><Text style={drStyles.incVal}>{it.problem || '—'}</Text></View>
              <View style={drStyles.incRow}><Text style={drStyles.incLabel}>Action</Text><Text style={drStyles.incVal}>{it.action || '—'}</Text></View>
              <View style={drStyles.incRow}><Text style={drStyles.incLabel}>Rule</Text><Text style={drStyles.incVal}>{it.rule || '—'}</Text></View>
            </View>
          ))
        )}

        <View style={reportStyles.footer} fixed>
          <Text>BVB Referee Coach · Day report{dayNumber ? ` · Day ${dayNumber}` : ''}</Text>
          <Text>Generated {formatDateTime(new Date())}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateCoachDayReportPDF({ tournament, dayNumber, report }) {
  const r = report || {}
  const tReport = {
    went_well: await translateToEnglishSafe(r.went_well),
    to_improve: await translateToEnglishSafe(r.to_improve),
    incidents: await Promise.all((r.incidents || []).map(async (it) => ({
      court: it.court || '',
      problem: await translateToEnglishSafe(it.problem),
      action: await translateToEnglishSafe(it.action),
      rule: it.rule || '',
    }))),
  }
  return pdf(<CoachDayReportDocument tournament={tournament} dayNumber={dayNumber} report={tReport} />).toBlob()
}

// ════════════════════════════════════════════════════════════════════════════
//  CEV BV-15 — Medical Injury Time-Out / Injury Forfeit (official form)
//  Faithful black/white reproduction of the official © CEV 2019 form, filled in.
// ════════════════════════════════════════════════════════════════════════════
const BVK = '#000000'
const bv15 = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: BVK, paddingTop: 26, paddingBottom: 22, paddingHorizontal: 34 },
  hdrBox: { borderWidth: 1.5, borderColor: BVK, flexDirection: 'row', alignItems: 'stretch' },
  hdrLeft: { width: 92, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderColor: BVK, paddingVertical: 10 },
  hdrCode: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  hdrCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  hdrTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center', lineHeight: 1.25 },
  hdrRight: { width: 64, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderColor: BVK },
  hdrCev: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  topRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 9 },
  topLabel: { fontSize: 9 },
  topLine: { flex: 1, borderBottomWidth: 1, borderColor: BVK, marginLeft: 6, paddingBottom: 1, fontSize: 9, minHeight: 12 },
  secLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 3 },
  table: { borderWidth: 1, borderColor: BVK },
  row: { flexDirection: 'row', borderTopWidth: 1, borderColor: BVK },
  rowFirst: { flexDirection: 'row' },
  lab: { width: 118, padding: 4, fontFamily: 'Helvetica-Bold', fontSize: 8.5, textAlign: 'right', borderRightWidth: 1, borderColor: BVK },
  val: { flex: 1, padding: 4, fontSize: 9 },
  labSmall: { width: 86, padding: 4, fontFamily: 'Helvetica-Bold', fontSize: 8.5, textAlign: 'right', borderRightWidth: 1, borderLeftWidth: 1, borderColor: BVK },
  cellGrow: { flex: 1, padding: 4, fontSize: 9, borderRightWidth: 1, borderColor: BVK },
  ackCell: { flex: 1, fontSize: 8.5 },
  ackHead: { fontFamily: 'Helvetica-Bold', padding: 4, borderRightWidth: 1, borderColor: BVK },
  ackHeadLast: { fontFamily: 'Helvetica-Bold', padding: 4 },
  ackVal: { padding: 4, minHeight: 26, borderRightWidth: 1, borderColor: BVK },
  ackValLast: { padding: 4, minHeight: 26 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  box: { width: 11, height: 11, borderWidth: 1, borderColor: BVK, alignItems: 'center', justifyContent: 'center' },
  boxX: { fontSize: 9, fontFamily: 'Helvetica-Bold', lineHeight: 1 },
  instrTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 10 },
  instr: { fontSize: 6.7, color: '#222', lineHeight: 1.3, marginTop: 2, textAlign: 'justify' },
  note: { fontSize: 7, fontStyle: 'italic', marginTop: 2, marginBottom: 2 },
  footer: { textAlign: 'center', fontSize: 7, color: MED_GRAY, marginTop: 8 },
})

function Box({ on }) {
  return <View style={bv15.box}>{on ? <Text style={bv15.boxX}>X</Text> : null}</View>
}

const BV15_INSTRUCTION = [
  'In the case of an athlete requesting a medical injury time-out, or forfeiting a match due to injury, immediately following the relevant scoresheet administration, he/she will be given a copy of the BV-15 form by the match referee (the exception to this rule being the use of a medical injury time-out due to blood injury).',
  'Upon receipt, the athlete will be then responsible for filling in the reasons for the medical injury time-out request or the forfeit of the match and must then sign it and present him/herself along with the form at the Events medical office. After going through a check by the official medical doctor, the athlete will then be responsible for giving the form, duly signed by the official medical doctor, to the CEV Supervisor who shall assess the situation (if needed together with the event\u2019s official medical doctor and the CEV Medical Delegate, if present) and make a copy of the BV-15 to be attached to the TS report together with the relevant match scoresheet.',
  'The athlete will receive the original BV-15 form for submission to their medical doctor(s) who will be then responsible for clearing the athlete for the next match by confirming that he/she is in good health condition and can participate without putting his/her own health at risk. The athlete must then present the form duly completed to the CEV Supervisor before he/she plays their next match in the same tournament. Otherwise, the BV-15 duly filled in, must be presented to the CEV Supervisor at the Technical Meeting of the next event the athlete wishes to participate in.',
]

function BV15Document({ r }) {
  const v = (x) => (x == null ? '' : String(x))
  return (
    <Document>
      <Page size="A4" style={bv15.page}>
        {/* Header */}
        <View style={bv15.hdrBox}>
          <View style={bv15.hdrLeft}><Text style={bv15.hdrCode}>BV-15</Text></View>
          <View style={bv15.hdrCenter}>
            <Text style={bv15.hdrTitle}>CEV BEACH VOLLEYBALL</Text>
            <Text style={bv15.hdrTitle}>MEDICAL INJURY TIME OUT /</Text>
            <Text style={bv15.hdrTitle}>INJURY FORFEIT</Text>
          </View>
          <View style={bv15.hdrRight}><Text style={bv15.hdrCev}>CEV</Text></View>
        </View>

        {/* Competition / venue */}
        <View style={bv15.topRow}>
          <Text style={bv15.topLabel}>Name of the Competition:</Text>
          <Text style={bv15.topLine}>{v(r.competition_name)}</Text>
        </View>
        <View style={bv15.topRow}>
          <Text style={bv15.topLabel}>Venue and date:</Text>
          <Text style={bv15.topLine}>{v(r.venue_date)}</Text>
        </View>

        {/* Athlete section */}
        <Text style={bv15.secLabel}>To be filled in by the athlete:</Text>
        <View style={bv15.table}>
          <View style={bv15.rowFirst}>
            <Text style={bv15.lab}>Athlete Name</Text>
            <Text style={bv15.cellGrow}>{v(r.athlete_name)}</Text>
            <Text style={bv15.labSmall}>Date (d/m/y)</Text>
            <Text style={bv15.val}>{v(r.form_date)}</Text>
          </View>
          <View style={bv15.row}>
            <Text style={bv15.lab}>Match #</Text>
            <Text style={bv15.cellGrow}>{v(r.match_number)}</Text>
            <Text style={bv15.labSmall}>Hour (h/m)</Text>
            <Text style={bv15.val}>{v(r.hour)}</Text>
          </View>
          <View style={bv15.row}>
            <Text style={bv15.lab}>Reason for Medical Time Out / Forfeit Injury</Text>
            <Text style={[bv15.val, { minHeight: 38 }]}>{v(r.reason)}</Text>
          </View>
          <View style={bv15.row}>
            <Text style={bv15.lab}>Athlete Signature</Text>
            <Text style={bv15.val}>{v(r.athlete_signature)}</Text>
          </View>
        </View>

        {/* Event's Doctor section */}
        <Text style={bv15.secLabel}>To be filled in by the official Event{'\u2019'}s Doctor:</Text>
        <View style={bv15.table}>
          <View style={bv15.rowFirst}>
            <Text style={bv15.lab}>Medical Evaluation</Text>
            <Text style={[bv15.val, { minHeight: 44 }]}>{v(r.medical_evaluation)}</Text>
          </View>
          <View style={bv15.row}>
            <View style={[bv15.val, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={{ fontSize: 8.5, flex: 1, paddingRight: 6 }}>
                Is the athlete able to continue in the competition without putting his/her own health condition at risk?
              </Text>
              <View style={bv15.checkRow}><Box on={r.able_to_continue === true} /><Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>YES</Text></View>
              <View style={[bv15.checkRow, { marginLeft: 10 }]}><Box on={r.able_to_continue === false} /><Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>NO</Text></View>
            </View>
          </View>
          <View style={bv15.row}>
            <Text style={bv15.lab}>Remarks</Text>
            <Text style={[bv15.val, { minHeight: 22 }]}>{v(r.remarks)}</Text>
          </View>
        </View>

        {/* Acknowledgement */}
        <Text style={bv15.secLabel}>Acknowledgement by:</Text>
        <View style={bv15.table}>
          <View style={[bv15.rowFirst, { borderBottomWidth: 1, borderColor: BVK }]}>
            <Text style={[bv15.ackCell, bv15.ackHead]}>Event{'\u2019'}s Doctor</Text>
            <Text style={[bv15.ackCell, bv15.ackHead]}>CEV Medical Delegate (if any)</Text>
            <Text style={[bv15.ackCell, bv15.ackHeadLast]}>CEV Supervisor</Text>
          </View>
          <View style={bv15.rowFirst}>
            <Text style={[bv15.ackCell, bv15.ackVal]}>{v(r.ack_event_doctor)}</Text>
            <Text style={[bv15.ackCell, bv15.ackVal]}>{v(r.ack_medical_delegate)}</Text>
            <Text style={[bv15.ackCell, bv15.ackValLast]}>{v(r.ack_supervisor)}</Text>
          </View>
        </View>

        {/* Team medical personnel / certificate */}
        <Text style={[bv15.secLabel, { marginTop: 12 }]}>TO BE FILLED IN BY THE TEAM{'\u2019'}S MEDICAL PERSONNEL</Text>
        <Text style={bv15.note}>
          Note: in the case that a medical doctor for the team concerned is not available, the athlete must get the written approval of the official Event{'\u2019'}s Doctor or the CEV Medical Delegate, if present.
        </Text>
        <View style={bv15.table}>
          <View style={[bv15.rowFirst, { padding: 5 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>MEDICAL CERTIFICATE</Text>
              <Text style={{ fontSize: 8.5, marginTop: 2, lineHeight: 1.3 }}>
                I, {v(r.cert_doctor_name) || '________________'} hereby confirm, that the athlete indicated here is fit to participate in any CEV Beach Volleyball event without putting his / her own health condition at risk.
              </Text>
              <View style={{ flexDirection: 'row', marginTop: 18 }}>
                <Text style={{ flex: 1, fontSize: 7.5, borderTopWidth: 1, borderColor: BVK, paddingTop: 2, marginRight: 14 }}>Name of the Medical Doctor (printed)</Text>
                <Text style={{ flex: 1, fontSize: 7.5, borderTopWidth: 1, borderColor: BVK, paddingTop: 2 }}>Signature of the Medical Doctor</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Instruction */}
        <Text style={bv15.instrTitle}>INSTRUCTION:</Text>
        {BV15_INSTRUCTION.map((p, i) => <Text key={i} style={bv15.instr}>{p}</Text>)}

        <Text style={bv15.footer}>© CEV 2019 · Generated with BVB RC{r.kind === 'FORFEIT' ? ' · INJURY FORFEIT' : ''}</Text>
      </Page>
    </Document>
  )
}

export async function generateBV15PDF(record) {
  return pdf(<BV15Document r={record} />).toBlob()
}
