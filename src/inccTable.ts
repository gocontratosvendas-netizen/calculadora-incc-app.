export type YearMonth = `${number}-${string}`

// Fonte: tabela INCC-DI (FGV). Mantemos local para o app funcionar offline.
const inccMensal: Record<YearMonth, number> = {
  // 2020
  '2020-01': 0.38,
  '2020-02': 0.33,
  '2020-03': 0.26,
  '2020-04': 0.22,
  '2020-05': 0.2,
  '2020-06': 0.34,
  '2020-07': 1.17,
  '2020-08': 0.72,
  '2020-09': 1.16,
  '2020-10': 1.73,
  '2020-11': 1.28,
  '2020-12': 0.7,

  // 2021
  '2021-01': 0.89,
  '2021-02': 1.89,
  '2021-03': 1.3,
  '2021-04': 0.9,
  '2021-05': 2.22,
  '2021-06': 2.16,
  '2021-07': 0.85,
  '2021-08': 0.46,
  '2021-09': 0.51,
  '2021-10': 0.86,
  '2021-11': 0.67,
  '2021-12': 0.35,

  // 2022
  '2022-01': 0.71,
  '2022-02': 0.38,
  '2022-03': 0.86,
  '2022-04': 0.95,
  '2022-05': 2.28,
  '2022-06': 2.14,
  '2022-07': 0.86,
  '2022-08': 0.09,
  '2022-09': 0.09,
  '2022-10': 0.12,
  '2022-11': 0.36,
  '2022-12': 0.09,

  // 2023
  '2023-01': 0.46,
  '2023-02': 0.05,
  '2023-03': 0.3,
  '2023-04': 0.14,
  '2023-05': 0.59,
  '2023-06': 0.71,
  '2023-07': 0.1,
  '2023-08': 0.17,
  '2023-09': 0.34,
  '2023-10': 0.2,
  '2023-11': 0.07,
  '2023-12': 0.31,

  // 2024
  '2024-01': 0.27,
  '2024-02': 0.13,
  '2024-03': 0.28,
  '2024-04': 0.52,
  '2024-05': 0.86,
  '2024-06': 0.71,
  '2024-07': 0.72,
  '2024-08': 0.7,
  '2024-09': 0.58,
  '2024-10': 0.68,
  '2024-11': 0.4,
  '2024-12': 0.5,

  // 2025
  '2025-01': 0.83,
  '2025-02': 0.4,
  '2025-03': 0.39,
  '2025-04': 0.52,
  '2025-05': 0.58,
  '2025-06': 0.69,
  '2025-07': 0.91,
  '2025-08': 0.52,
  '2025-09': 0.17,
  '2025-10': 0.3,
  '2025-11': 0.27,
  '2025-12': 0.21,

  // 2026
  '2026-01': 0.72,
  '2026-02': 0.28,
  '2026-03': 0.54,
  '2026-04': 1.0,
  '2026-05': 0.88,
  '2026-06': 0.78,
  '2026-07': 0.61,
}

export type DefasagemMeses = 0 | 1 | 2 | 3

const MESES_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const

function toYearMonth(date: Date): YearMonth {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}` as YearMonth
}

export function formatarAnoMes(ym: YearMonth) {
  const [y, m] = ym.split('-').map(Number)
  return `${MESES_PT[(m ?? 1) - 1]}/${y}`
}

export function mesBaseDoIndice(dataContrato: Date, defasagemMeses: number) {
  const lag = Math.min(3, Math.max(0, Math.trunc(defasagemMeses)))
  return addMonths(toYearMonth(dataContrato), -lag)
}

export function aniversariosDecorridos(dataContrato: Date, dataPagamento: Date) {
  let n = dataPagamento.getFullYear() - dataContrato.getFullYear()
  const pagamentoMd = dataPagamento.getMonth() * 100 + dataPagamento.getDate()
  const contratoMd = dataContrato.getMonth() * 100 + dataContrato.getDate()
  if (pagamentoMd < contratoMd) n -= 1
  return n < 0 ? 0 : n
}

export function arredondarMoeda(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

function addMonths(ym: YearMonth, delta: number): YearMonth {
  const [yRaw, mRaw] = ym.split('-').map(Number)
  const date = new Date(yRaw, mRaw - 1 + delta, 1)
  return toYearMonth(date)
}

function compareYearMonth(a: YearMonth, b: YearMonth) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

export function getInccMensal(anoMes: YearMonth) {
  const val = inccMensal[anoMes]
  return typeof val === 'number' ? val : null
}

/** Acumula INCC-DI mês a mês entre dois ano-mês (inclusive). */
export function calcularInccAcumuladoEntre(anoMesInicio: YearMonth, anoMesFim: YearMonth) {
  if (compareYearMonth(anoMesFim, anoMesInicio) < 0) {
    return { acumuladoPercentual: 0, mesesConsiderados: 0, incompleto: false }
  }

  let fator = 1
  let meses = 0
  let incompleto = false
  let atual = anoMesInicio
  let iniciou = false

  while (compareYearMonth(atual, anoMesFim) <= 0) {
    const taxa = getInccMensal(atual)
    if (taxa == null) {
      // Antes do primeiro mês disponível: pula. Depois de iniciado: marca incompleto e para.
      if (iniciou) {
        incompleto = true
        break
      }
      atual = addMonths(atual, 1)
      continue
    }
    iniciou = true
    fator *= 1 + taxa / 100
    meses += 1
    atual = addMonths(atual, 1)
  }

  return {
    acumuladoPercentual: (fator - 1) * 100,
    mesesConsiderados: meses,
    incompleto,
  }
}

function acumularFatorNaJanela(anoMesInicio: YearMonth, anoMesFim: YearMonth) {
  let fator = 1
  let atual = anoMesInicio
  while (compareYearMonth(atual, anoMesFim) <= 0) {
    const taxa = getInccMensal(atual)
    if (taxa == null) {
      return {
        fator: 1,
        erro: `Falta o índice INCC-DI de ${formatarAnoMes(atual)}.`,
      }
    }
    fator *= 1 + taxa / 100
    atual = addMonths(atual, 1)
  }
  return { fator, erro: null as string | null }
}

export type FatorCorrecao = {
  fator: number
  n: number
  mesBase: YearMonth
  janelaInicio: YearMonth | null
  janelaFim: YearMonth | null
  janelaLabel: string | null
  acumuladoPercentual: number
  ultimaTaxa: number | null
  aviso: string | null
  erro: string | null
}

/**
 * Correção anual no aniversário do contrato.
 * A faixa (n) vem só da data de pagamento vs. aniversários.
 * A defasagem desloca a janela do índice, sem mudar n nem o tamanho da janela (12×n meses).
 */
export function calcularFatorCorrecaoPorAniversarios(
  dataInicioContrato: Date,
  dataPagamento: Date,
  defasagemMeses: number = 0,
): FatorCorrecao {
  const mesBase = mesBaseDoIndice(dataInicioContrato, defasagemMeses)
  const vazio = (n: number, erro: string | null = null): FatorCorrecao => ({
    fator: 1,
    n,
    mesBase,
    janelaInicio: null,
    janelaFim: null,
    janelaLabel: null,
    acumuladoPercentual: 0,
    ultimaTaxa: 0,
    aviso: null,
    erro,
  })

  if (dataPagamento.getTime() < dataInicioContrato.getTime()) {
    return vazio(0)
  }

  const n = aniversariosDecorridos(dataInicioContrato, dataPagamento)
  if (n === 0) return vazio(0)

  const janelaInicio = addMonths(mesBase, 1)
  const janelaFim = addMonths(mesBase, 12 * n)
  const { fator, erro } = acumularFatorNaJanela(janelaInicio, janelaFim)
  if (erro) return vazio(n, erro)

  const acumuladoPercentual = (fator - 1) * 100
  return {
    fator,
    n,
    mesBase,
    janelaInicio,
    janelaFim,
    janelaLabel: `${formatarAnoMes(janelaInicio)} a ${formatarAnoMes(janelaFim)}`,
    acumuladoPercentual,
    ultimaTaxa: acumuladoPercentual,
    aviso: null,
    erro: null,
  }
}
