import type { Lancamento, Regime, ResumoCaixa } from '../types'

export function calcularResumoCaixa(lancamentos: Lancamento[], regime: Regime): ResumoCaixa {
  const base =
    regime === 'caixa'
      ? lancamentos.filter((l) => !l.deletadoEm && l.dataPagamento !== null)
      : lancamentos.filter((l) => !l.deletadoEm)

  let entradas = 0
  let saidas = 0
  let aReceber = 0
  let aPagar = 0

  for (const lancamento of base) {
    if (lancamento.movimentacao === 'entrada') {
      entradas += lancamento.valor
      if (lancamento.dataPagamento === null) aReceber += lancamento.valor
    } else {
      saidas += lancamento.valor
      if (lancamento.dataPagamento === null) aPagar += lancamento.valor
    }
  }

  if (regime === 'caixa') {
    aReceber = 0
    aPagar = 0
  }

  return {
    entradas,
    saidas,
    saldo: entradas - saidas,
    aReceber,
    aPagar,
  }
}
