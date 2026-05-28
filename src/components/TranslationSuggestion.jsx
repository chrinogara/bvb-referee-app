import { Check, X, Loader } from 'lucide-react'
import { Button } from './ui/Button'

export function TranslationSuggestion({
  suggestion,
  onAccept,
  onReject,
  isVisible,
  loading,
}) {
  if (!isVisible) return null

  return (
    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center gap-2 text-blue-600">
              <Loader size={16} className="animate-spin" />
              <span className="text-sm">Translating...</span>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-blue-900 mb-2">
                English translation:
              </p>
              <p className="text-sm text-blue-800 mb-3">{suggestion}</p>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onAccept}
                  disabled={loading}
                >
                  <Check size={14} /> Use this
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReject}
                  disabled={loading}
                >
                  <X size={14} /> Dismiss
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
