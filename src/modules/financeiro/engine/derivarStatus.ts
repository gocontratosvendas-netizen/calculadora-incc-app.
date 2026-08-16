import type { Lancamento, StatusLancamento } from '../types'

export function derivarStatus(lancamento: Lancamento, hoje: string): StatusLancamento {
  if (lancamento.dataPagamento !== null) return 'pago'
  if (lancamento.vencimento < hoje) return 'atrasado'
  return 'pendente'
}
