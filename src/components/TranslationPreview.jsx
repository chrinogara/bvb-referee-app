import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader, Check, AlertCircle } from 'lucide-react'
import { toast } from './ui/Toast'

/**
 * TranslationPreview: Side-by-side view of original Italian text and English translation
 * Allows user to approve/reject translations before saving
 */
export function TranslationPreview({ translations, isLoading, onApprove, onReject }) {
  const [approvals, setApprovals] = useState({})
  const [allApproved, setAllApproved] = useState(false)

  useEffect(() => {
    if (!translations) return
    const newApprovals = {}
    const fields = Object.keys(translations.original)
    fields.forEach((key) => {
      newApprovals[key] = false
    })
    setApprovals(newApprovals)
    setAllApproved(false)
  }, [translations])

  const toggleApproval = (key) => {
    const updated = { ...approvals, [key]: !approvals[key] }
    setApprovals(updated)
    setAllApproved(Object.values(updated).some((v) => v))
  }

  const handleApprove = () => {
    const approved = Object.keys(approvals).filter((k) => approvals[k])
    if (approved.length === 0) {
      toast.warning('Select at least one translation to apply')
      return
    }
    onApprove(approvals)
  }

  const handleReject = () => {
    onReject()
  }

  if (!translations) return null

  const fields = Object.keys(translations.original)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/30 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] p-4 sm:p-6 animate-in fade-in-0 zoom-in-95 duration-200 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-bold text-gray-900">
            Review English Translations
          </h3>
          <button
            onClick={handleReject}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info message */}
        <p className="text-xs sm:text-sm text-gray-600 mb-4">
          Check the translations you want to apply. Unchecked fields will keep their original Italian text.
        </p>

        {/* Fields */}
        <div className="space-y-4 mb-6">
          {fields.map((key) => {
            const original = translations.original[key]
            const english = translations.english[key]
            const status = translations.status[key]
            const approved = approvals[key]
            const isTranslated = original !== english && status === 'translated'

            return (
              <div
                key={key}
                className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={approved}
                    onChange={() => toggleApproval(key)}
                    disabled={!isTranslated || isLoading}
                    className="mt-1 rounded border-gray-300 text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  />

                  <div className="flex-1 min-w-0">
                    {/* Field label and status */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        {key.replace(/_/g, ' ')}
                      </span>
                      {isLoading ? (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <Loader size={12} className="animate-spin" /> Translating…
                        </span>
                      ) : status === 'translated' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <Check size={12} /> Translated
                        </span>
                      ) : status === 'failed' || status === 'error' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <AlertCircle size={12} /> No change
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">Too short to translate</span>
                      )}
                    </div>

                    {/* Original text */}
                    <div className="mb-2">
                      <p className="text-xs text-gray-600 font-medium mb-1">Original (Italian)</p>
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-gray-800 leading-relaxed max-h-24 overflow-y-auto">
                        {original || '(empty)'}
                      </div>
                    </div>

                    {/* English translation */}
                    {isTranslated && (
                      <div>
                        <p className="text-xs text-gray-600 font-medium mb-1">English Translation</p>
                        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-gray-800 leading-relaxed max-h-24 overflow-y-auto">
                          {english || '(empty)'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleReject}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={!allApproved || isLoading}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply Selected Translations
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
