import { createContext, useContext, useRef, useState, useCallback } from 'react'
import { DOC_LANGS } from '../lib/i18n-docs'

const LangCtx = createContext(null)
const STORAGE_KEY = 'bvb_doc_lang'

function readLast() {
  try { return localStorage.getItem(STORAGE_KEY) || 'en' } catch { return 'en' }
}

// Provider exposes requestLanguage(): Promise<'en'|'fr'|'nl'|null>.
// Opens a popup; resolves with the chosen language (or null if cancelled).
export function LanguageGateProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [last, setLast] = useState(readLast)
  const resolver = useRef(null)

  const requestLanguage = useCallback(() => {
    setOpen(true)
    return new Promise((resolve) => { resolver.current = resolve })
  }, [])

  function choose(code) {
    try { localStorage.setItem(STORAGE_KEY, code) } catch { /* ignore */ }
    setLast(code)
    setOpen(false)
    const r = resolver.current
    resolver.current = null
    r && r(code)
  }

  function cancel() {
    setOpen(false)
    const r = resolver.current
    resolver.current = null
    r && r(null)
  }

  return (
    <LangCtx.Provider value={{ requestLanguage }}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={cancel}
        >
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-gray-900">
                Lingua del documento
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">In che lingua vuoi generarlo?</p>
            </div>
            <div className="space-y-2">
              {DOC_LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => choose(l.code)}
                  className={
                    'w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition active:scale-[.99] ' +
                    (last === l.code
                      ? 'border-[#E85D26] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300')
                  }
                >
                  <span className="text-2xl leading-none">{l.flag}</span>
                  <span className="font-semibold text-gray-800">{l.label}</span>
                  {last === l.code && (
                    <span className="ml-auto text-[11px] text-[#E85D26] font-bold uppercase">ultima</span>
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={cancel}
              className="w-full py-2.5 text-gray-500 text-sm font-semibold"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </LangCtx.Provider>
  )
}

export function useDocLanguage() {
  const ctx = useContext(LangCtx)
  if (!ctx) throw new Error('useDocLanguage must be used within LanguageGateProvider')
  return ctx
}
