import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Languages, Loader } from 'lucide-react'
import { translateTextToEnglish } from '../lib/translate'
import { toast } from './ui/Toast'

export function TranslateButton({ text, onTranslated }) {
  const [loading, setLoading] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [translation, setTranslation] = useState('')

  const handleClose = () => {
    setShowTranslation(false)
    setTranslation('')
  }

  const handleTranslate = async () => {
    if (!text || text.trim().length < 3) {
      toast.error('Scrivi almeno 3 caratteri per tradurre')
      return
    }

    setShowTranslation(true)
    setLoading(true)

    try {
      const result = await translateTextToEnglish(text, 'english')
      setTranslation(result)
    } catch (err) {
      console.error('Translation failed:', err)
      toast.error('Traduzione non riuscita')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Translate button */}
      <button
        type="button"
        onClick={handleTranslate}
        disabled={loading || !text?.trim()}
        title="Traduci in inglese"
        className="inline-flex items-center justify-center p-2 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Traduci in inglese"
      >
        {loading ? (
          <Loader size={16} className="animate-spin" />
        ) : (
          <Languages size={16} />
        )}
      </button>

      {/* Translation modal/popover - rendered via Portal to bypass relative positioning */}
      {showTranslation && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/30 backdrop-blur-sm overflow-y-auto"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm max-h-[90vh] p-3 sm:p-5 animate-in fade-in-0 zoom-in-95 duration-200 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title */}
            <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">
              English Translation
            </h3>

            {/* Translation Text with scroll */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 sm:p-4 mb-3 sm:mb-4 max-h-32 sm:max-h-40 overflow-y-auto">
              {loading ? (
                <p className="text-xs sm:text-sm text-gray-500 italic">Caricamento traduzione...</p>
              ) : (
                <p className="text-xs sm:text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{translation}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleClose}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Chiudi
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(translation)
                  toast.success('Copiato negli appunti!')
                  handleClose()
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Copia
              </button>
              <button
                onClick={() => {
                  onTranslated?.(translation)
                  toast.success('Testo sostituito!')
                  handleClose()
                }}
                disabled={loading || !translation}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sostituisci
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
