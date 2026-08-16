import type { Classificacao, GrupoDRE, Lancamento, Periodo, Regime, ResultadoDRE } from '../types'
import { filtrarPorRegime } from './filtrarPorRegime'

function vazio(): ResultadoDRE {
  return {
    receitaBruta: 0,
    impostosSobreReceita: 0,
    receitaLiquida: 0,
    custosDiretos: 0,
    lucroBruto: 0,
    despesasOperacionais: 0,
    ebitda: 0,
    depreciacao: 0,
    resultadoFinanceiro: 0,
    irCsll: 0,
    lucroLiquido: 0,
    porClassificacao: new Map(),
  }
}

function somar(lancamentos: Lancamento[], classificacoes: Classificacao[]): ResultadoDRE {
  const porId = new Map(classificacoes.map((c) => [c.id, c]))
  const resultado = vazio()

  for (const lancamento of lancamentos) {
    const classificacao = porId.get(lancamento.classificacaoId)
    const grupo: GrupoDRE | null | undefined = classificacao?.grupoDRE
    if (!classificacao || grupo == null) continue

    const atualClass = resultado.porClassificacao.get(lancamento.classificacaoId) ?? 0
    resultado.porClassificacao.set(lancamento.classificacaoId, atualClass + lancamento.valor)

    switch (grupo) {
      case 'receita_bruta':
        if (lancamento.movimentacao === 'entrada') resultado.receitaBruta += lancamento.valor
        break
      case 'imposto_sobre_receita':
        if (lancamento.movimentacao === 'saida') resultado.impostosSobreReceita += lancamento.valor
        break
      case 'custo_direto':
        if (lancamento.movimentacao === 'saida') resultado.custosDiretos += lancamento.valor
        break
      case 'despesa_operacional':
        if (lancamento.movimentacao === 'saida') resultado.despesasOperacionais += lancamento.valor
        break
      case 'depreciacao':
        if (lancamento.movimentacao === 'saida') resultado.depreciacao += lancamento.valor
        break
      case 'resultado_financeiro':
        resultado.resultadoFinanceiro +=
          lancamento.movimentacao === 'entrada' ? lancamento.valor : -lancamento.valor
        break
      case 'ir_csll':
        if (lancamento.movimentacao === 'saida') resultado.irCsll += lancamento.valor
        break
    }
  }

  resultado.receitaLiquida = resultado.receitaBruta - resultado.impostosSobreReceita
  resultado.lucroBruto = resultado.receitaLiquida - resultado.custosDiretos
  resultado.ebitda = resultado.lucroBruto - resultado.despesasOperacionais
  resultado.lucroLiquido =
    resultado.ebitda - resultado.depreciacao + resultado.resultadoFinanceiro - resultado.irCsll

  return resultado
}

export function calcularDRE(
  lancamentos: Lancamento[],
  classificacoes: Classificacao[],
  periodo: Periodo,
  regime: Regime,
): ResultadoDRE {
  const filtrados = filtrarPorRegime(lancamentos, periodo.inicio, periodo.fim, regime)
  return somar(filtrados, classificacoes)
}
