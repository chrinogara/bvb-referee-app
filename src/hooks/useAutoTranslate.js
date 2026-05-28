import { useState, useCallback, useEffect, useRef } from 'react'
import { getTranslationSuggestion } from '../lib/beachVolleyTranslator'

/**
 * Custom hook for auto-translation of Italian text to English
 * Detects Italian input and suggests Beach Volley terminology translations
 */
export function useAutoTranslate(initialValue = '') {
  const [value, setValue] = useState(initialValue)
  const [suggestion, setSuggestion] = useState(null)
  const [showSuggestion, setShowSuggestion] = useState(false)
  const debounceTimerRef = useRef(null)

  // Sync internal state when parent value changes
  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const checkTranslation = useCallback((text) => {
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

  const handleBlur = useCallback((e) => {
    const text = e.target.value
    checkTranslation(text)
  }, [checkTranslation])

  const handleChange = useCallback((text) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      checkTranslation(text)
    }, 500)
  }, [checkTranslation])

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
    handleChange,
    suggestion,
    showSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    clearSuggestion,
  }
}
