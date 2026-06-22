import { documentService } from './supabase'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5'
const MAX_DOC_CHUNK = 8000

const SYSTEM_PROMPT = `You are the official FIVB **Beach Volleyball** Referee Rules Assistant for the Belgian Beach Tour 2026, supporting RC Nogara Christian (CEV Referee Coach).

# SCOPE — STRICT
- You ONLY answer questions about **Beach Volleyball** refereeing, rules, protocols, signals, sanctions, scoresheet, line judging, court inspection, ball inspection, RC guidelines.
- If a question is NOT about Beach Volleyball, politely decline and ask the user to rephrase.

# KNOWLEDGE PRIORITY (mandatory order)
1. **FIRST**: Search the RELEVANT RULES CONTEXT provided in the user message (extracted from the uploaded FIVB / BVB documents). Always cite the source document name when answering.
2. **ONLY IF the answer is not in the documents**: you may search the web, but EXCLUSIVELY on these official domains:
   - fivb.com
   - cev.eu
   No other sources are allowed. If the answer cannot be found there either, say so honestly.

# REFERENCE DOCUMENTS (treat as authoritative)
- 2025 BVB Illustrated Casebook (Feb 2025)
- 2025 BVB RCM Appendix 1 — Refereeing Guidelines and Instructions
- 2025 FIVB BVB Scoresheet Instructions v1
- 2025 FIVB BVB Line Judging Instructions v1
- 2025 BVB RCM Appendix 8 — Mikasa Ball Inspection Manual
- BVB38 Court Inspection Checklist (Jan 2026)

# ANSWERING STYLE
- Use official FIVB English terminology at all times.
- Reference specific rule numbers when applicable (e.g. "Rule 13.1.2", "Chapter 6 Rule 20").
- When the context contains them, give a layered reference: the **Rulebook** rule number, the matching **Casebook** case/interpretation, and the relevant **Referee Guideline** note — so the coach sees rule + interpretation + guidance together.
- Concise and precise — this is used courtside.
- Always cite the source: \`[Document name — page/section]\` or \`[fivb.com]\` / \`[cev.eu]\`.
- For borderline situations, explain the referee's judgment framework ("Call the obvious. When in doubt — do not call.").
- Maintain impartiality and professionalism.`

const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
  allowed_domains: ['fivb.com', 'cev.eu'],
  max_uses: 3,
}

// ─── RAG: pull snippets, ALWAYS spanning the three key documents ─────────────
const PRIORITY_TYPES = ['FIVB_RULES', 'FIVB_CASEBOOK', 'RC_GUIDELINES']
const PER_DOC_CHARS = 3500

function bestChunk(text, terms, size) {
  if (!text) return ''
  if (!terms.length) return text.substring(0, size)
  const lower = text.toLowerCase()
  const positions = []
  for (const t of terms) {
    let i = lower.indexOf(t), guard = 0
    while (i !== -1 && guard < 80) { positions.push(i); i = lower.indexOf(t, i + t.length); guard++ }
  }
  if (!positions.length) return text.substring(0, size)
  positions.sort((a, b) => a - b)
  let bestStart = 0, bestHits = -1
  for (const p of positions) {
    const start = Math.max(0, p - Math.floor(size / 3))
    const end = start + size
    let hits = 0
    for (const q of positions) if (q >= start && q < end) hits++
    if (hits > bestHits) { bestHits = hits; bestStart = start }
  }
  return text.substring(bestStart, bestStart + size)
}

async function buildRagContext(question) {
  try {
    const { data: docs } = await documentService.getAll()
    if (!docs?.length) return ''

    const terms = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)

    const score = (d) => {
      const text = (d.content_text || '').toLowerCase()
      return terms.reduce((s, t) => s + (text.split(t).length - 1), 0)
    }

    // 1) Always include the three priority documents when present
    const chosen = []
    for (const type of PRIORITY_TYPES) {
      const d = docs.find((x) => x.doc_type === type)
      if (d) chosen.push(d)
    }
    // 2) Add up to 2 other strongly-matching documents
    const others = docs
      .filter((d) => !chosen.includes(d))
      .map((d) => ({ d, s: score(d) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 2)
      .map((x) => x.d)

    const all = [...chosen, ...others]
    if (!all.length) return ''

    return all
      .map((d) => `[${d.name}${d.doc_type ? ` · ${d.doc_type}` : ''}]\n${bestChunk(d.content_text || '', terms, PER_DOC_CHARS)}`)
      .join('\n\n---\n\n')
  } catch (err) {
    console.error('RAG error:', err)
    return ''
  }
}

// ─── Anthropic API call via fetch (browser-safe) ─────────────────────────────
async function callAnthropic(messages) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [WEB_SEARCH_TOOL],
      messages,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic API ${response.status}: ${errText}`)
  }

  return response.json()
}

// ─── Public API ──────────────────────────────────────────────────────────────
export async function askRulesAssistant(question, conversationHistory = []) {
  const context = await buildRagContext(question)

  const userContent = context
    ? `RELEVANT RULES CONTEXT (from uploaded official documents — use FIRST):\n\n${context}\n\n---\n\nQUESTION: ${question}`
    : `(No relevant document snippets found — you may use the web_search tool on fivb.com / cev.eu only.)\n\nQUESTION: ${question}`

  const messages = [
    ...conversationHistory,
    { role: 'user', content: userContent },
  ]

  const response = await callAnthropic(messages)

  // Extract text blocks (skip tool_use blocks from web_search)
  const textBlocks = (response.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

  return textBlocks
}

// Streaming kept simple — non-streaming for now (Anthropic streaming via fetch needs SSE handling)
export async function* askRulesAssistantStream(question, conversationHistory = []) {
  const text = await askRulesAssistant(question, conversationHistory)
  yield text
}

// ─── Note translation (evaluation observations → English) ────────────────────
// Translates free-text referee-evaluation notes into clear English. Used by the
// "Translate" button / on-blur auto-translate in the Evaluate page so that the
// PDF and WhatsApp output is always in English even when the coach writes in
// Italian (or any other language).
const TRANSLATE_SYSTEM = `You are a translator for a beach volleyball referee coach.
Translate the user's referee-evaluation note into clear, professional English.
Rules:
- Output ONLY the translated text — no preamble, no quotes, no notes.
- Keep it concise and faithful; preserve refereeing terminology.
- If the text is already in English, return it unchanged.
- Keep proper names, scores and abbreviations (R1, R2, BMP, etc.) as they are.`

export async function translateToEnglish(text) {
  const trimmed = (text || '').trim()
  if (!trimmed) return ''
  if (!API_KEY) throw new Error('Translation unavailable: missing API key')

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: TRANSLATE_SYSTEM,
      messages: [{ role: 'user', content: trimmed }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Translation failed (${response.status}): ${errText}`)
  }

  const data = await response.json()
  const out = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
  return out || trimmed
}

// Best-effort translation to English: returns the original text on any failure
// (missing API key, offline, API error) so PDF generation never breaks.
export async function translateToEnglishSafe(text) {
  const trimmed = (text || '').trim()
  if (!trimmed) return text
  if (!API_KEY) return text
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return text
  try {
    const en = await translateToEnglish(trimmed)
    return (en && en.trim()) || text
  } catch {
    return text
  }
}

// Translate selected string fields of an object to English (best-effort, in
// parallel). Returns a shallow copy; empty / non-string fields are left as-is.
// Used right before generating report PDFs so any leftover Italian becomes
// English regardless of how the data was entered or saved.
export async function translateFieldsToEnglish(obj, keys) {
  if (!obj) return obj
  const out = { ...obj }
  await Promise.all(
    keys.map(async (k) => {
      const v = obj[k]
      if (typeof v === 'string' && v.trim()) out[k] = await translateToEnglishSafe(v)
    })
  )
  return out
}

// ─── Rule reference lookup (for evaluation notes) ────────────────────────────
// Given a short evaluation observation, returns a concise rule reference drawn
// from the loaded Rulebook + Casebook + Guidelines (no web, documents only).
const RULE_REF_SYSTEM = `You are a FIVB Beach Volleyball rules referencing tool for a referee coach.
Given a short evaluation observation about a referee, identify the precise applicable rule(s).
Use ONLY the provided DOCUMENT CONTEXT (Rulebook, Casebook, Guidelines). Never invent rule numbers.
Reply in English, very concise, in this exact format (omit a line if nothing relevant is found):
Rule: <number> — <short title>
Casebook: <case ref / short note>
Guideline: <short note>
If nothing relevant is found in the documents, reply exactly: No matching rule found in the loaded documents.`

export async function lookupRuleReference(observation) {
  const obs = (observation || '').trim()
  if (!obs) return ''
  if (!API_KEY) throw new Error('Rule lookup unavailable: missing API key')

  const context = await buildRagContext(obs)
  const userContent = context
    ? `DOCUMENT CONTEXT:\n\n${context}\n\n---\n\nOBSERVATION: ${obs}`
    : `(No reference documents are loaded.)\n\nOBSERVATION: ${obs}`

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: RULE_REF_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    }),
  })
  if (!response.ok) throw new Error(`Rule lookup failed (${response.status})`)
  const data = await response.json()
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
}
