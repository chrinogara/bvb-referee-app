import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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
      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke(
        'translate-with-claude',
        {
          body: { text },
        }
      )

      if (error) {
        console.error('Translation error:', error)
        setShowSuggestion(false)
        return
      }

      if (data?.success && data?.translation && data.translation !== text) {
        setSuggestion(data.translation)
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
