import { useState, useCallback } from 'react'

/**
 * Custom hook for translating Italian text to English using Claude API
 * Translation happens on blur (end of field) only
 */
export function useClaudeTranslate(initialValue = '') {
  const [value, setValue] = useState(initialValue)
  const [suggestion, setSuggestion] = useState(null)
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleBlur = useCallback(async (text) => {
    if (!text || text.length < 5) {
      setShowSuggestion(false)
      return
    }

    setLoading(true)
    try {
      const apiKey = import.meta.env.VITE_CLAUDE_API_KEY
      if (!apiKey) {
        console.error('Claude API key not configured')
        setShowSuggestion(false)
        return
      }

      // Call Claude API directly
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
        setShowSuggestion(false)
        return
      }

      const data = await response.json()
      const translation = data.content[0]?.text?.trim()

      if (!translation) {
        setShowSuggestion(false)
        return
      }

      // Verify the translation is in English
      const verifyResponse = await fetch('https://api.anthropic.com/v1/messages', {
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
              content: `Is this text in English? Respond with only "yes" or "no".

Text: "${translation}"`,
            },
          ],
        }),
      })

      if (!verifyResponse.ok) {
        console.error('Verification API error:', verifyResponse.statusText)
        setShowSuggestion(false)
        return
      }

      const verifyData = await verifyResponse.json()
      const verificationText = verifyData.content[0]?.text?.trim().toLowerCase()
      const isEnglish = verificationText?.includes('yes')

      if (!isEnglish) {
        console.error('Translation verification failed - result is not in English')
        setShowSuggestion(false)
        return
      }

      if (translation !== text) {
        setSuggestion(translation)
        setShowSuggestion(true)
      } else {
        setShowSuggestion(false)
      }
    } catch (err) {
      console.error('Translation request failed:', err)
      setShowSuggestion(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleBlurEvent = useCallback(
    (e) => {
      handleBlur(e.target.value)
    },
    [handleBlur]
  )

  const acceptSuggestion = useCallback(() => {
    if (suggestion) {
      setValue(suggestion)
      setSuggestion(null)
      setShowSuggestion(false)
    }
  }, [suggestion])

  const rejectSuggestion = useCallback(() => {
    setSuggestion(null)
    setShowSuggestion(false)
  }, [])

  return {
    value,
    setValue,
    handleBlur: handleBlurEvent,
    suggestion,
    showSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    loading,
  }
}
