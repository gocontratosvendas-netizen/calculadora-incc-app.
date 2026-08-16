import type { Periodo, Regime, SortCampo, SortDir, StatusLancamento } from './types'
import { hojeISO, partesData, periodoDoAno, periodoDoMes, periodoDoTrimestre, trimestreDe } from './engine/datas'

export type AtalhoPeriodo = 'mes' | 'mes_anterior' | 'trimestre' | 'ano' | 'personalizado'

export type FiltrosFinanceiro = {
  aba: 'dre' | 'fluxo'
  regime: Regime
  atalho: AtalhoPeriodo
  periodo: Periodo
  movimentacao: 'todas' | 'entrada' | 'saida'
  classificacaoIds: string[]
  status: 'todos' | StatusLancamento
  busca: string
  ord: SortCampo
  dir: SortDir
  pagina: number
}

export function filtrosPadrao(agora = new Date()): FiltrosFinanceiro {
  const hoje = hojeISO(agora)
  const { y, m } = partesData(hoje)
  return {
    aba: 'dre',
    regime: 'competencia',
    atalho: 'mes',
    periodo: periodoDoMes(y, m),
    movimentacao: 'todas',
    classificacaoIds: [],
    status: 'todos',
    busca: '',
    ord: 'emissao',
    dir: 'desc',
    pagina: 1,
  }
}

export function periodoDeAtalho(atalho: AtalhoPeriodo, personalizado: Periodo, agora = new Date()): Periodo {
  const hoje = hojeISO(agora)
  const { y, m } = partesData(hoje)
  if (atalho === 'mes') return periodoDoMes(y, m)
  if (atalho === 'mes_anterior') {
    const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }
    return periodoDoMes(prev.y, prev.m)
  }
  if (atalho === 'trimestre') return periodoDoTrimestre(y, trimestreDe(m))
  if (atalho === 'ano') return periodoDoAno(y)
  return personalizado
}

export function parseFiltros(search: string, pathname: string): FiltrosFinanceiro {
  const padrao = filtrosPadrao()
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const aba: FiltrosFinanceiro['aba'] = pathname.includes('/fluxo') ? 'fluxo' : 'dre'
  const regime = params.get('regime') === 'caixa' ? 'caixa' : 'competencia'
  const atalhoRaw = params.get('periodo')
  const atalho: AtalhoPeriodo =
    atalhoRaw === 'mes_anterior' || atalhoRaw === 'trimestre' || atalhoRaw === 'ano' || atalhoRaw === 'personalizado'
      ? atalhoRaw
      : 'mes'
  const personalizado: Periodo = {
    inicio: params.get('inicio') ?? padrao.periodo.inicio,
    fim: params.get('fim') ?? padrao.periodo.fim,
  }
  const movimentacaoRaw = params.get('mov')
  const movimentacao =
    movimentacaoRaw === 'entrada' || movimentacaoRaw === 'saida' ? movimentacaoRaw : 'todas'
  const statusRaw = params.get('status')
  const status =
    statusRaw === 'pago' || statusRaw === 'pendente' || statusRaw === 'atrasado' ? statusRaw : 'todos'
  const ordRaw = params.get('ord')
  const ord: SortCampo =
    ordRaw === 'emissao' ||
    ordRaw === 'movimentacao' ||
    ordRaw === 'historico' ||
    ordRaw === 'classificacao' ||
    ordRaw === 'valor' ||
    ordRaw === 'vencimento' ||
    ordRaw === 'pagamento'
      ? ordRaw
      : 'emissao'
  const cls = params.get('cls')
  const pagina = Number.parseInt(params.get('pagina') ?? '1', 10)
  return {
    aba,
    regime,
    atalho,
    periodo: atalho === 'personalizado' ? personalizado : periodoDeAtalho(atalho, personalizado),
    movimentacao,
    classificacaoIds: cls ? cls.split(',').filter(Boolean) : [],
    status,
    busca: params.get('q') ?? '',
    ord,
    dir: params.get('dir') === 'asc' ? 'asc' : 'desc',
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  }
}

export function serializarFiltros(filtros: FiltrosFinanceiro): string {
  const params = new URLSearchParams()
  if (filtros.regime !== 'competencia') params.set('regime', filtros.regime)
  if (filtros.atalho !== 'mes') params.set('periodo', filtros.atalho)
  if (filtros.atalho === 'personalizado') {
    params.set('inicio', filtros.periodo.inicio)
    params.set('fim', filtros.periodo.fim)
  }
  if (filtros.movimentacao !== 'todas') params.set('mov', filtros.movimentacao)
  if (filtros.classificacaoIds.length) params.set('cls', filtros.classificacaoIds.join(','))
  if (filtros.status !== 'todos') params.set('status', filtros.status)
  if (filtros.busca) params.set('q', filtros.busca)
  if (filtros.ord !== 'emissao') params.set('ord', filtros.ord)
  if (filtros.dir !== 'desc') params.set('dir', filtros.dir)
  if (filtros.pagina !== 1) params.set('pagina', String(filtros.pagina))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function pathFinanceiro(filtros: FiltrosFinanceiro): string {
  return `/financeiro/${filtros.aba}${serializarFiltros(filtros)}`
}
