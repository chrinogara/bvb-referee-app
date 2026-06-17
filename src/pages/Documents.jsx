import { useState, useEffect, useRef } from 'react'
import { Header } from '../components/layout/Header'
import { Card, CardHeader, CardBody, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { toast } from '../components/ui/Toast'
import { documentService } from '../lib/supabase'
import { extractPdfText } from '../lib/pdftext'
import { formatDate, cn } from '../lib/utils'
import { FileText, UploadCloud, Trash2, BookOpen, Scale, ClipboardList, CheckCircle } from 'lucide-react'

// Canonical document types used by the rules RAG (one current doc per type).
const DOC_TYPES = [
  { value: 'FIVB_RULES',     label: 'Rulebook',   sub: 'FIVB Beach Volleyball Rules', icon: Scale },
  { value: 'FIVB_CASEBOOK',  label: 'Casebook',   sub: 'FIVB Beach Volleyball Casebook', icon: BookOpen },
  { value: 'RC_GUIDELINES',  label: 'Guidelines', sub: 'Beach Referee Guidelines', icon: ClipboardList },
]

const TYPE_LABEL = Object.fromEntries(DOC_TYPES.map((t) => [t.value, t.label]))

export default function Documents() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyType, setBusyType] = useState(null)
  const [progress, setProgress] = useState(null) // { type, page, total }
  const fileInputs = useRef({})

  async function load() {
    setLoading(true)
    try {
      const { data } = await documentService.getAll()
      setDocs(data || [])
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  function docOfType(type) {
    return docs.find((d) => d.doc_type === type) || null
  }

  async function handleFile(type, file) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please choose a PDF file')
      return
    }
    setBusyType(type)
    setProgress({ type, page: 0, total: 0 })
    try {
      const text = await extractPdfText(file, (page, total) => setProgress({ type, page, total }))
      if (!text || text.length < 100) {
        toast.error('Could not read text from this PDF (it may be scanned images).')
        return
      }
      // Replace any existing doc of this type, then insert the new one
      await documentService.deleteByType(type)
      await documentService.create({
        name: file.name.replace(/\.pdf$/i, ''),
        doc_type: type,
        content_text: text,
      })
      toast.success(`${TYPE_LABEL[type]} loaded (${(text.length / 1000).toFixed(0)}k chars)`)
      await load()
    } catch (err) {
      console.error(err)
      toast.error(`Upload failed: ${err.message || err}`)
    } finally {
      setBusyType(null)
      setProgress(null)
      if (fileInputs.current[type]) fileInputs.current[type].value = ''
    }
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Remove "${doc.name}"?`)) return
    try {
      await documentService.delete(doc.id)
      toast.success('Document removed')
      await load()
    } catch (err) {
      toast.error(`Delete failed: ${err.message || err}`)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Header title="Documents" subtitle="Official references for Rules AI & evaluations" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

          <p className="text-sm text-gray-500">
            Upload the three official PDFs. Their text feeds the <b>Rules AI</b> and the
            rule references inside evaluations. Re-upload anytime to update to a newer edition.
          </p>

          {DOC_TYPES.map(({ value, label, sub, icon: Icon }) => {
            const existing = docOfType(value)
            const isBusy = busyType === value
            const prog = progress?.type === value ? progress : null
            return (
              <Card key={value}>
                <CardBody className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      existing ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400')}>
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-bold uppercase tracking-wide text-[#2D3270]">{label}</h3>
                        {existing && <CheckCircle size={15} className="text-emerald-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500">{sub}</p>
                      {existing ? (
                        <p className="text-xs text-gray-600 mt-1 truncate">
                          <b>{existing.name}</b> · {(existing.content_text?.length / 1000 || 0).toFixed(0)}k chars · {formatDate(existing.created_at)}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 mt-1">Not loaded yet</p>
                      )}
                    </div>
                    {existing && (
                      <button onClick={() => handleDelete(existing)} className="text-gray-400 hover:text-red-500 p-1 shrink-0" title="Remove">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {prog ? (
                    <div className="text-xs text-gray-500">
                      Reading PDF… {prog.total ? `page ${prog.page}/${prog.total}` : 'starting'}
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={(el) => (fileInputs.current[value] = el)}
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) => handleFile(value, e.target.files?.[0])}
                      />
                      <Button
                        variant={existing ? 'outline' : 'primary'}
                        size="sm"
                        className="w-full"
                        disabled={isBusy}
                        onClick={() => fileInputs.current[value]?.click()}
                      >
                        <UploadCloud size={15} />
                        {isBusy ? 'Reading…' : existing ? 'Replace PDF' : 'Upload PDF'}
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            )
          })}

          {/* Any other documents already in the store */}
          {!loading && docs.filter((d) => !DOC_TYPES.some((t) => t.value === d.doc_type)).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileText size={14} /> Other documents</CardTitle></CardHeader>
              <CardBody className="space-y-2">
                {docs.filter((d) => !DOC_TYPES.some((t) => t.value === d.doc_type)).map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-gray-700">{d.name} <span className="text-gray-400 text-xs">({d.doc_type})</span></span>
                    <button onClick={() => handleDelete(d)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          <p className="text-xs text-gray-400 text-center leading-relaxed">
            Text is extracted in your browser and stored securely. Scanned/image-only PDFs can’t be read —
            use a text PDF (the official FIVB files are text-based).
          </p>
        </div>
      </div>
    </div>
  )
}
