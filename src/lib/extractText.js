// ════════════════════════════════════════════════════════════════════════════
// Client-side text extraction for uploaded tournament reports.
//
// PDF  → pdfjs-dist
// DOCX → mammoth
//
// Extraction runs in the browser so the Edge Function only ever receives plain
// text (keeps the Deno runtime light and avoids shipping binary parsers there).
// ════════════════════════════════════════════════════════════════════════════

import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/**
 * Detect the file type from name / MIME.
 * @returns {'pdf' | 'docx' | null}
 */
export function detectFileType(file) {
  const name = (file?.name || '').toLowerCase()
  const type = (file?.type || '').toLowerCase()
  if (name.endsWith('.pdf') || type === 'application/pdf') return 'pdf'
  if (
    name.endsWith('.docx') ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx'
  }
  return null
}

/** Extract text from a PDF File/Blob. */
async function extractPdf(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item) => item.str ?? '').join(' ')
    pages.push(pageText)
  }
  return pages.join('\n\n').replace(/[ \t]+/g, ' ').trim()
}

/** Extract text from a DOCX File/Blob. */
async function extractDocx(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return (result?.value || '').replace(/[ \t]+/g, ' ').trim()
}

/**
 * Extract plain text from a PDF or DOCX file.
 * @param {File} file
 * @returns {Promise<{ type: 'pdf'|'docx', text: string }>}
 * @throws {Error} if the format is unsupported or extraction fails
 */
export async function extractTextFromFile(file) {
  const type = detectFileType(file)
  if (!type) {
    throw new Error('Unsupported file type. Please upload a PDF or DOCX file.')
  }

  const text = type === 'pdf' ? await extractPdf(file) : await extractDocx(file)

  if (!text || text.trim().length < 20) {
    throw new Error(
      'Could not extract readable text from this file. It may be scanned/image-only.'
    )
  }

  return { type, text }
}
