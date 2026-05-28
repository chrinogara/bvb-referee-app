/**
 * Beach Volleyball terminology dictionary and Italian→English translator
 * Detects Italian text and proposes official Beach Volley terminology translations
 */

const ITALIAN_WORDS = [
  'il', 'la', 'i', 'le', 'di', 'da', 'che', 'e', 'o', 'per', 'con', 'su', 'in', 'è',
  'arbitro', 'arbitri', 'giudice', 'giudici', 'linea', 'linee',
  'posizionamento', 'segnale', 'segnali', 'atteggiamento', 'comunicazione', 'presentazione',
  'buono', 'ottimo', 'eccellente', 'scarso', 'pessimo', 'adeguato', 'insufficiente',
  'nota', 'note', 'osservazione', 'osservazioni', 'commento', 'commenti',
  'campo', 'campi', 'torneo', 'tornei', 'gara',
  'giornata', 'giorno', 'giornate', 'giorni', 'sessione', 'sessioni',
  'pausa', 'riposo', 'lavoro', 'turno', 'turni',
  'finale', 'finali', 'semifinale', 'semifinali', 'qualificazione', 'qualificazioni',
  'squadra', 'squadre', 'giocatore', 'giocatori', 'giocatrice', 'giocatrici',
  'allenatore', 'allenatori', 'allenamento', 'allenamenti',
  'regola', 'regole', 'regolamento', 'regolamenti', 'fallo', 'falli', 'infrazioni',
  'punto', 'punti', 'punteggio', 'punteggi', 'partita', 'partite',
  'attacco', 'attacchi', 'difesa', 'difese', 'blocco', 'blocchi', 'ricezione', 'ricezioni',
  'palleggio', 'palleggi', 'schiacciata', 'schiacciate', 'muro', 'muri',
  'assegnazione', 'assegnazioni', 'designazione', 'designazioni', 'ruolo', 'ruoli',
  'r1', 'r2', 'lj1', 'lj2',
  'valutazione', 'valutazioni',
  'briefing', 'riunione', 'riunioni', 'convocazione', 'convocazioni',
  'rapporto', 'rapporti', 'relazione', 'relazioni',
  'penalità', 'multa', 'multe',
  // Common verbs
  'chiede', 'chiedere', 'chiedo', 'lasciare', 'lascia', 'lascio', 'sono', 'hai', 'ha', 'abbiamo', 'hanno',
  'fai', 'fa', 'faccio', 'facciamo', 'fanno', 'devi', 'deve', 'dobbiamo', 'devono',
  'posso', 'puoi', 'può', 'possiamo', 'possono', 'voglio', 'vuoi', 'vuole', 'vogliamo', 'vogliono',
  'penso', 'pensi', 'pensa', 'pensiamo', 'pensano', 'vedo', 'vedi', 'vede', 'vediamo', 'vedono',
  'sentiamo', 'sento', 'senti', 'sente', 'sentono', 'vengo', 'vieni', 'viene', 'veniamo', 'vengono',
  'esco', 'esci', 'esce', 'usciamo', 'escono', 'giochiamo', 'gioco', 'giochi', 'gioca', 'giocano',
  'segno', 'segni', 'segna', 'segniamo', 'segnano', 'continuo', 'continui', 'continua', 'continuiamo', 'continuano',
  'comincio', 'cominci', 'comincia', 'cominciamo', 'cominciano', 'finisco', 'finisci', 'finisce', 'finiamo', 'finiscono',
  'preferisco', 'preferisci', 'preferisce', 'preferiamo', 'preferiscono',
  // Pronouns
  'mi', 'ti', 'te', 'tuo', 'sua', 'nostro', 'vostro', 'loro',
  // Adjectives and adverbs
  'molto', 'poco', 'bravo', 'brave', 'male', 'bello', 'bella', 'buona', 'cattivo', 'cattiva',
  'grande', 'piccolo', 'piccola', 'nuovo', 'nuova', 'vecchio', 'vecchia', 'facile', 'difficile',
  'veloce', 'lento', 'velocemente', 'lentamente', 'sbagliato', 'sbagliata', 'giusto', 'giusta',
  'corretto', 'corretta', 'errato', 'errata', 'non',
  // Articles and prepositions
  'un', 'una', 'del', 'della', 'dei', 'delle', 'dal', 'dalla', 'nel', 'nella', 'sul',
  'sulle', 'col', 'dalla',
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

  // Articles and prepositions
  'il': 'the',
  'la': 'the',
  'i': 'the',
  'le': 'the',
  'lo': 'the',
  'gli': 'the',
  'un': 'a',
  'una': 'a',
  'dei': 'of the',
  'della': 'of the',
  'del': 'of the',
  'delle': 'of the',
  'dei': 'of the',
  'di': 'of',
  'da': 'from',
  'in': 'in',
  'su': 'on',
  'per': 'for',
  'con': 'with',
  'col': 'with the',
  'dalla': 'from the',
  'dal': 'from the',
  'nella': 'in the',
  'nel': 'in the',
  'sulle': 'on the',
  'sul': 'on the',

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

  // Pronouns and possessives
  'mi': 'me',
  'ti': 'you',
  'te': 'you',
  'tuo': 'your',
  'sua': 'his/her/their',
  'nostro': 'our',
  'vostro': 'your',
  'loro': 'their',

  // Common adjectives and adverbs
  'molto': 'very',
  'poco': 'little',
  'bravo': 'good',
  'brave': 'good',
  'male': 'bad',
  'bello': 'nice',
  'bella': 'nice',
  'buono': 'good',
  'buona': 'good',
  'cattivo': 'bad',
  'cattiva': 'bad',
  'grande': 'big',
  'piccolo': 'small',
  'piccola': 'small',
  'nuovo': 'new',
  'nuova': 'new',
  'vecchio': 'old',
  'vecchia': 'old',
  'facile': 'easy',
  'difficile': 'difficult',
  'veloce': 'fast',
  'lento': 'slow',
  'velocemente': 'quickly',
  'lentamente': 'slowly',
  'sbagliato': 'wrong',
  'sbagliata': 'wrong',
  'giusto': 'right',
  'giusta': 'right',
  'corretto': 'correct',
  'corretta': 'correct',
  'errato': 'wrong',
  'errata': 'wrong',

  // Common connectors & particles
  'che': 'that',
  'e': 'and',
  'o': 'or',
  'non': 'not',

  // Time/work related
  'giorno': 'day',
  'giorni': 'days',
  'lavoro': 'work',

  // Lowercase role identifiers
  'r1': 'R1',
  'r2': 'R2',
  'lj1': 'LJ1',
  'lj2': 'LJ2',

  // Plural forms
  'multiple': 'multiple',
  'ottimo': 'excellent',
  'multe': 'fines',

  // Additional verbs and words
  'dato': 'given',
  'situazione': 'situation',
  'passaggio': 'passing',
  'dito': 'finger',
  'mano': 'hand',

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

  // Sort by length (longer phrases first) to avoid partial replacements
  const sortedEntries = Object.entries(BEACH_VOLLEY_DICTIONARY).sort(
    (a, b) => b[0].length - a[0].length
  )

  for (const [italian, english] of sortedEntries) {
    // Escape special regex characters in the dictionary key
    const escaped = italian.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Use word boundaries with lookahead/lookbehind for better matching
    const regex = new RegExp(`(?<!\\w)${escaped}(?!\\w)`, 'gi')
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
