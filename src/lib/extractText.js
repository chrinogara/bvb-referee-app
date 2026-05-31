// ════════════════════════════════════════════════════════════════════════════
// Client-side text extraction for uploaded tournament reports.
//
// PDF  → pdfjs-dist
// DOCX → mammoth
//
// The heavy parser libraries are loaded LAZILY (dynamic import) the first time a
// file is actually extracted, so they are code-split out of the main bundle and
// only downloaded when the user uploads a report. This keeps the initial app
// load fast and the main chunk small.
// ════════════════════════════════════════════════════════════════════════════

let _pdfjs = null
let _mammoth = null

async function loadPdfjs() {
  if (_pdfjs) return _pdfjs
  const pdfjsLib = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  _pdfjs = pdfjsLib
  return pdfjsLib
}

async function loadMammoth() {
  if (_mammoth) return _mammoth
  _mammoth = (await import('mammoth')).default
  return _mammoth
}

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
  const pdfjsLib = await loadPdfjs()
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
  const mammoth = await loadMammoth()
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
