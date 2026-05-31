import { useRef, useState } from 'react'
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'

import { Card, CardBody } from './ui/Card'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { toast } from './ui/Toast'
import { detectFileType } from '../lib/extractText'

/**
 * Upload + management panel for previous tournament reports.
 * Embedded (collapsible) at the top of the Briefing page.
 *
 * Props:
 *  - reports, uploading, totalSuggestions
 *  - onUpload(file, { tournamentName, reportDate })
 *  - onDelete(id), onReanalyze(report)
 */
export function BriefingReportsPanel({
  reports,
  uploading,
  totalSuggestions,
  onUpload,
  onDelete,
  onReanalyze,
}) {
  const fileRef = useRef(null)
  const [open, setOpen] = useState(reports.length === 0)
  const [tournamentName, setTournamentName] = useState('')
  const [reportDate, setReportDate] = useState('')

  async function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (files.length === 0) return

    for (const file of files) {
      if (!detectFileType(file)) {
        toast.error(`${file.name}: only PDF or DOCX files are supported`)
        continue
      }
      try {
        await onUpload(file, {
          tournamentName: tournamentName.trim(),
          reportDate: reportDate || null,
        })
        toast.success(`Analysed "${file.name}"`)
      } catch (err) {
        toast.error(`${file.name}: ${err.message || 'Analysis failed'}`)
      }
    }
    // Reset metadata after a batch
    setTournamentName('')
    setReportDate('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        {/* Header / toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#E85D26]" />
            <span className="text-sm font-semibold text-gray-900">
              Smart Suggestions from Previous Reports
            </span>
            {reports.length > 0 && (
              <Badge variant="navy" size="xs">{reports.length} report{reports.length !== 1 ? 's' : ''}</Badge>
            )}
            {totalSuggestions > 0 && (
              <Badge variant="green" size="xs">{totalSuggestions} tips</Badge>
            )}
          </div>
          {open ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </button>

        {open && (
          <>
            <p className="text-xs text-gray-500">
              Upload previous tournament reports (PDF or DOCX). They are stored
              permanently and analysed by AI to suggest English briefing content
              under each section below.
            </p>

            {/* Upload form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                placeholder="Tournament label (optional, e.g. Gent 3star)"
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#E85D26]/60 focus:ring-2 focus:ring-[#E85D26]/20"
              />
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#E85D26]/60 focus:ring-2 focus:ring-[#E85D26]/20"
              />
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              loading={uploading}
              disabled={uploading}
              className="w-full sm:w-auto"
            >
              <Upload size={14} /> {uploading ? 'Analysing…' : 'Upload report(s)'}
            </Button>

            {/* Report list */}
            {reports.length > 0 && (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {reports.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                    <FileText size={15} className="text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {r.tournament_name || r.file_name}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {r.file_name}
                        {r.report_date ? ` · ${r.report_date}` : ''}
                      </p>
                    </div>

                    {/* Status */}
                    {r.status === 'analyzing' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 shrink-0">
                        <Loader2 size={12} className="animate-spin" /> Analysing
                      </span>
                    ) : r.status === 'analyzed' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 shrink-0">
                        <CheckCircle2 size={12} /> Ready
                      </span>
                    ) : r.status === 'error' ? (
                      <button
                        type="button"
                        onClick={() => handleReanalyze(r)}
                        className="inline-flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 shrink-0"
                        title={r.error_message || 'Analysis failed — retry'}
                      >
                        <RefreshCw size={12} /> Retry
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onDelete(r.id)}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                      title="Delete report"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )

  async function handleReanalyze(report) {
    try {
      await onReanalyze(report)
      toast.success('Re-analysed report')
    } catch (err) {
      toast.error(err.message || 'Analysis failed')
    }
  }
}
