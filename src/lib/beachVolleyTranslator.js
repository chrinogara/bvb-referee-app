/**
 * Beach Volleyball terminology dictionary and Italian→English translator
 * Detects Italian text and proposes official Beach Volley terminology translations
 */

const ITALIAN_WORDS = [
  'il', 'la', 'i', 'le', 'di', 'da', 'che', 'e', 'o', 'per', 'con', 'su', 'in', 'è',
  'arbitro', 'arbitri', 'arbitro', 'giudice', 'giudici', 'linea', 'linee',
  'posizionamento', 'segnale', 'segnali', 'atteggiamento', 'comunicazione', 'presentazione',
  'buono', 'ottimo', 'eccellente', 'scarso', 'pessimo', 'adeguato', 'insufficiente',
  'nota', 'note', 'osservazione', 'osservazioni', 'commento', 'commenti',
  'campo', 'campi', 'court', 'tribunale', 'torneo', 'tornei', 'match', 'gara',
  'giornata', 'giorno', 'giornate', 'giorni', 'sessione', 'sessioni',
  'pausa', 'pausa', 'riposo', 'lavoro', 'turno', 'turni',
  'finale', 'finali', 'semifinale', 'semifinali', 'qualificazione', 'qualificazioni',
  'squadra', 'squadre', 'team', 'giocatore', 'giocatori', 'giocatrice', 'giocatrici',
  'allenatore', 'allenatori', 'coach', 'allenamento', 'allenamenti',
  'regola', 'regole', 'regolamento', 'regolamenti', 'fallo', 'falli', 'infrazioni',
  'punto', 'punti', 'punteggio', 'punteggi', 'set', 'sets', 'partita', 'partite',
  'attacco', 'attacchi', 'difesa', 'difese', 'blocco', 'blocchi', 'ricezione', 'ricezioni',
  'palleggio', 'palleggi', 'schiacciata', 'schiacciate', 'muro', 'muri',
  'assegnazione', 'assegnazioni', 'designazione', 'designazioni', 'ruolo', 'ruoli',
  'r1', 'r2', 'lj1', 'lj2', 'giudice', 'giudici', 'umpire', 'umpires',
  'feedback', 'valutazione', 'valutazioni', 'valutazione', 'punteggio',
  'briefing', 'briefing', 'riunione', 'riunioni', 'convocazione', 'convocazioni',
  'rapporto', 'rapporti', 'report', 'relazione', 'relazioni',
  'sconto', 'sconti', 'penalità', 'penalità', 'multa', 'multe',
];

const BEACH_VOLLEY_DICTIONARY = {
  // Core terminology
  'arbitro': 'referee',
  'arbitri': 'referees',
  'giudice': 'judge',
  'giudici': 'judges',
  'giudice di linea': 'line judge',
  'giudici di linea': 'line judges',
  'linea': 'line',
  'linee': 'lines',

  // Evaluation criteria
  'posizionamento': 'positioning',
  'segnale': 'signals',
  'segnali': 'signals',
  'atteggiamento': 'attitude',
  'comunicazione': 'communication',
  'comunicazione col capitano': 'captain communication',
  'presentazione': 'presentation',

  // Notes & feedback
  'nota': 'note',
  'note': 'notes',
  'osservazione': 'observation',
  'osservazioni': 'observations',
  'commento': 'comment',
  'commenti': 'comments',
  'feedback': 'feedback',

  // Court & venue
  'campo': 'court',
  'campi': 'courts',
  'sede': 'venue',
  'torneo': 'tournament',
  'tornei': 'tournaments',

  // Schedule
  'giornata': 'day',
  'giornate': 'days',
  'sessione': 'session',
  'sessioni': 'sessions',
  'turno': 'shift',
  'turni': 'shifts',
  'pausa': 'break',
  'pause': 'breaks',
  'riposo': 'rest',

  // Matches
  'match': 'match',
  'gara': 'match',
  'partita': 'match',
  'partite': 'matches',
  'finale': 'final',
  'finali': 'finals',
  'semifinale': 'semifinal',
  'semifinali': 'semifinals',
  'qualificazione': 'qualification',
  'qualificazioni': 'qualifications',

  // Roles
  'ruolo': 'role',
  'ruoli': 'roles',
  'R1': 'R1',
  'R2': 'R2',
  'LJ1': 'LJ1',
  'LJ2': 'LJ2',

  // Evaluation grades
  'eccellente': 'excellent',
  'buono': 'good',
  'adeguato': 'adequate',
  'insufficiente': 'below standard',
  'pessimo': 'poor',
  'scarso': 'poor',

  // Scoring & faults
  'punto': 'point',
  'punti': 'points',
  'fallo': 'fault',
  'falli': 'faults',
  'fallo ripetuto': 'repeated fault',
  'falli ripetuti': 'repeated faults',
  'penalità': 'penalty',
  'multa': 'fine',

  // Game terms
  'set': 'set',
  'sets': 'sets',
  'attacco': 'attack',
  'attacchi': 'attacks',
  'difesa': 'defense',
  'difese': 'defenses',
  'blocco': 'block',
  'blocchi': 'blocks',
  'ricezione': 'reception',
  'ricezioni': 'receptions',
  'palleggio': 'setting',
  'palleggi': 'sets',
  'schiacciata': 'spike',
  'schiacciate': 'spikes',
  'muro': 'net block',
  'muri': 'net blocks',

  // Meeting/briefing
  'briefing': 'briefing',
  'riunione': 'meeting',
  'riunioni': 'meetings',
  'convocazione': 'briefing',
  'convocazioni': 'briefings',

  // Report/documentation
  'rapporto': 'report',
  'rapporti': 'reports',
  'relazione': 'report',
  'relazioni': 'reports',
  'documentazione': 'documentation',
  'documento': 'document',

  // Ranking/assessment
  'valutazione': 'evaluation',
  'valutazioni': 'evaluations',
  'punteggio': 'score',
  'punteggi': 'scores',
  'classifica': 'ranking',
  'classifiche': 'rankings',

  // Designations
  'designazione': 'designation',
  'designazioni': 'designations',
  'assegnazione': 'assignment',
  'assegnazioni': 'assignments',

  // Teams & players
  'squadra': 'team',
  'squadre': 'teams',
  'giocatore': 'player',
  'giocatori': 'players',
  'giocatrice': 'player',
  'giocatrici': 'players',
  'capitano': 'captain',
  'capitani': 'captains',
  'allenatore': 'coach',
  'allenatori': 'coaches',
  'allenamento': 'practice',
  'allenamenti': 'practices',

  // Regulation/rules
  'regola': 'rule',
  'regole': 'rules',
  'regolamento': 'regulation',
  'regolamenti': 'regulations',
  'infrazione': 'violation',
  'infrazioni': 'violations',

  // Common verbs
  'chiede': 'asks',
  'chiedere': 'ask',
  'chiedo': 'ask',
  'lasciare': 'leave',
  'lascia': 'leaves',
  'lascio': 'leave',
  'è': 'is',
  'sono': 'are',
  'hai': 'have',
  'ha': 'has',
  'abbiamo': 'have',
  'hanno': 'have',
  'fai': 'do',
  'fa': 'does',
  'faccio': 'do',
  'facciamo': 'do',
  'fanno': 'do',
  'devi': 'must',
  'deve': 'must',
  'dobbiamo': 'must',
  'devono': 'must',
  'posso': 'can',
  'puoi': 'can',
  'può': 'can',
  'possiamo': 'can',
  'possono': 'can',
  'voglio': 'want',
  'vuoi': 'want',
  'vuole': 'wants',
  'vogliamo': 'want',
  'vogliono': 'want',
  'penso': 'think',
  'pensi': 'think',
  'pensa': 'thinks',
  'pensiamo': 'think',
  'pensano': 'think',
  'vedo': 'see',
  'vedi': 'see',
  'vede': 'sees',
  'vediamo': 'see',
  'vedono': 'see',
  'sentiamo': 'hear',
  'sento': 'hear',
  'senti': 'hear',
  'sente': 'hears',
  'sentono': 'hear',
  'vengo': 'come',
  'vieni': 'come',
  'viene': 'comes',
  'veniamo': 'come',
  'vengono': 'come',
  'esco': 'exit',
  'esci': 'exit',
  'esce': 'exits',
  'usciamo': 'exit',
  'escono': 'exit',
  'giochiamo': 'play',
  'gioco': 'play',
  'giochi': 'play',
  'gioca': 'plays',
  'giocano': 'play',
  'segno': 'signal',
  'segni': 'signal',
  'segna': 'signals',
  'segniamo': 'signal',
  'segnano': 'signal',
  'continuo': 'continue',
  'continui': 'continue',
  'continua': 'continues',
  'continuiamo': 'continue',
  'continuano': 'continue',
  'comincio': 'start',
  'cominci': 'start',
  'comincia': 'starts',
  'cominciamo': 'start',
  'cominciano': 'start',
  'finisco': 'finish',
  'finisci': 'finish',
  'finisce': 'finishes',
  'finiamo': 'finish',
  'finiscono': 'finish',
  'preferisco': 'prefer',
  'preferisci': 'prefer',
  'preferisce': 'prefers',
  'preferiamo': 'prefer',
  'preferiscono': 'prefer',
  'mi': 'me',
  'mi': 'my',
  'ti': 'you',
  'te': 'you',
  'tuo': 'your',
  'sua': 'his/her/their',
  'nostro': 'our',
  'vostro': 'your',
  'loro': 'their',

  // Common phrases
  'buon lavoro': 'good work',
  'ottima prestazione': 'excellent performance',
  'da migliorare': 'needs improvement',
  'da correggere': 'needs correction',
  'ripetuto': 'repeated',
  'inconsistente': 'inconsistent',
  'eccellente': 'excellent',
  'conforme': 'compliant',
};

/**
 * Detect if text is Italian using heuristic word matching
 */
export function isItalianText(text) {
  if (!text || text.length < 3) return false;

  const words = text.toLowerCase().split(/\s+/)
  const italianWordCount = words.filter(w => {
    const cleaned = w.replace(/[^a-z]/g, '')
    return ITALIAN_WORDS.includes(cleaned)
  }).length

  return italianWordCount > 0
}

/**
 * Translate Italian text to English using Beach Volley terminology dictionary
 */
export function translateBeachVolleyText(italianText) {
  if (!italianText || typeof italianText !== 'string') return italianText

  let translation = italianText
  const lowerText = italianText.toLowerCase()

  // Sort by length (longer phrases first) to avoid partial replacements
  const sortedEntries = Object.entries(BEACH_VOLLEY_DICTIONARY).sort(
    (a, b) => b[0].length - a[0].length
  )

  for (const [italian, english] of sortedEntries) {
    const regex = new RegExp(`\\b${italian}\\b`, 'gi')
    translation = translation.replace(regex, english)
  }

  return translation
}

/**
 * Get translation suggestion for Italian text
 * Returns { isItalian, suggestion, confidence }
 */
export function getTranslationSuggestion(text) {
  const isItalian = isItalianText(text)

  if (!isItalian) {
    return { isItalian: false, suggestion: null, confidence: 0 }
  }

  const suggestion = translateBeachVolleyText(text)
  const changed = suggestion !== text

  return {
    isItalian: true,
    suggestion: suggestion,
    confidence: changed ? 0.9 : 0.3,
  }
}
