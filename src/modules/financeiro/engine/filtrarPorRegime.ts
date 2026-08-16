import type { Lancamento, Regime } from '../types'
import { dataNoIntervalo } from './datas'

export function filtrarPorRegime(
  lancamentos: Lancamento[],
  inicio: string,
  fim: string,
  regime: Regime,
): Lancamento[] {
  const resultado: Lancamento[] = []
  for (const lancamento of lancamentos) {
    if (lancamento.deletadoEm) continue
    if (regime === 'competencia') {
      if (dataNoIntervalo(lancamento.dataEmissao, inicio, fim)) resultado.push(lancamento)
      continue
    }
    if (lancamento.dataPagamento !== null && dataNoIntervalo(lancamento.dataPagamento, inicio, fim)) {
      resultado.push(lancamento)
    }
  }
  return resultado
}
