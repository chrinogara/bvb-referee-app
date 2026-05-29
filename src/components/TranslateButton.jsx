import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Languages, Loader } from 'lucide-react'
import { translateTextToEnglish } from '../lib/translate'
import { toast } from './ui/Toast'

const LANGUAGES = [
  { id: 'english', label: 'English 🇬🇧' },
  { id: 'french', label: 'Français 🇫🇷' },
  { id: 'dutch', label: 'Nederlands 🇳🇱' },
]

export function TranslateButton({ text, onTranslated }) {
  const [loading, setLoading] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [translation, setTranslation] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('english')

  const handleTranslate = async () => {
    if (!text || text.trim().length < 3) {
      toast.error('Scrivi almeno 3 caratteri per tradurre')
      return
    }

    // Show modal immediately for language selection
    setShowTranslation(true)
    setLoading(true)

    try {
      const result = await translateTextToEnglish(text, selectedLanguage)
      setTranslation(result)
      onTranslated?.(result)
    } catch (err) {
      console.error('Translation failed:', err)
      toast.error('Traduzione non riuscita')
    } finally {
      setLoading(false)
    }
  }

  const handleLanguageChange = async (language) => {
    setSelectedLanguage(language)
    if (translation) {
      setLoading(true)
      try {
        const result = await translateTextToEnglish(text, language)
        setTranslation(result)
      } catch (err) {
        console.error('Translation failed:', err)
        toast.error('Traduzione non riuscita')
      } finally {
        setLoading(false)
      }
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
          onClick={() => setShowTranslation(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm max-h-[90vh] p-3 sm:p-5 animate-in fade-in-0 zoom-in-95 duration-200 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Language Selector */}
            <div className="mb-4 sm:mb-5">
              <label className="text-sm sm:text-base font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                Lingua
              </label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.id}
                    onClick={() => handleLanguageChange(lang.id)}
                    disabled={loading}
                    className={`px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-medium rounded-lg transition-colors whitespace-nowrap flex items-center justify-center gap-1 ${
                      selectedLanguage === lang.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">
              {LANGUAGES.find(l => l.id === selectedLanguage)?.label.split(' ')[0]} Translation
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
                onClick={() => setShowTranslation(false)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Chiudi
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(translation)
                  toast.success('Copiato negli appunti!')
                  setShowTranslation(false)
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Copia
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
