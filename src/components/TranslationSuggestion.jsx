import React from 'react'

/**
 * UI component to display and manage translation suggestions
 * Shows in a compact inline format with Accept/Reject buttons
 */
export function TranslationSuggestion({
  suggestion,
  onAccept,
  onReject,
  isVisible,
}) {
  if (!isVisible || !suggestion) return null

  return (
    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-900">Suggested translation:</p>
        <p className="text-sm text-blue-800 break-words mt-1">{suggestion}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onAccept}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Accept
        </button>
        <button
          onClick={onReject}
          className="px-3 py-1.5 text-xs font-medium bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
