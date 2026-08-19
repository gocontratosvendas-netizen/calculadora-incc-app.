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

export type PdfTextRow = {
  y: number
  cells: { str: string }[]
  text: string
}

const ZERO = '0,00'
const PAGA_EM_RE = /Paga(?:mento)?\s+em\s+(\d{2}\/\d{2}\/\d{4})/i

function extractMoneys(text: string) {
  const withRs = [
    ...text.matchAll(/R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})/gi),
  ].map((m) => m[1])
  if (withRs.length >= 2) return withRs
  return text
    .split(/\s+/)
    .filter(isMoney)
    .map(normalizeMoneyToken)
}
const NOME_PARCELA_RE =
  /^(Sinal|Intermedi[aá]ria|Conclus[aã]o|Mensal|Entrada|Refor[cç]o|Parcela\s*\d+)/i
const SO_NOME_PARCELA_RE =
  /^(Sinal|Intermedi[aá]ria|Conclus[aã]o|Mensal|Entrada|Refor[cç]o|Parcela\s*\d+)$/i

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

function semAcento(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function parecePosicaoFinanceira(fullText: string) {
  const t = semAcento(fullText).toLowerCase()
  return (
    t.includes('posicao financeira') ||
    (t.includes('paga em') && t.includes('valor original') && t.includes('valor pago'))
  )
}

function chaveLancamento(l: LancamentoExtraido) {
  return `${l.dataPagamento}|${l.valorContratual}|${l.valorPago}|${l.parcela ?? ''}`
}

/**
 * Ordem monetária no Extrato CivilWeb (após as 2 datas), da esquerda p/ direita:
 * 0 Contratual, 1 Juros Contr., 2 Correção Monetária, 3 Renegociação, 4 Multa,
 * 5 Juros de Mora, 6 Descontos, 7 Taxas Adicionais, 8 Corrigido, 9 Presente, 10 Pago
 */
function parseLancamentoCivilWeb(tokens: string[]): LancamentoExtraido | null {
  const dates = tokens.filter(isDateBr)
  const moneys = tokens.filter(isMoney).map(normalizeMoneyToken)
  if (dates.length < 2 || moneys.length < 2) return null

  const dataPagamento = brDateToIso(dates[1])
  if (!dataPagamento) return null

  const parcela = tokens.find((t) => /^\d{3}\/\d{3}-[A-Z]$/i.test(t))

  if (moneys.length >= 11) {
    return {
      dataPagamento,
      valorContratual: moneys[0],
      renegociacao: moneys[3] ?? ZERO,
      multa: moneys[4] ?? ZERO,
      jurosMora: moneys[5] ?? ZERO,
      descontos: moneys[6] ?? ZERO,
      taxasAdicionais: moneys[7] ?? ZERO,
      valorPago: moneys[10] ?? moneys[moneys.length - 1],
      parcela,
    }
  }

  return {
    dataPagamento,
    valorContratual: moneys[0],
    renegociacao: ZERO,
    multa: ZERO,
    descontos: ZERO,
    jurosMora: ZERO,
    taxasAdicionais: ZERO,
    valorPago: moneys[moneys.length - 1],
    parcela,
  }
}

/**
 * Posição Financeira da incorporadora:
 * Parcela | Situação | Paga em DATE | Valor Pago | Valor Original | Correção | Encargos | Desconto
 *
 * A correção do PDF é ignorada: a calculadora reaplica o INCC sobre o valor original.
 */
function parseLancamentoPosicaoFinanceira(text: string): LancamentoExtraido | null {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return null
  if (/^totais\b/i.test(compact)) return null
  if (/posi[cç][aã]o financeira/i.test(compact)) return null
  if (/data do contrato/i.test(compact)) return null
  if (/valor original do contrato/i.test(compact)) return null

  const pagaEm = compact.match(PAGA_EM_RE)
  if (!pagaEm) return null

  const dataPagamento = brDateToIso(pagaEm[1])
  if (!dataPagamento) return null

  const moneys = extractMoneys(compact)
  if (moneys.length < 2) return null

  if (!NOME_PARCELA_RE.test(compact)) return null

  const parcela = compact.match(NOME_PARCELA_RE)?.[0]

  return {
    dataPagamento,
    valorPago: moneys[0],
    valorContratual: moneys[1],
    renegociacao: ZERO,
    multa: ZERO,
    jurosMora: moneys[3] ?? ZERO,
    descontos: moneys[4] ?? ZERO,
    taxasAdicionais: ZERO,
    parcela,
  }
}

function dataAssinaturaCivilWeb(fullText: string) {
  const m = fullText.match(/Data Assinatura:\s*(\d{2}\/\d{2}\/\d{4})/i)
  return m ? brDateToIso(m[1]) : null
}

function dataAssinaturaPosicaoFinanceira(fullText: string) {
  const m = fullText.match(/Data do contrato:\s*(\d{2}\/\d{2}\/\d{4})/i)
  return m ? brDateToIso(m[1]) : null
}

function parseCivilWebFromRows(rows: PdfTextRow[]): ExtratoParseResult {
  const fullText = rows.map((r) => r.text).join('\n')
  const lancamentos: LancamentoExtraido[] = []
  const seen = new Set<string>()

  for (let i = 0; i < rows.length; i += 1) {
    const current = rows[i]
    const prev = rows[i - 1]
    const mergedTokens = [
      ...(prev && /^\d{3}\/\d{3}-[A-Z]$/i.test(prev.text.trim())
        ? prev.cells.map((c) => c.str)
        : []),
      ...current.cells.map((c) => c.str),
    ]

    const candidates = [mergedTokens, current.cells.map((c) => c.str)]
    for (const tokens of candidates) {
      const parsed = parseLancamentoCivilWeb(tokens)
      if (!parsed) continue
      const key = chaveLancamento(parsed)
      if (seen.has(key)) continue
      seen.add(key)
      lancamentos.push(parsed)
      break
    }
  }

  lancamentos.sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento))
  return { dataAssinatura: dataAssinaturaCivilWeb(fullText), lancamentos }
}

function parsePosicaoFinanceiraFromRows(rows: PdfTextRow[]): ExtratoParseResult {
  const fullText = rows.map((r) => r.text).join('\n')
  const lancamentos: LancamentoExtraido[] = []
  const seen = new Set<string>()

  for (let i = 0; i < rows.length; i += 1) {
    const current = rows[i].text
    const prev = rows[i - 1]?.text.trim() ?? ''
    const next = rows[i + 1]?.text ?? ''

    const candidates = [current]
    if (SO_NOME_PARCELA_RE.test(prev)) candidates.push(`${prev} ${current}`)
    if (SO_NOME_PARCELA_RE.test(current.trim()) && PAGA_EM_RE.test(next)) {
      candidates.push(`${current} ${next}`)
    }

    for (const text of candidates) {
      const parsed = parseLancamentoPosicaoFinanceira(text)
      if (!parsed) continue
      const key = chaveLancamento(parsed)
      if (seen.has(key)) continue
      seen.add(key)
      lancamentos.push(parsed)
      break
    }
  }

  lancamentos.sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento))
  return { dataAssinatura: dataAssinaturaPosicaoFinanceira(fullText), lancamentos }
}

/** Interpreta linhas já extraídas do PDF (CivilWeb ou Posição Financeira). */
export function parseExtratoFromRows(rows: PdfTextRow[]): ExtratoParseResult {
  const fullText = rows.map((r) => r.text).join('\n')
  if (parecePosicaoFinanceira(fullText)) {
    return parsePosicaoFinanceiraFromRows(rows)
  }

  const civil = parseCivilWebFromRows(rows)
  if (civil.lancamentos.length) return civil

  return parsePosicaoFinanceiraFromRows(rows)
}
