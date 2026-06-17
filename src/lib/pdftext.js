// Client-side PDF text extraction using pdfjs-dist.
// Used by the Documents page to turn an uploaded PDF (rulebook, casebook,
// guidelines) into plain text stored in Supabase for the rules RAG.
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Extract all text from a PDF File.
 * @param {File} file - the uploaded PDF
 * @param {(page:number,total:number)=>void} [onProgress]
 * @returns {Promise<string>} plain text
 */
export async function extractPdfText(file, onProgress) {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const parts = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    let last = null
    let line = ''
    const lines = []
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = item.transform ? item.transform[5] : null
      if (last != null && y != null && Math.abs(y - last) > 2) {
        lines.push(line.trim())
        line = ''
      }
      line += item.str + (item.hasEOL ? '' : ' ')
      last = y
    }
    if (line.trim()) lines.push(line.trim())
    parts.push(lines.join('\n'))
    if (onProgress) onProgress(p, pdf.numPages)
  }
  return parts.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
