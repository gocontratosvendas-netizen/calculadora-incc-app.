type YearMonth = `${number}-${string}`

// Fonte: tabela INCC-DI (FGV) exibida pela Yahii (valores % ao mês).
// Mantemos local para o app funcionar offline.
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

export function getInccMensal(anoMes: YearMonth) {
  const val = inccMensal[anoMes]
  return typeof val === 'number' ? val : null
}

export function calcularIncc12MesesNoMes(anoMesFim: YearMonth) {
  let fator = 1
  for (let i = 0; i < 12; i += 1) {
    const ym = addMonths(anoMesFim, -i)
    const taxa = getInccMensal(ym)
    if (taxa == null) return null
    fator *= 1 + taxa / 100
  }
  return (fator - 1) * 100
}

export function calcularFatorCorrecaoPorAniversarios(
  dataInicioContrato: Date,
  dataPagamento: Date,
) {
  if (dataPagamento < dataInicioContrato) return { fator: 1, ultimaTaxa: null as number | null }

  const dia = dataInicioContrato.getDate()
  const mes = dataInicioContrato.getMonth()

  let fator = 1
  let ultimaTaxa: number | null = null

  // Primeiro aniversário = +1 ano
  let ano = dataInicioContrato.getFullYear() + 1
  while (true) {
    const aniversario = new Date(ano, mes, dia)
    if (aniversario > dataPagamento) break

    const ymAniversario = toYearMonth(aniversario)
    const taxa12m = calcularIncc12MesesNoMes(ymAniversario)
    if (taxa12m == null) return { fator: 1, ultimaTaxa: null }

    fator *= 1 + taxa12m / 100
    ultimaTaxa = taxa12m
    ano += 1
  }

  return { fator, ultimaTaxa }
}

