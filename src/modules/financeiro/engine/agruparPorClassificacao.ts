import type { Lancamento } from '../types'

export function agruparPorClassificacao(lancamentos: Lancamento[]): Map<string, number> {
  const mapa = new Map<string, number>()
  for (const lancamento of lancamentos) {
    if (lancamento.deletadoEm) continue
    const atual = mapa.get(lancamento.classificacaoId) ?? 0
    mapa.set(lancamento.classificacaoId, atual + lancamento.valor)
  }
  return mapa
}
