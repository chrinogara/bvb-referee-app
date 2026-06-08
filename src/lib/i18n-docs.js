// Centralized translations for generated DOCUMENTS and MESSAGES (PDF + WhatsApp).
// The app UI stays in Italian — only the produced output is translated.
// Supported: English (en), French (fr), Dutch (nl).

export const DOC_LANGS = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
]

const SIGNATURE = 'RC Nogara Christian — CEV Referee Coach'

export const DICT = {
  en: {
    hi: 'Hi',
    evalIntro: 'Your evaluation summary from',
    role: 'Role',
    overall: 'Overall',
    repeatPenalty: 'Repeat fault penalty',
    criteriaScores: 'Criteria scores',
    repeatedFault: 'repeated fault',
    generalFeedback: 'General feedback',
    keepWorking: 'Keep working hard!',
    signature: SIGNATURE,
    notAssignedPre: 'You are not assigned to any court today',
    assignmentsIntroPre: 'here are your assignments for',
    seeYou: 'See you on court!',
    designations: 'BVB Referee Assignments',
    designationsUpdated: '[UPDATED] BVB REFEREE ASSIGNMENTS',
    day: 'Day',
    date: 'Date',
    pattern: 'Pattern',
    pause: 'PAUSE',
    court: 'Court',
    round: 'Round',
    criteria: {
      positioning: 'Positioning & Court Coverage',
      signals: 'Official Signals & 3-Step',
      attitude: 'Attitude & Player Management',
      captain_comm: 'Captain Communication',
      presentation: 'Presentation & Critical Situations',
    },
  },
  fr: {
    hi: 'Bonjour',
    evalIntro: 'Voici le résumé de ton évaluation pour',
    role: 'Rôle',
    overall: 'Score global',
    repeatPenalty: 'Pénalité faute répétée',
    criteriaScores: 'Scores par critère',
    repeatedFault: 'faute répétée',
    generalFeedback: 'Remarques générales',
    keepWorking: 'Continue comme ça !',
    signature: SIGNATURE,
    notAssignedPre: "Tu n'es assigné à aucun terrain aujourd'hui",
    assignmentsIntroPre: 'voici tes désignations pour',
    seeYou: 'À bientôt sur le terrain !',
    designations: 'Désignations arbitres BVB',
    designationsUpdated: '[MISE À JOUR] DÉSIGNATIONS ARBITRES BVB',
    day: 'Jour',
    date: 'Date',
    pattern: 'Rotation',
    pause: 'PAUSE',
    court: 'Terrain',
    round: 'Tour',
    criteria: {
      positioning: 'Placement & couverture du terrain',
      signals: 'Gestes officiels & 3 temps',
      attitude: 'Attitude & gestion des joueurs',
      captain_comm: 'Communication avec le capitaine',
      presentation: 'Présentation & situations critiques',
    },
  },
  nl: {
    hi: 'Hallo',
    evalIntro: 'Hier is de samenvatting van je evaluatie van',
    role: 'Rol',
    overall: 'Totaalscore',
    repeatPenalty: 'Strafpunt herhaalde fout',
    criteriaScores: 'Scores per criterium',
    repeatedFault: 'herhaalde fout',
    generalFeedback: 'Algemene feedback',
    keepWorking: 'Goed bezig, ga zo door!',
    signature: SIGNATURE,
    notAssignedPre: 'Je bent vandaag niet aan een terrein toegewezen',
    assignmentsIntroPre: 'hier zijn je aanstellingen voor',
    seeYou: 'Tot op het terrein!',
    designations: 'BVB Scheidsrechtersaanstellingen',
    designationsUpdated: '[BIJGEWERKT] BVB SCHEIDSRECHTERSAANSTELLINGEN',
    day: 'Dag',
    date: 'Datum',
    pattern: 'Rotatie',
    pause: 'PAUZE',
    court: 'Terrein',
    round: 'Ronde',
    criteria: {
      positioning: 'Positionering & terreindekking',
      signals: 'Officiële tekens & 3-stappen',
      attitude: 'Houding & spelersmanagement',
      captain_comm: 'Communicatie met kapitein',
      presentation: 'Presentatie & kritieke situaties',
    },
  },
}

export function dict(lang) {
  return DICT[lang] || DICT.en
}

// Normalize a phone number to international digits-only form for wa.me links.
// Handles "+32...", "0032...", and Belgian local "0xxx" -> "32xxx".
export function normalizePhone(raw) {
  let p = (raw || '').replace(/[^\d+]/g, '')
  if (p.startsWith('+')) p = p.slice(1)
  else if (p.startsWith('00')) p = p.slice(2)
  else if (p.startsWith('0')) p = '32' + p.slice(1)
  return p
}
