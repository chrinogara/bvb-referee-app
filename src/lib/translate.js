import { supabase } from './supabase'

/**
 * Translate Italian text to English via the Supabase Edge Function.
 *
 * The Anthropic API key lives only on the server (as the ANTHROPIC_API_KEY
 * secret on Supabase), so it is never shipped to the browser. The client just
 * calls the `translate-with-claude` Edge Function.
 *
 * @param {string} text - The text to translate
 * @returns {Promise<string>} - The translated text, or the original if translation fails
 */
export async function translateTextToEnglish(text) {
  if (!text || text.trim().length < 5) return text

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout

    const { data, error } = await supabase.functions.invoke('translate-with-claude', {
      body: { text },
    })

    clearTimeout(timeout)

    if (error) {
      console.error('Translation function error:', error.message)
      return text
    }

    const translation = data?.translation?.trim()
    if (!translation) {
      console.warn('No translation returned from function')
      return text
    }

    console.log(`Translated: "${text.substring(0, 50)}..." → "${translation.substring(0, 50)}..."`)
    return translation
  } catch (err) {
    console.error('Translation request failed:', err.message)
    return text
  }
}

/**
 * Translate evaluation payload fields.
 * @param {Object} payloadToTranslate - The evaluation data to translate
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
 * Test if the translation Edge Function is reachable.
 * @returns {Promise<boolean>} - True if the function responds with a translation
 */
export async function testClaudeAPI() {
  try {
    const { data, error } = await supabase.functions.invoke('translate-with-claude', {
      body: { text: 'Ciao, come stai?' },
    })

    if (error) {
      console.error('Translation function test failed:', error.message)
      return false
    }

    console.log('Translation function test response:', data)
    return Boolean(data?.translation)
  } catch (err) {
    console.error('Translation function test failed:', err)
    return false
  }
}
