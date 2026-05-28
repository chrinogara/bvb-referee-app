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
      console.warn('Claude API key not configured - translation skipped')
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
            content: `Translate the following Italian text to English. Keep the meaning and context intact.
Respond ONLY with the translation, without any quotes, explanations, or additional text.

${text}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Translation API error:', response.status, errorText)
      return text
    }

    const data = await response.json()
    let translation = data.content[0]?.text?.trim()

    if (!translation) {
      console.warn('No translation returned from API')
      return text
    }

    // Remove surrounding quotes if present
    if ((translation.startsWith('"') && translation.endsWith('"')) ||
        (translation.startsWith("'") && translation.endsWith("'"))) {
      translation = translation.slice(1, -1)
    }

    console.log(`Translated: "${text.substring(0, 50)}..." → "${translation.substring(0, 50)}..."`)
    return translation
  } catch (err) {
    console.error('Translation request failed:', err.message)
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

  try {
    console.log('Starting translation of evaluation payload...')
    for (const field of noteFields) {
      if (translated[field] && translated[field].length > 0) {
        console.log(`Translating ${field}: "${translated[field].substring(0, 50)}..."`)
        const original = translated[field]
        try {
          translated[field] = await translateTextToEnglish(translated[field])
          console.log(`✅ ${field}: "${translated[field].substring(0, 50)}..."`)
        } catch (err) {
          console.error(`❌ Failed to translate ${field}:`, err)
          // Keep original if translation fails
        }
      }
    }

    if (translated.general_notes && translated.general_notes.length > 0) {
      console.log(`Translating general_notes: "${translated.general_notes.substring(0, 50)}..."`)
      const original = translated.general_notes
      try {
        translated.general_notes = await translateTextToEnglish(translated.general_notes)
        console.log(`✅ general_notes: "${translated.general_notes.substring(0, 50)}..."`)
      } catch (err) {
        console.error('❌ Failed to translate general_notes:', err)
        // Keep original if translation fails
      }
    }

    console.log('✅ Evaluation payload translation complete')
  } catch (err) {
    console.error('❌ Critical error in translateEvaluationPayload:', err)
  }

  return translated
}

/**
 * Test if the Claude API is accessible
 * @returns {Promise<boolean>} - True if API is working
 */
export async function testClaudeAPI() {
  try {
    const apiKey = import.meta.env.VITE_CLAUDE_API_KEY
    if (!apiKey) {
      console.error('API key not found')
      return false
    }

    console.log('Testing Claude API with key:', apiKey.substring(0, 20) + '...')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: 'Translate "Ciao" to English. Respond only with the translation.',
          },
        ],
      }),
    })

    console.log('API Response Status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', errorText)
      return false
    }

    const data = await response.json()
    console.log('API Response:', data)
    return true
  } catch (err) {
    console.error('API Test Failed:', err)
    return false
  }
}
