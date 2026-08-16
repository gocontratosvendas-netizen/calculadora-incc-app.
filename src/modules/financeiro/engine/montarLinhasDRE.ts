import type { Classificacao, GrupoDRE, LinhaDRE, ResultadoDRE } from '../types'

function razao(numerador: number, denominador: number): number {
  if (denominador === 0) return 0
  return numerador / denominador
}

function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return (atual - anterior) / Math.abs(anterior)
}

function detalhesDoGrupo(
  grupo: GrupoDRE,
  classificacoes: Classificacao[],
  atual: ResultadoDRE,
  anterior: ResultadoDRE,
  sentido: LinhaDRE['sentido'],
): LinhaDRE[] {
  const doGrupo = classificacoes
    .filter((c) => c.grupoDRE === grupo)
    .sort((a, b) => a.ordem - b.ordem || a.codigo.localeCompare(b.codigo))

  const linhas: LinhaDRE[] = []
  for (const classificacao of doGrupo) {
    const valor = atual.porClassificacao.get(classificacao.id) ?? 0
    const valorAnterior = anterior.porClassificacao.get(classificacao.id) ?? 0
    if (valor === 0 && valorAnterior === 0) continue
    linhas.push({
      rotulo: classificacao.nome,
      valor,
      analiseVertical: razao(valor, atual.receitaBruta),
      valorAnterior,
      variacao: variacao(valor, valorAnterior),
      nivel: 'detalhe',
      chave: `class:${classificacao.id}`,
      sentido,
      classificacaoId: classificacao.id,
      grupoDRE: grupo,
    })
  }
  return linhas
}

function pushDetalheGrupo(
  linhas: LinhaDRE[],
  rotulo: string,
  valor: number,
  valorAnterior: number,
  receitaBruta: number,
  grupo: GrupoDRE,
  sentido: LinhaDRE['sentido'],
) {
  if (valor === 0 && valorAnterior === 0) return
  linhas.push(
    linha(rotulo, valor, valorAnterior, receitaBruta, 'detalhe', grupo, sentido, { grupoDRE: grupo }),
  )
}

function linha(
  rotulo: string,
  valor: number,
  valorAnterior: number,
  receitaBruta: number,
  nivel: LinhaDRE['nivel'],
  chave: string,
  sentido: LinhaDRE['sentido'],
  extra: Partial<LinhaDRE> = {},
): LinhaDRE {
  return {
    rotulo,
    valor,
    analiseVertical: razao(valor, receitaBruta),
    valorAnterior,
    variacao: variacao(valor, valorAnterior),
    nivel,
    chave,
    sentido,
    ...extra,
  }
}

export function montarLinhasDRE(
  atual: ResultadoDRE,
  anterior: ResultadoDRE,
  classificacoes: Classificacao[],
): LinhaDRE[] {
  const rb = atual.receitaBruta
  const linhas: LinhaDRE[] = []

  linhas.push(
    linha('Receita bruta', atual.receitaBruta, anterior.receitaBruta, rb, 'total', 'receita_bruta', 'resultado', {
      grupoDRE: 'receita_bruta',
    }),
  )
  linhas.push(...detalhesDoGrupo('receita_bruta', classificacoes, atual, anterior, 'resultado'))

  pushDetalheGrupo(
    linhas,
    '(−) Impostos sobre receita',
    atual.impostosSobreReceita,
    anterior.impostosSobreReceita,
    rb,
    'imposto_sobre_receita',
    'despesa',
  )

  linhas.push(
    linha(
      '= Receita líquida',
      atual.receitaLiquida,
      anterior.receitaLiquida,
      rb,
      'subtotal',
      'receita_liquida',
      'resultado',
    ),
  )

  linhas.push(
    linha(
      'Custos diretos',
      atual.custosDiretos,
      anterior.custosDiretos,
      rb,
      'subtotal',
      'custo_direto',
      'despesa',
      { grupoDRE: 'custo_direto' },
    ),
  )
  linhas.push(...detalhesDoGrupo('custo_direto', classificacoes, atual, anterior, 'despesa'))

  linhas.push(
    linha('= Lucro bruto', atual.lucroBruto, anterior.lucroBruto, rb, 'subtotal', 'lucro_bruto', 'resultado'),
  )

  linhas.push(
    linha(
      'Despesas operacionais',
      atual.despesasOperacionais,
      anterior.despesasOperacionais,
      rb,
      'subtotal',
      'despesa_operacional',
      'despesa',
      { grupoDRE: 'despesa_operacional' },
    ),
  )
  linhas.push(...detalhesDoGrupo('despesa_operacional', classificacoes, atual, anterior, 'despesa'))

  linhas.push(linha('= EBITDA', atual.ebitda, anterior.ebitda, rb, 'subtotal', 'ebitda', 'resultado'))

  pushDetalheGrupo(
    linhas,
    '(−) Depreciação e amortização',
    atual.depreciacao,
    anterior.depreciacao,
    rb,
    'depreciacao',
    'despesa',
  )
  pushDetalheGrupo(
    linhas,
    '(±) Resultado financeiro',
    atual.resultadoFinanceiro,
    anterior.resultadoFinanceiro,
    rb,
    'resultado_financeiro',
    'resultado',
  )
  pushDetalheGrupo(
    linhas,
    '(−) IRPJ e CSLL',
    atual.irCsll,
    anterior.irCsll,
    rb,
    'ir_csll',
    'despesa',
  )

  linhas.push(
    linha(
      '= Lucro líquido do período',
      atual.lucroLiquido,
      anterior.lucroLiquido,
      rb,
      'total',
      'lucro_liquido',
      'resultado',
      { destaque: true },
    ),
  )

  return linhas
}

export function margem(numerador: number, receitaBruta: number): number | null {
  if (receitaBruta === 0) return null
  return numerador / receitaBruta
}
