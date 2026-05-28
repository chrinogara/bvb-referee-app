import { useState, useCallback } from 'react'
import { translateTextToEnglish } from '../lib/translate'

/**
 * Custom hook for translating Italian text to English.
 * Translation happens on blur (end of field) only, and goes through the
 * `translate-with-claude` Supabase Edge Function — the API key stays server-side.
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
      const translation = await translateTextToEnglish(text)

      // translateTextToEnglish returns the original text on failure
      if (translation && translation !== text) {
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
