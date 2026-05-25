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
                      <Text style={designationStyles.refLevel}>
                        {s.referees?.ranking_level
                          ? `Lv.${s.referees.ranking_level}`
                          : ''}
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
