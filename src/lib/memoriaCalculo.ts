import {
  arredondarMoeda,
  calcularFatorCorrecaoPorAniversarios,
  calcularJurosCompensatoriosPrice,
  dataReferenciaDaParcela,
  formatarAnoMes,
  mesBaseDoIndice,
  type DefasagemMeses,
} from '../inccTable'

export type LancamentoMemoria = {
  id: string
  dataPagamento: string
  dataVencimento: string
  valorContratual: number
  valorPago: number
  renegociacao: number
  multa: number
  descontos: number
  jurosMora: number
  taxasAdicionais: number
}

export type MemoriaCalculoInput = {
  versao: 1
  dataAniversario: string
  dataHabiteSe: string
  defasagemMeses: DefasagemMeses
  linhas: LancamentoMemoria[]
}

export type MemoriaCalculoLinha = {
  id: string
  pagamento: string
  dataPagamento: string
  dataVencimento: string
  vc: number
  vp: number
  renegociacao: number
  multa: number
  descontos: number
  jurosMora: number
  taxasAdicionais: number
  n: number
  incc: number
  inccPercentual: number
  igpmPercentual: number
  janela: string | null
  erroIndice: string | null
  correcao: number
  inccValor: number
  igpmValor: number
  jurosCompensatorios: number
  baseCorrigida: number
  devido: number
  excesso: number
}

export type RelatorioMemoriaCalculo = {
  inicioEfetivo: Date | null
  indiceBaseLabel: string | null
  errosIndice: string[]
  rows: MemoriaCalculoLinha[]
  periodoInicio: string
  periodoFim: string
  inccUltimaCorrecao: number | null
  temHabiteSe: boolean
  temVencimentos: boolean
  defasagemMeses: DefasagemMeses
  usarDataVencimento: boolean
  totalDevido: number
  totalPago: number
  totalExcesso: number
  totalRenegociacao: number
  totalMulta: number
  totalDescontos: number
  totalJurosMora: number
  totalTaxasAdicionais: number
  totalJurosCompensatorios: number
  totalCorrecao: number
  totalIncc: number
  totalIgpm: number
}

export type OpcoesRelatorioMemoria = {
  usarDataVencimento?: boolean
  defasagemMeses?: DefasagemMeses
}

function parseIsoDate(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function defasagemValida(valor: number): valor is DefasagemMeses {
  return valor === 0 || valor === 1 || valor === 2 || valor === 3
}

function numeroSeguro(valor: unknown) {
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(n) ? n : 0
}

export function parseMoneyBr(value: string) {
  const normalized = value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
  const num = Number(normalized)
  return Number.isFinite(num) ? num : 0
}

export function isMemoriaCalculoInput(value: unknown): value is MemoriaCalculoInput {
  if (!value || typeof value !== 'object') return false
  const raw = value as Partial<MemoriaCalculoInput>
  if (raw.versao !== 1) return false
  if (typeof raw.dataAniversario !== 'string') return false
  if (typeof raw.dataHabiteSe !== 'string') return false
  if (!defasagemValida(Number(raw.defasagemMeses))) return false
  if (!Array.isArray(raw.linhas)) return false
  return raw.linhas.every(
    (linha) =>
      linha &&
      typeof linha.id === 'string' &&
      typeof linha.dataPagamento === 'string' &&
      typeof linha.dataVencimento === 'string',
  )
}

export function normalizarMemoriaCalculo(value: unknown): MemoriaCalculoInput | null {
  if (!isMemoriaCalculoInput(value)) return null
  return {
    versao: 1,
    dataAniversario: value.dataAniversario,
    dataHabiteSe: value.dataHabiteSe,
    defasagemMeses: Number(value.defasagemMeses) as DefasagemMeses,
    linhas: value.linhas.map((linha) => ({
      id: linha.id,
      dataPagamento: linha.dataPagamento,
      dataVencimento: linha.dataVencimento ?? '',
      valorContratual: numeroSeguro(linha.valorContratual),
      valorPago: numeroSeguro(linha.valorPago),
      renegociacao: numeroSeguro(linha.renegociacao),
      multa: numeroSeguro(linha.multa),
      descontos: numeroSeguro(linha.descontos),
      jurosMora: numeroSeguro(linha.jurosMora),
      taxasAdicionais: numeroSeguro(linha.taxasAdicionais),
    })),
  }
}

export function montarRelatorioMemoria(
  input: MemoriaCalculoInput,
  opcoes: OpcoesRelatorioMemoria = {},
): RelatorioMemoriaCalculo {
  const usarDataVencimento = Boolean(opcoes.usarDataVencimento)
  const defasagemMeses = opcoes.defasagemMeses ?? input.defasagemMeses
  const habiteSeDate = parseIsoDate(input.dataHabiteSe)
  const temVencimentos = input.linhas.some((l) => Boolean(parseIsoDate(l.dataVencimento)))

  const linhasValidas = input.linhas
    .map((l) => {
      const iso = dataReferenciaDaParcela(l.dataPagamento, l.dataVencimento, usarDataVencimento)
      return {
        ...l,
        iso,
        data: parseIsoDate(iso),
      }
    })
    .filter((l) => l.data && l.valorContratual > 0)

  const maisAntiga = linhasValidas.reduce<Date | null>((acc, l) => {
    const data = l.data!
    if (!acc || data.getTime() < acc.getTime()) return data
    return acc
  }, null)
  const inicioEfetivo = parseIsoDate(input.dataAniversario) ?? maisAntiga

  const rows = linhasValidas.map((l) => {
    const baseInicio = inicioEfetivo ?? l.data!
    const dataVencimentoParcela = parseIsoDate(l.dataVencimento) ?? l.data!
    const correcaoIndice = calcularFatorCorrecaoPorAniversarios(baseInicio, l.data!, defasagemMeses, {
      dataHabiteSe: habiteSeDate,
      dataVencimentoParcela,
    })
    const encargos = l.renegociacao + l.multa + l.jurosMora + l.taxasAdicionais - l.descontos
    const baseCorrigida = correcaoIndice.erro
      ? l.valorContratual
      : arredondarMoeda(l.valorContratual * correcaoIndice.fator)
    const jurosCompensatorios = habiteSeDate
      ? calcularJurosCompensatoriosPrice(baseCorrigida, habiteSeDate, dataVencimentoParcela).juros
      : 0
    const devido = correcaoIndice.erro
      ? arredondarMoeda(l.valorContratual + encargos + jurosCompensatorios)
      : arredondarMoeda(baseCorrigida + encargos + jurosCompensatorios)
    const inccValor = correcaoIndice.erro
      ? 0
      : arredondarMoeda(l.valorContratual * (correcaoIndice.fatorIncc - 1))
    const correcao = correcaoIndice.erro ? 0 : arredondarMoeda(baseCorrigida - l.valorContratual)
    const igpmValor = correcaoIndice.erro ? 0 : arredondarMoeda(correcao - inccValor)

    return {
      id: l.id,
      pagamento: l.iso,
      dataPagamento: l.dataPagamento,
      dataVencimento: l.dataVencimento,
      vc: l.valorContratual,
      vp: l.valorPago,
      renegociacao: l.renegociacao,
      multa: l.multa,
      descontos: l.descontos,
      jurosMora: l.jurosMora,
      taxasAdicionais: l.taxasAdicionais,
      n: correcaoIndice.n,
      incc: correcaoIndice.acumuladoPercentual,
      inccPercentual: correcaoIndice.acumuladoInccPercentual,
      igpmPercentual: correcaoIndice.acumuladoIgpmPercentual,
      janela: correcaoIndice.janelaLabel,
      erroIndice: correcaoIndice.erro,
      correcao,
      inccValor,
      igpmValor,
      jurosCompensatorios,
      baseCorrigida,
      devido,
      excesso: l.valorPago - devido,
    }
  })

  const somar = (campo: keyof Pick<
    MemoriaCalculoLinha,
    | 'vp'
    | 'devido'
    | 'excesso'
    | 'renegociacao'
    | 'multa'
    | 'descontos'
    | 'jurosMora'
    | 'taxasAdicionais'
    | 'jurosCompensatorios'
    | 'correcao'
    | 'inccValor'
    | 'igpmValor'
  >) => arredondarMoeda(rows.reduce((acc, r) => acc + r[campo], 0))

  const pagamentosIso = rows.map((r) => r.pagamento).slice().sort()
  const ultimaComCorrecao = rows.reduce<MemoriaCalculoLinha | null>((acc, r) => {
    if (r.n <= 0) return acc
    if (!acc || r.pagamento.localeCompare(acc.pagamento) > 0) return r
    return acc
  }, null)

  return {
    inicioEfetivo,
    indiceBaseLabel: inicioEfetivo
      ? formatarAnoMes(mesBaseDoIndice(inicioEfetivo, defasagemMeses))
      : null,
    errosIndice: [...new Set(rows.map((r) => r.erroIndice).filter((e): e is string => Boolean(e)))],
    rows,
    periodoInicio: pagamentosIso[0] ?? '',
    periodoFim: pagamentosIso[pagamentosIso.length - 1] ?? '',
    inccUltimaCorrecao: ultimaComCorrecao?.incc ?? null,
    temHabiteSe: Boolean(habiteSeDate),
    temVencimentos,
    defasagemMeses,
    usarDataVencimento,
    totalDevido: somar('devido'),
    totalPago: somar('vp'),
    totalExcesso: somar('excesso'),
    totalRenegociacao: somar('renegociacao'),
    totalMulta: somar('multa'),
    totalDescontos: somar('descontos'),
    totalJurosMora: somar('jurosMora'),
    totalTaxasAdicionais: somar('taxasAdicionais'),
    totalJurosCompensatorios: somar('jurosCompensatorios'),
    totalCorrecao: somar('correcao'),
    totalIncc: somar('inccValor'),
    totalIgpm: somar('igpmValor'),
  }
}

export function compararRelatorios(
  pagamento: RelatorioMemoriaCalculo,
  vencimento: RelatorioMemoriaCalculo,
) {
  const porIdPagamento = new Map(pagamento.rows.map((r) => [r.id, r]))
  const porIdVencimento = new Map(vencimento.rows.map((r) => [r.id, r]))
  const ids = [...new Set([...porIdPagamento.keys(), ...porIdVencimento.keys()])]

  const rows = ids.map((id) => {
    const pagto = porIdPagamento.get(id)
    const venc = porIdVencimento.get(id)
    const base = pagto ?? venc
    return {
      id,
      dataPagamento: base?.dataPagamento ?? '',
      dataVencimento: base?.dataVencimento ?? '',
      vc: base?.vc ?? 0,
      devidoPagamento: pagto?.devido ?? 0,
      devidoVencimento: venc?.devido ?? 0,
      deltaDevido: arredondarMoeda((venc?.devido ?? 0) - (pagto?.devido ?? 0)),
      excessoPagamento: pagto?.excesso ?? 0,
      excessoVencimento: venc?.excesso ?? 0,
      deltaExcesso: arredondarMoeda((venc?.excesso ?? 0) - (pagto?.excesso ?? 0)),
      correcaoPagamento: pagto?.correcao ?? 0,
      correcaoVencimento: venc?.correcao ?? 0,
      jurosPagamento: pagto?.jurosCompensatorios ?? 0,
      jurosVencimento: venc?.jurosCompensatorios ?? 0,
    }
  })

  return {
    rows,
    totalDevidoPagamento: pagamento.totalDevido,
    totalDevidoVencimento: vencimento.totalDevido,
    deltaDevido: arredondarMoeda(vencimento.totalDevido - pagamento.totalDevido),
    totalExcessoPagamento: pagamento.totalExcesso,
    totalExcessoVencimento: vencimento.totalExcesso,
    deltaExcesso: arredondarMoeda(vencimento.totalExcesso - pagamento.totalExcesso),
    totalCorrecaoPagamento: pagamento.totalCorrecao,
    totalCorrecaoVencimento: vencimento.totalCorrecao,
    totalJurosPagamento: pagamento.totalJurosCompensatorios,
    totalJurosVencimento: vencimento.totalJurosCompensatorios,
  }
}
