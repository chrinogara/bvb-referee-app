import { useState, useCallback } from 'react'
import { translateFields, mergeTranslations } from '../lib/translationManager'

/**
 * Hook for managing automatic translation workflow with approval
 * Used by pages like Briefing and RcReport that need bulk field translation
 */
export function useAutoTranslate(contextType = 'general') {
  const [translations, setTranslations] = useState(null)
  const [translating, setTranslating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const requestTranslations = useCallback(
    async (fieldsToTranslate) => {
      setTranslating(true)
      try {
        const result = await translateFields(fieldsToTranslate, contextType)
        setTranslations(result)
        setShowPreview(true)
      } catch (err) {
        console.error('Translation request failed:', err)
      } finally {
        setTranslating(false)
      }
    },
    [contextType]
  )

  const applyTranslations = useCallback((approvals) => {
    if (!translations) return null
    const merged = mergeTranslations(translations.original, translations, approvals)
    setShowPreview(false)
    setTranslations(null)
    return merged
  }, [translations])

  const cancelTranslations = useCallback(() => {
    setShowPreview(false)
    setTranslations(null)
  }, [])

  return {
    translations,
    translating,
    showPreview,
    requestTranslations,
    applyTranslations,
    cancelTranslations,
  }
}
