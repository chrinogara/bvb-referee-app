import { documentService, supabase } from './supabase'

const MAX_DOC_CHUNK = 8000

// ─── RAG: pull relevant document snippets ────────────────────────────────────
async function buildRagContext(question) {
  try {
    const { data: docs } = await documentService.getAll()
    if (!docs?.length) return ''

    const terms = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)

    if (!terms.length) {
      return docs
        .map((d) => `[${d.name}]\n${(d.content_text || '').substring(0, MAX_DOC_CHUNK)}`)
        .join('\n\n---\n\n')
    }

    const scored = docs.map((d) => {
      const text = (d.content_text || '').toLowerCase()
      const score = terms.reduce(
        (sum, t) => sum + (text.match(new RegExp(t, 'g'))?.length || 0),
        0
      )
      return { ...d, score }
    })

    const top = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter((d) => d.score > 0 || scored.every((x) => x.score === 0))

    if (!top.length) return ''

    return top
      .map((d) => {
        const text = d.content_text || ''
        const lower = text.toLowerCase()
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

// ─── Claude call via Supabase Edge Function (key stays server-side) ───────────
async function callAnthropic(messages) {
  const { data, error } = await supabase.functions.invoke('rules-assistant', {
    body: { messages },
  })

  if (error) {
    throw new Error(`rules-assistant function error: ${error.message}`)
  }
  if (data?.error) {
    throw new Error(`rules-assistant: ${data.error}`)
  }

  return data
}

// ─── Strip thinking blocks from conversation history ────────────────────────
function stripThinkingBlocks(messages) {
  return messages.map(msg => {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.filter(block => block.type !== 'thinking' && block.type !== 'redacted_thinking')
      }
    }
    return msg
  })
}

// ─── Public API ──────────────────────────────────────────────────────────────
export async function askRulesAssistant(question, conversationHistory = []) {
  const context = await buildRagContext(question)

  const userContent = context
    ? `RELEVANT RULES CONTEXT (from uploaded official documents — use FIRST):\n\n${context}\n\n---\n\nQUESTION: ${question}`
    : `(No relevant document snippets found — you may use the web_search tool on fivb.com / cev.eu only.)\n\nQUESTION: ${question}`

  const messages = [
    ...stripThinkingBlocks(conversationHistory),
    { role: 'user', content: userContent },
  ]

  // The Edge Function already extracts and returns the joined text blocks.
  const response = await callAnthropic(messages)
  return response?.text ?? ''
}

// Streaming kept simple — non-streaming for now (Anthropic streaming via fetch needs SSE handling)
export async function* askRulesAssistantStream(question, conversationHistory = []) {
  const text = await askRulesAssistant(question, conversationHistory)
  yield text
}
