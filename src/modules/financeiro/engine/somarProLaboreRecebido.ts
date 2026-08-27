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

export type ProLaboreDoCaso = {
  valorPago: number
  valorPendente: number
  status: 'pago' | 'nao_pago'
}

export function resumirProLaboreDoCaso(
  pagoCentavos: number,
  pendenteCentavos: number,
): ProLaboreDoCaso {
  return {
    valorPago: proLaboreCentavosParaReais(pagoCentavos),
    valorPendente: proLaboreCentavosParaReais(pendenteCentavos),
    status: pagoCentavos > 0 && pendenteCentavos === 0 ? 'pago' : 'nao_pago',
  }
}
