type YearMonth = `${number}-${string}`

// Fonte: tabela INCC-DI (FGV). Mantemos local para o app funcionar offline.
const inccMensal: Record<YearMonth, number> = {
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

function toYearMonth(date: Date): YearMonth {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}` as YearMonth
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

  while (compareYearMonth(atual, anoMesFim) <= 0) {
    const taxa = getInccMensal(atual)
    if (taxa == null) {
      incompleto = true
      break
    }
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

/**
 * Correção anual no aniversário do contrato.
 * Usa o INCC acumulado desde o mês seguinte ao início até o mês do último aniversário
 * já ocorrido na data do pagamento (aplicado de forma linear sobre o valor contratual).
 */
export function calcularFatorCorrecaoPorAniversarios(
  dataInicioContrato: Date,
  dataPagamento: Date,
) {
  if (dataPagamento.getTime() < dataInicioContrato.getTime()) {
    return { fator: 1, ultimaTaxa: null as number | null, aviso: null as string | null }
  }

  const dia = dataInicioContrato.getDate()
  const mes = dataInicioContrato.getMonth()
  const anoInicio = dataInicioContrato.getFullYear()

  // Último aniversário já ocorrido até a data do pagamento
  let ultimoAniversario: Date | null = null
  let ano = anoInicio + 1
  while (true) {
    const aniversario = new Date(ano, mes, dia)
    if (aniversario.getTime() > dataPagamento.getTime()) break
    ultimoAniversario = aniversario
    ano += 1
  }

  if (!ultimoAniversario) {
    return { fator: 1, ultimaTaxa: null, aviso: null }
  }

  // Acumula do mês seguinte ao início do contrato até o mês do aniversário
  const inicioAcumulo = addMonths(toYearMonth(dataInicioContrato), 1)
  const fimAcumulo = toYearMonth(ultimoAniversario)
  const { acumuladoPercentual, mesesConsiderados, incompleto } = calcularInccAcumuladoEntre(
    inicioAcumulo,
    fimAcumulo,
  )

  if (mesesConsiderados === 0) {
    return {
      fator: 1,
      ultimaTaxa: null,
      aviso: 'Sem índices INCC suficientes para este período.',
    }
  }

  return {
    fator: 1 + acumuladoPercentual / 100,
    ultimaTaxa: acumuladoPercentual,
    aviso: incompleto
      ? 'Cálculo parcial: faltam índices INCC em parte do período.'
      : null,
  }
}
