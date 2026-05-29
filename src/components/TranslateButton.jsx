import { useState } from 'react'
import { Languages, Loader } from 'lucide-react'
import { translateTextToEnglish } from '../lib/translate'
import { toast } from './ui/Toast'

export function TranslateButton({ text, onTranslated }) {
  const [loading, setLoading] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [translation, setTranslation] = useState('')

  const handleTranslate = async () => {
    if (!text || text.trim().length < 3) {
      toast.error('Scrivi almeno 3 caratteri per tradurre')
      return
    }

    setLoading(true)
    try {
      const result = await translateTextToEnglish(text)
      setTranslation(result)
      setShowTranslation(true)
      onTranslated?.(result)
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

      {/* Translation modal/popover */}
      {showTranslation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 animate-in fade-in-0 zoom-in-95 duration-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              English Translation
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{translation}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowTranslation(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Chiudi
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(translation)
                  toast.success('Copiato negli appunti!')
                  setShowTranslation(false)
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Copia
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
