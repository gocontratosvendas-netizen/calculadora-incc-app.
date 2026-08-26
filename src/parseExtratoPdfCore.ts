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

/** Aceita valores com 1 ou 2 casas decimais (ex.: 8,3 e 590,6 no Boulevard). */
function isFlexibleMoney(token: string) {
  const t = normalizeMoneyToken(token)
  return /^-?\d{1,3}(?:\.\d{3})*,\d{1,2}$/.test(t)
}

function normalizeFlexibleMoney(token: string): string | null {
  const t = normalizeMoneyToken(token)
  if (!isFlexibleMoney(t)) return null
  const m = t.match(/^(-?\d{1,3}(?:\.\d{3})*,)(\d{1,2})$/)
  if (!m) return null
  const [, prefix, dec] = m
  return `${prefix}${dec.padEnd(2, '0')}`
}

function parseMoneyBr(token: string) {
  const n = normalizeFlexibleMoney(token)
  if (!n) return 0
  return Number.parseFloat(n.replace(/\./g, '').replace(',', '.'))
}

function formatMoneyBr(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function somarMoedaBr(...tokens: string[]) {
  const total = tokens.reduce((acc, t) => acc + parseMoneyBr(t), 0)
  return formatMoneyBr(total)
}

function isDateBr(token: string) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(token)
}

function semAcento(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Portal do Cliente Benx (e similares):
 * Valores pagos → Vencimento | Pagamento | Valor | Encargos | Descontos | Total
 * Diferente da Posição Financeira com "Paga em" / Valor Original.
 */
function parecePosicaoFinanceiraBenx(fullText: string) {
  const t = semAcento(fullText).toLowerCase()
  const temCabecalhoBenx =
    t.includes('valores pagos') &&
    t.includes('vencimento') &&
    t.includes('pagamento') &&
    t.includes('encargos') &&
    t.includes('descontos')
  const ehLayoutComPagaEm =
    t.includes('paga em') || (t.includes('valor original') && t.includes('valor pago'))
  return temCabecalhoBenx && !ehLayoutComPagaEm
}

function parecePosicaoFinanceiraMac(fullText: string) {
  const t = semAcento(fullText).toLowerCase()
  return t.includes('dt.pagto') && t.includes('at.pago')
}

function parecePosicaoFinanceira(fullText: string) {
  const t = semAcento(fullText).toLowerCase()
  if (parecePosicaoFinanceiraBenx(fullText)) return false
  if (parecePosicaoFinanceiraMac(fullText)) return false
  return (
    t.includes('posicao financeira') ||
    (t.includes('paga em') && t.includes('valor original') && t.includes('valor pago'))
  )
}

function pareceRelacaoValoresPagos(fullText: string) {
  const t = semAcento(fullText).toLowerCase()
  if (parecePosicaoFinanceiraMac(fullText)) return false
  return (
    t.includes('relacao valores pagos') ||
    (t.includes('dt.venc') &&
      t.includes('dt.pagto') &&
      t.includes('original') &&
      t.includes('atualizado') &&
      t.includes('p.rata'))
  )
}

function isSerieParcela(token: string) {
  return /^\d+$/.test(token)
}

function isStatusPago(token: string) {
  return /^pago$/i.test(token.trim())
}

function isIntegerToken(token: string) {
  return /^\d+$/.test(token.trim())
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

function extractDatesBr(text: string) {
  return [...text.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)].map((m) => m[1])
}

/**
 * Posição Financeira — Portal Benx:
 * Vencimento | Pagamento | Valor | Encargos | Descontos | Total
 *
 * Quando há encargos, a coluna Valor já os inclui (Valor == Total).
 * valorContratual = Valor − Encargos; a calculadora reaplica o INCC sobre essa base.
 */
function parseLancamentoPosicaoFinanceiraBenx(text: string): LancamentoExtraido | null {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return null
  if (/posi[cç][aã]o financeira/i.test(compact)) return null
  if (/valores\s+(pagos|em atraso|a vencer)/i.test(compact)) return null
  if (/vencimento/i.test(compact) && /pagamento/i.test(compact)) return null
  if (/n[aã]o h[aá] valores/i.test(compact)) return null
  if (/resumo financeiro|total pago|data base/i.test(compact)) return null

  const dates = extractDatesBr(compact)
  const moneys = extractMoneys(compact)
  if (dates.length < 2 || moneys.length < 4) return null

  const dataPagamento = brDateToIso(dates[1])
  if (!dataPagamento) return null

  const valor = moneys[0]
  const encargos = moneys[1]
  const descontos = moneys[2]
  const total = moneys[3]
  const valorContratual = formatMoneyBr(
    Math.max(0, parseMoneyBr(valor) - parseMoneyBr(encargos)),
  )

  return {
    dataPagamento,
    valorPago: total,
    valorContratual,
    renegociacao: ZERO,
    multa: ZERO,
    jurosMora: encargos,
    descontos,
    taxasAdicionais: ZERO,
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

function dataAssinaturaRelacaoValoresPagos(fullText: string) {
  const m = fullText.match(/Data da Compra:\s*(\d{2}\/\d{2}\/\d{4})/i)
  return m ? brDateToIso(m[1]) : null
}

function dataAssinaturaPosicaoFinanceiraMac(fullText: string) {
  const pcv = fullText.match(/\bPCV\s+(\d{2}\/\d{2}\/\d{4})/i)
  if (pcv) return brDateToIso(pcv[1])
  const labeled = dataAssinaturaPosicaoFinanceira(fullText)
  if (labeled) return labeled
  const header = fullText.match(
    /\b\d{1,6}\s+(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4}[\s\S]{0,80}\bQuitado\b/i,
  )
  if (header) return brDateToIso(header[1])
  return null
}

function tokensFromRow(row: PdfTextRow): string[] {
  const fromCells = row.cells.map((c) => c.str.trim()).filter(Boolean)
  if (
    fromCells.length >= 10 &&
    isSerieParcela(fromCells[0]) &&
    isSerieParcela(fromCells[1])
  ) {
    return fromCells
  }
  return row.text.split(/\s+/).filter(Boolean)
}

/**
 * Posição Financeira MAC (Vendas | Recebíveis):
 * S | P | Original | Dt.Venc. | Dt.Pagto | Atualizado | Atr. | At.Pago | P.Rata |
 * Multa | Mora | Desc.TP | Desc.Adic. | Resíduo | Dif.Encargo | Pago | Status | Doc | Recibo
 *
 * Só a tabela de pagamentos: Original → valor contratual, Pago → valor pago, Dt.Pagto → data.
 * Atualizado / At.Pago são ignorados: a calculadora reaplica o INCC.
 */
function parseLancamentoPosicaoFinanceiraMac(
  tokens: string[],
): LancamentoExtraido | null {
  if (tokens.length < 10) return null
  if (!isSerieParcela(tokens[0]) || !isSerieParcela(tokens[1])) return null

  const original = normalizeFlexibleMoney(tokens[2])
  if (!original) return null
  if (!isDateBr(tokens[3]) || !isDateBr(tokens[4])) return null

  const dataPagamento = brDateToIso(tokens[4])
  if (!dataPagamento) return null
  if (!tokens.some(isStatusPago)) return null

  let rest = tokens.slice(5)
  while (rest.length) {
    const last = rest[rest.length - 1]
    if (isStatusPago(last) || isIntegerToken(last)) {
      rest = rest.slice(0, -1)
      continue
    }
    break
  }

  const moneys = rest
    .map(normalizeFlexibleMoney)
    .filter((m): m is string => m != null)
  if (moneys.length < 3) return null

  const valorPago = moneys[moneys.length - 1]
  const mid = moneys.slice(2, -1)

  return {
    dataPagamento,
    valorContratual: original,
    valorPago,
    renegociacao: ZERO,
    multa: mid[1] ?? ZERO,
    jurosMora: somarMoedaBr(mid[0] ?? ZERO, mid[2] ?? ZERO),
    descontos: mid[3] ?? ZERO,
    taxasAdicionais: mid[4] ?? ZERO,
    parcela: `${tokens[0]}-${tokens[1]}`,
  }
}

function parsePosicaoFinanceiraMacFromRows(rows: PdfTextRow[]): ExtratoParseResult {
  const fullText = rows.map((r) => r.text).join('\n')
  const lancamentos: LancamentoExtraido[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const text = semAcento(row.text).toLowerCase()
    if (text.includes('plano pagamento')) continue
    if (text.includes('resumo financeiro')) continue
    if (text.includes('dt.venc') && text.includes('original')) continue
    if (text.includes('proprietarios')) continue
    if (text.includes('cheque devolvido')) continue

    const parsed = parseLancamentoPosicaoFinanceiraMac(tokensFromRow(row))
    if (!parsed) continue

    const key = chaveLancamento(parsed)
    if (seen.has(key)) continue
    seen.add(key)
    lancamentos.push(parsed)
  }

  lancamentos.sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento))
  return { dataAssinatura: dataAssinaturaPosicaoFinanceiraMac(fullText), lancamentos }
}

/**
 * Relação Valores Pagos (Boulevard / Tecnisa):
 * S | P | Original | Dt.Venc. | Dt.Pagto | Atualizado | Atr. | P.Rata | Mora | Desc. | Adic. | Pago
 *
 * A coluna Atualizado é ignorada: a calculadora reaplica o INCC sobre o Original.
 */
function parseLancamentoRelacaoValoresPagos(tokens: string[]): LancamentoExtraido | null {
  if (tokens.length < 8) return null
  if (!isSerieParcela(tokens[0]) || !isSerieParcela(tokens[1])) return null

  const original = normalizeFlexibleMoney(tokens[2])
  if (!original) return null
  if (!isDateBr(tokens[3]) || !isDateBr(tokens[4])) return null

  const dataPagamento = brDateToIso(tokens[4])
  if (!dataPagamento) return null

  let rest = tokens.slice(5)
  while (rest.length && isStatusPago(rest[rest.length - 1])) {
    rest = rest.slice(0, -1)
  }
  if (rest.length < 5) return null

  const valorPago = normalizeFlexibleMoney(rest[rest.length - 1])
  if (!valorPago) return null

  const tail = rest.slice(0, -1)
  if (tail.length < 5) return null

  const prata = normalizeFlexibleMoney(tail[2]) ?? ZERO
  const mora = normalizeFlexibleMoney(tail[3]) ?? ZERO

  let descontos = ZERO
  let taxasAdicionais = ZERO
  if (tail.length === 5) {
    descontos = normalizeFlexibleMoney(tail[4]) ?? ZERO
  } else if (tail.length >= 6) {
    descontos = normalizeFlexibleMoney(tail[4]) ?? ZERO
    taxasAdicionais = normalizeFlexibleMoney(tail[5]) ?? ZERO
  }

  const jurosMora = somarMoedaBr(prata, mora)

  return {
    dataPagamento,
    valorContratual: original,
    valorPago,
    renegociacao: ZERO,
    multa: ZERO,
    jurosMora,
    descontos,
    taxasAdicionais,
    parcela: `${tokens[0]}-${tokens[1]}`,
  }
}

function parseRelacaoValoresPagosFromRows(rows: PdfTextRow[]): ExtratoParseResult {
  const fullText = rows.map((r) => r.text).join('\n')
  const lancamentos: LancamentoExtraido[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const text = semAcento(row.text).toLowerCase()
    if (text.includes('relacao valores pagos')) continue
    if (text.includes('dt.venc') && text.includes('original')) continue
    if (text.startsWith('cliente:') || text.startsWith('projeto:') || text.startsWith('unidade:')) {
      continue
    }
    if (text.startsWith('bloco:')) continue

    const tokens = row.cells.map((c) => c.str.trim()).filter(Boolean)
    const parsed = parseLancamentoRelacaoValoresPagos(tokens)
    if (!parsed) continue

    const key = chaveLancamento(parsed)
    if (seen.has(key)) continue
    seen.add(key)
    lancamentos.push(parsed)
  }

  lancamentos.sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento))
  return { dataAssinatura: dataAssinaturaRelacaoValoresPagos(fullText), lancamentos }
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

function parsePosicaoFinanceiraBenxFromRows(rows: PdfTextRow[]): ExtratoParseResult {
  const lancamentos: LancamentoExtraido[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const parsed = parseLancamentoPosicaoFinanceiraBenx(row.text)
    if (!parsed) continue
    const key = chaveLancamento(parsed)
    if (seen.has(key)) continue
    seen.add(key)
    lancamentos.push(parsed)
  }

  lancamentos.sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento))
  return { dataAssinatura: null, lancamentos }
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

/** Interpreta linhas já extraídas do PDF (CivilWeb, Posição Financeira, Benx, MAC ou Relação Valores Pagos). */
export function parseExtratoFromRows(rows: PdfTextRow[]): ExtratoParseResult {
  const fullText = rows.map((r) => r.text).join('\n')
  if (parecePosicaoFinanceiraBenx(fullText)) {
    return parsePosicaoFinanceiraBenxFromRows(rows)
  }
  if (parecePosicaoFinanceiraMac(fullText)) {
    return parsePosicaoFinanceiraMacFromRows(rows)
  }
  if (parecePosicaoFinanceira(fullText)) {
    return parsePosicaoFinanceiraFromRows(rows)
  }
  if (pareceRelacaoValoresPagos(fullText)) {
    return parseRelacaoValoresPagosFromRows(rows)
  }

  const civil = parseCivilWebFromRows(rows)
  if (civil.lancamentos.length) return civil

  const benx = parsePosicaoFinanceiraBenxFromRows(rows)
  if (benx.lancamentos.length) return benx

  return parsePosicaoFinanceiraFromRows(rows)
}
