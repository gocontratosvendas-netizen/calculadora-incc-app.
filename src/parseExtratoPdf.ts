import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'

// Worker do pdf.js para rodar no browser (Vite)
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export type LancamentoExtraido = {
  dataPagamento: string // yyyy-mm-dd
  valorContratual: string // pt-BR
  valorPago: string // pt-BR
  renegociacao: string
  multa: string
  descontos: string
  jurosMora: string
  taxasAdicionais: string
  parcela?: string
}

export type ExtratoParseResult = {
  dataAssinatura: string | null // yyyy-mm-dd
  lancamentos: LancamentoExtraido[]
}

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

function brDateToIso(dateBr: string) {
  const m = dateBr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  return `${yyyy}-${mm}-${dd}`
}

function normalizeMoneyToken(raw: string) {
  return raw.replace(/\s/g, '').replace(/^R\$\s?/i, '')
}

function isMoney(token: string) {
  return /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/.test(normalizeMoneyToken(token))
}

function isDateBr(token: string) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(token)
}

type TextItem = { str: string; x: number; y: number }

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
      })
    }
  }

  return items
}

function groupRows(items: TextItem[]) {
  const byY = new Map<number, TextItem[]>()
  for (const item of items) {
    // Agrupa linhas próximas (quebra de fonte no PDF)
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
 * Ordem monetária no Extrato CivilWeb (após as 2 datas), da esquerda p/ direita:
 * 0 Contratual, 1 Juros Contr., 2 Correção Monetária, 3 Renegociação, 4 Multa,
 * 5 Juros de Mora, 6 Descontos, 7 Taxas Adicionais, 8 Corrigido, 9 Presente, 10 Pago
 */
function parseLancamentoFromTokens(tokens: string[]): LancamentoExtraido | null {
  const dates = tokens.filter(isDateBr)
  const moneys = tokens.filter(isMoney).map(normalizeMoneyToken)
  if (dates.length < 2 || moneys.length < 2) return null

  const dataPagamento = brDateToIso(dates[1])
  if (!dataPagamento) return null

  const parcela = tokens.find((t) => /^\d{3}\/\d{3}-[A-Z]$/i.test(t))
  const zero = '0,00'

  if (moneys.length >= 11) {
    return {
      dataPagamento,
      valorContratual: moneys[0],
      renegociacao: moneys[3] ?? zero,
      multa: moneys[4] ?? zero,
      jurosMora: moneys[5] ?? zero,
      descontos: moneys[6] ?? zero,
      taxasAdicionais: moneys[7] ?? zero,
      valorPago: moneys[10] ?? moneys[moneys.length - 1],
      parcela,
    }
  }

  // Fallback quando a linha veio incompleta no PDF
  return {
    dataPagamento,
    valorContratual: moneys[0],
    renegociacao: zero,
    multa: zero,
    descontos: zero,
    jurosMora: zero,
    taxasAdicionais: zero,
    valorPago: moneys[moneys.length - 1],
    parcela,
  }
}

/**
 * Lê um PDF de "Extrato de Cliente / Extrato Financeiro" (CivilWeb)
 * e extrai pagamento, valores e encargos/descontos.
 */
export async function parseExtratoFinanceiroPdf(file: File): Promise<ExtratoParseResult> {
  const items = await extractTextItems(file)
  const rows = groupRows(items)
  const fullText = rows.map((r) => r.text).join('\n')

  let dataAssinatura: string | null = null
  const assinaturaMatch = fullText.match(/Data Assinatura:\s*(\d{2}\/\d{2}\/\d{4})/i)
  if (assinaturaMatch) {
    dataAssinatura = brDateToIso(assinaturaMatch[1])
  }

  const lancamentos: LancamentoExtraido[] = []
  const seen = new Set<string>()

  for (let i = 0; i < rows.length; i += 1) {
    const current = rows[i]
    // Junta com a linha anterior quando a parcela ficou sozinha acima
    const prev = rows[i - 1]
    const mergedTokens = [
      ...(prev && /^\d{3}\/\d{3}-[A-Z]$/i.test(prev.text.trim())
        ? prev.cells.map((c) => c.str)
        : []),
      ...current.cells.map((c) => c.str),
    ]

    const candidates = [mergedTokens, current.cells.map((c) => c.str)]
    for (const tokens of candidates) {
      const parsed = parseLancamentoFromTokens(tokens)
      if (!parsed) continue
      const key = `${parsed.dataPagamento}|${parsed.valorContratual}|${parsed.valorPago}|${parsed.parcela ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      lancamentos.push(parsed)
      break
    }
  }

  lancamentos.sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento))

  return { dataAssinatura, lancamentos }
}
