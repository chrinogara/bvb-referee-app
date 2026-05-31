import { useState } from 'react'
import { Plus, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * Clickable suggestion chips shown under a briefing section textarea.
 * Clicking a chip inserts (appends) its text into the field; the field stays
 * fully editable afterwards.
 *
 * Props:
 *  - suggestions: [{ text, source, reportId }]
 *  - onInsert(text)
 */
export function SuggestionChips({ suggestions, onInsert }) {
  const [expanded, setExpanded] = useState(false)

  if (!suggestions || suggestions.length === 0) return null

  const visible = expanded ? suggestions : suggestions.slice(0, 3)
  const hasMore = suggestions.length > 3

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Lightbulb size={12} className="text-amber-500" />
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          Suggestions from previous reports
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {visible.map((s, i) => (
          <button
            key={`${s.reportId}-${i}`}
            type="button"
            onClick={() => onInsert(s.text)}
            className="group flex items-start gap-2 text-left w-full rounded-lg border border-gray-200 bg-gray-50 hover:bg-amber-50 hover:border-amber-300 px-2.5 py-2 transition-colors"
            title={s.source ? `From: ${s.source}` : 'Insert suggestion'}
          >
            <Plus
              size={13}
              className="text-gray-400 group-hover:text-amber-600 mt-0.5 shrink-0 transition-colors"
            />
            <span className="flex-1 min-w-0">
              <span className="block text-xs text-gray-800 leading-snug">{s.text}</span>
              {s.source && (
                <span className="block text-[10px] text-gray-400 mt-0.5 truncate">
                  {s.source}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp size={12} /> Show fewer
            </>
          ) : (
            <>
              <ChevronDown size={12} /> Show {suggestions.length - 3} more
            </>
          )}
        </button>
      )}
    </div>
  )
}
