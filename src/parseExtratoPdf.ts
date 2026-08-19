import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import { parseExtratoFromRows, type ExtratoParseResult, type PdfTextRow } from './parseExtratoPdfCore'

export type { ExtratoParseResult, LancamentoExtraido, PdfTextRow } from './parseExtratoPdfCore'
export { parseExtratoFromRows } from './parseExtratoPdfCore'

// Worker do pdf.js para rodar no browser (Vite)
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

type TextItem = { str: string; x: number; y: number; page: number }

/** Converte texto do PDF (fonte custom PUA ≈ Latin-1) para ASCII/Latin-1 legível. */
function decodePdfText(str: string) {
  return [...str]
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0
      if (code >= 0xf000 && code <= 0xf0ff) {
        return String.fromCharCode(code - 0xf000)
      }
      return ch
    })
    .join('')
}

async function extractTextItems(file: File): Promise<TextItem[]> {
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise
  const items: TextItem[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    for (const raw of content.items) {
      if (!('str' in raw) || !raw.str?.trim()) continue
      const str = decodePdfText(raw.str).trim()
      if (!str) continue
      const transform = raw.transform
      items.push({
        str,
        x: transform[4],
        y: Math.round(transform[5]),
        page: pageNum,
      })
    }
  }

  return items
}

function groupRows(items: TextItem[]): PdfTextRow[] {
  const byPage = new Map<number, TextItem[]>()
  for (const item of items) {
    const pageItems = byPage.get(item.page) ?? []
    pageItems.push(item)
    byPage.set(item.page, pageItems)
  }

  const rows: PdfTextRow[] = []
  for (const pageNum of [...byPage.keys()].sort((a, b) => a - b)) {
    rows.push(...groupRowsOnPage(byPage.get(pageNum)!))
  }
  return rows
}

/** Agrupa itens de uma mesma página; Y não é comparável entre páginas do PDF. */
function groupRowsOnPage(items: TextItem[]): PdfTextRow[] {
  const byY = new Map<number, TextItem[]>()
  for (const item of items) {
    let key = item.y
    for (const existing of byY.keys()) {
      if (Math.abs(existing - item.y) <= 2) {
        key = existing
        break
      }
    }
    if (!byY.has(key)) byY.set(key, [])
    byY.get(key)!.push(item)
  }

  return [...byY.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, cells]) => ({
      y,
      cells: cells.sort((a, b) => a.x - b.x),
      text: cells
        .sort((a, b) => a.x - b.x)
        .map((c) => c.str)
        .join(' '),
    }))
}

/**
 * Lê um PDF de Extrato CivilWeb, Posição Financeira ou Relação Valores Pagos
 * e extrai pagamento, valores e encargos/descontos.
 */
export async function parseExtratoFinanceiroPdf(file: File): Promise<ExtratoParseResult> {
  const items = await extractTextItems(file)
  const rows = groupRows(items)
  return parseExtratoFromRows(rows)
}
