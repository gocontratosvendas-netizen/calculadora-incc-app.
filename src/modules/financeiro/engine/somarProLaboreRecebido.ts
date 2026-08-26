import type { Lancamento } from '../types'
import { CLASSIFICACAO_PRO_LABORE_RECEITA } from './planoContas'

/** Soma em centavos os recebimentos de pró-labore cadastrados na área financeira. */
export function somarProLaboreRecebido(lancamentos: Lancamento[]): number {
  let total = 0
  for (const lancamento of lancamentos) {
    if (lancamento.deletadoEm) continue
    if (lancamento.movimentacao !== 'entrada') continue
    if (lancamento.classificacaoId !== CLASSIFICACAO_PRO_LABORE_RECEITA) continue
    total += lancamento.valor
  }
  return total
}

export function proLaboreCentavosParaReais(centavos: number): number {
  return centavos / 100
}
