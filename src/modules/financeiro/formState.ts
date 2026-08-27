import { mascararCentavos } from './data/moeda'
import { hojeISO } from './engine/datas'
import type { Lancamento, Movimentacao } from './types'

export type FormLancamentoValues = {
  dataEmissao: string
  movimentacao: Movimentacao
  historico: string
  classificacaoId: string
  valorTexto: string
  vencimento: string
  dataPagamento: string
  casoId: string
}

export function formInicial(hoje = hojeISO()): FormLancamentoValues {
  return {
    dataEmissao: hoje,
    movimentacao: 'entrada',
    historico: '',
    classificacaoId: '',
    valorTexto: '',
    vencimento: hoje,
    dataPagamento: '',
    casoId: '',
  }
}

export function valuesFromLancamento(l: Lancamento): FormLancamentoValues {
  return {
    ...formInicial(),
    dataEmissao: hojeISO(),
    movimentacao: l.movimentacao,
    historico: l.historico,
    classificacaoId: l.classificacaoId,
    valorTexto: mascararCentavos(l.valor),
    vencimento: l.vencimento,
    dataPagamento: '',
    casoId: l.casoId ?? '',
  }
}
