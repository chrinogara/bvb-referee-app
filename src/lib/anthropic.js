import Anthropic from '@anthropic-ai/sdk'
import { documentService } from './supabase'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const MODEL = 'claude-haiku-4-5'
const MAX_DOC_CHUNK = 8000  // chars per document snippet in context

const SYSTEM_PROMPT = `You are the official FIVB **Beach Volleyball** Referee Rules Assistant for the Belgian Beach Tour 2026, supporting Referee Coach Christian Nogara (Volley Vlaanderen / FWBV).

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
- Concise and precise — this is used courtside.
- Always cite the source: \`[Document name — page/section]\` or \`[fivb.com]\` / \`[cev.eu]\`.
- For borderline situations, explain the referee's judgment framework ("Call the obvious. When in doubt — do not call.").
- Maintain impartiality and professionalism.`

// ─── Web search tool (FIVB + CEV only) ──────────────────────────────────────
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
  allowed_domains: ['fivb.com', 'cev.eu'],
  max_uses: 3,
}

// ─── RAG: pull relevant document snippets ────────────────────────────────────
async function buildRagContext(question) {
  try {
    // Fetch all documents — small corpus, simple in-memory keyword scoring
    const { data: docs } = await documentService.getAll()
    if (!docs?.length) return ''

    // Extract meaningful search terms
    const terms = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)

    if (!terms.length) {
      // No useful terms — return first chunks of every doc
      return docs
        .map((d) => `[${d.name}]\n${(d.content_text || '').substring(0, MAX_DOC_CHUNK)}`)
        .join('\n\n---\n\n')
    }

    // Score each document by keyword frequency
    const scored = docs.map((d) => {
      const text = (d.content_text || '').toLowerCase()
      const score = terms.reduce(
        (sum, t) => sum + (text.match(new RegExp(t, 'g'))?.length || 0),
        0
      )
      return { ...d, score }
    })

    // Take top-scoring docs (or all if low scores)
    const top = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter((d) => d.score > 0 || scored.every((x) => x.score === 0))

    if (!top.length) return ''

    // For each top doc, extract the most relevant chunk around the first match
    return top
      .map((d) => {
        const text = d.content_text || ''
        const lower = text.toLowerCase()
        // Find first occurrence of any term
        let bestIdx = -1
        for (const t of terms) {
          const idx = lower.indexOf(t)
          if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx
        }
        const start = bestIdx === -1 ? 0 : Math.max(0, bestIdx - 500)
        const chunk = text.substring(start, start + MAX_DOC_CHUNK)
        return `[${d.name}]\n${chunk}`
      })
      .join('\n\n---\n\n')
  } catch (err) {
    console.error('RAG error:', err)
    return ''
  }
}

// ─── Non-streaming version ────────────────────────────────────────────────────
export async function askRulesAssistant(question, conversationHistory = []) {
  const context = await buildRagContext(question)

  const userContent = context
    ? `RELEVANT RULES CONTEXT (from uploaded official documents — use FIRST):\n\n${context}\n\n---\n\nQUESTION: ${question}`
    : `(No relevant document snippets found — you may use the web_search tool on fivb.com / cev.eu only.)\n\nQUESTION: ${question}`

  const messages = [
    ...conversationHistory,
    { role: 'user', content: userContent },
  ]

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [WEB_SEARCH_TOOL],
    messages,
  })

  // Extract text blocks (web_search tool_use blocks are skipped automatically)
  const textBlocks = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

  return textBlocks
}

// ─── Streaming version (kept for compatibility) ──────────────────────────────
export async function* askRulesAssistantStream(question, conversationHistory = []) {
  const context = await buildRagContext(question)

  const userContent = context
    ? `RELEVANT RULES CONTEXT (from uploaded official documents — use FIRST):\n\n${context}\n\n---\n\nQUESTION: ${question}`
    : `(No relevant document snippets found — you may use the web_search tool on fivb.com / cev.eu only.)\n\nQUESTION: ${question}`

  const messages = [
    ...conversationHistory,
    { role: 'user', content: userContent },
  ]

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [WEB_SEARCH_TOOL],
    messages,
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      yield chunk.delta.text
    }
  }
}
