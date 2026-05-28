/**
 * Translate Italian text to English using Claude API
 * @param {string} text - The text to translate
 * @returns {Promise<string>} - The translated text or original if translation fails
 */
export async function translateTextToEnglish(text) {
  if (!text || text.length < 5) return text

  try {
    const apiKey = import.meta.env.VITE_CLAUDE_API_KEY
    if (!apiKey) {
      console.error('Claude API key not configured')
      return text
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are a professional translator for beach volleyball referee reports.

Translate this Italian text to English. Keep the meaning and context intact, especially for beach volleyball terminology.
Respond ONLY with the English translation, nothing else.

Italian text: "${text}"`,
          },
        ],
      }),
    })

    if (!response.ok) {
      console.error('Translation API error:', response.statusText)
      return text
    }

    const data = await response.json()
    const translation = data.content[0]?.text?.trim()
    return translation || text
  } catch (err) {
    console.error('Translation failed:', err)
    return text
  }
}

/**
 * Translate evaluation payload fields
 * @param {Object} payload - The evaluation data to translate
 * @returns {Promise<Object>} - The payload with translated fields
 */
export async function translateEvaluationPayload(payloadToTranslate) {
  const translated = { ...payloadToTranslate }

  const noteFields = [
    'note_positioning',
    'note_signals',
    'note_attitude',
    'note_captain_comm',
    'note_presentation',
  ]

  for (const field of noteFields) {
    if (translated[field]) {
      translated[field] = await translateTextToEnglish(translated[field])
    }
  }

  if (translated.general_notes) {
    translated.general_notes = await translateTextToEnglish(translated.general_notes)
  }

  return translated
}
