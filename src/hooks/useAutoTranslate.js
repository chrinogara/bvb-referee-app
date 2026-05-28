import { useState, useCallback } from 'react'
import { getTranslationSuggestion } from '../lib/beachVolleyTranslator'

/**
 * Custom hook for auto-translation of Italian text to English
 * Detects Italian input and suggests Beach Volley terminology translations
 */
export function useAutoTranslate(initialValue = '') {
  const [value, setValue] = useState(initialValue)
  const [suggestion, setSuggestion] = useState(null)
  const [showSuggestion, setShowSuggestion] = useState(false)

  const handleBlur = useCallback((e) => {
    const text = e.target.value
    if (!text || text.length < 3) {
      setShowSuggestion(false)
      return
    }

    const { isItalian, suggestion: suggested } = getTranslationSuggestion(text)

    if (isItalian && suggested && suggested !== text) {
      setSuggestion(suggested)
      setShowSuggestion(true)
    } else {
      setShowSuggestion(false)
    }
  }, [])

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

  const clearSuggestion = useCallback(() => {
    setSuggestion(null)
    setShowSuggestion(false)
  }, [])

  return {
    value,
    setValue,
    handleBlur,
    suggestion,
    showSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    clearSuggestion,
  }
}
