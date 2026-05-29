import { supabase } from './supabase'

/**
 * Translate Italian text to specified language via the Supabase Edge Function.
 *
 * The Anthropic API key lives only on the server (as the ANTHROPIC_API_KEY
 * secret on Supabase), so it is never shipped to the browser. The client just
 * calls the `translate-with-claude` Edge Function.
 *
 * @param {string} text - The text to translate
 * @param {string} targetLanguage - Target language: 'english', 'french', or 'dutch' (default: 'english')
 * @returns {Promise<string>} - The translated text, or the original if translation fails
 */
export async function translateTextToEnglish(text, targetLanguage = 'english') {
  if (!text || text.trim().length < 5) return text

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout

    const { data, error } = await supabase.functions.invoke('translate-with-claude', {
      body: { text, targetLanguage },
      signal: controller.signal,
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
