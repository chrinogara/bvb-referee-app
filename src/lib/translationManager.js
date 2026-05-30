import { supabase } from './supabase'
import { translateTextToEnglish } from './translate'

/**
 * Centralized translation manager for automatic English translations across the app.
 * Handles multi-field translation with context awareness and approval workflows.
 */

/**
 * Translate multiple fields from Italian to English
 * @param {Object} fields - Key-value pairs of fields to translate
 * @param {string} contextType - Context for terminology: 'briefing', 'rc_report', 'evaluation'
 * @returns {Promise<Object>} - Translated fields with format { original: {...}, english: {...}, status: {...} }
 */
export async function translateFields(fields, contextType = 'general') {
  const translations = {
    original: {},
    english: {},
    status: {},
  }

  for (const [key, text] of Object.entries(fields)) {
    translations.original[key] = text

    if (!text || text.trim().length < 3) {
      translations.english[key] = text
      translations.status[key] = 'skipped'
      continue
    }

    try {
      const translated = await translateTextToEnglish(text, 'english', contextType)
      translations.english[key] = translated
      translations.status[key] = translated !== text ? 'translated' : 'failed'
    } catch (err) {
      console.error(`Translation failed for ${key}:`, err)
      translations.english[key] = text
      translations.status[key] = 'error'
    }
  }

  return translations
}

/**
 * Save approved translations to database
 * This creates a record of which fields were approved and when
 * @param {string} documentId - ID of the document (evaluation_id, tournament_id, etc.)
 * @param {string} documentType - Type: 'evaluation', 'briefing', 'rc_report'
 * @param {Object} approvedFields - Fields that were approved for translation
 * @returns {Promise<Object>} - Translation record metadata
 */
export async function saveTranslationApproval(documentId, documentType, approvedFields) {
  const metadata = {
    document_id: documentId,
    document_type: documentType,
    translated_fields: Object.keys(approvedFields),
    approved_at: new Date().toISOString(),
  }

  // For now, we just return metadata for logging
  // In Phase 2, this would save to a translations table
  return metadata
}

/**
 * Merge translations into data object
 * Choose between keeping original or replacing with English based on approval
 * @param {Object} original - Original data object
 * @param {Object} translations - Translation object from translateFields()
 * @param {Object} approvals - Which fields were approved for replacement { key: boolean }
 * @returns {Object} - Merged data with approved translations
 */
export function mergeTranslations(original, translations, approvals) {
  const merged = { ...original }

  for (const [key, approved] of Object.entries(approvals)) {
    if (approved && translations.english[key]) {
      merged[key] = translations.english[key]
    }
  }

  return merged
}
