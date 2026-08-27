import { describe, expect, it } from 'vitest'
import type { Classificacao, Lancamento } from '../types'
import { agruparPorClassificacao } from './agruparPorClassificacao'
import { calcularDRE } from './calcularDRE'
import { calcularPeriodoAnterior } from './calcularPeriodoAnterior'
import { calcularResumoCaixa } from './calcularResumoCaixa'
import { addDias, hojeISO, isAnoCivil, isMesCivil, isTrimestreCivil, periodoDoAno, periodoDoMes, periodoDoTrimestre } from './datas'
import { derivarStatus } from './derivarStatus'
import { filtrarPorRegime } from './filtrarPorRegime'
import { margem, montarLinhasDRE } from './montarLinhasDRE'
import { classificacaoPorCodigo, mesclarPlanoContas, planoContasSeed } from './planoContas'
import { proLaboreCentavosParaReais, resumirProLaboreDoCaso, somarProLaboreRecebido } from './somarProLaboreRecebido'

const CLASSIFS = planoContasSeed()

function cls(codigo: string): Classificacao {
  const encontrada = CLASSIFS.find((c) => c.codigo === codigo)
  if (!encontrada) throw new Error(`classificação ${codigo} não encontrada`)
  return encontrada
}

function lancamento(parcial: Partial<Lancamento> & Pick<Lancamento, 'classificacaoId' | 'valor'>): Lancamento {
  const classificacao = CLASSIFS.find((c) => c.id === parcial.classificacaoId)
  return {
    id: parcial.id ?? 'l1',
    dataEmissao: parcial.dataEmissao ?? '2026-03-10',
    movimentacao: parcial.movimentacao ?? classificacao?.movimentacao ?? 'entrada',
    historico: parcial.historico ?? 'Lançamento de teste',
    classificacaoId: parcial.classificacaoId,
    valor: parcial.valor,
    vencimento: parcial.vencimento ?? parcial.dataEmissao ?? '2026-03-10',
    dataPagamento: parcial.dataPagamento === undefined ? null : parcial.dataPagamento,
    casoId: parcial.casoId,
    observacao: parcial.observacao,
    deletadoEm: parcial.deletadoEm ?? null,
    criadoEm: parcial.criadoEm ?? '2026-03-10T12:00:00.000Z',
    atualizadoEm: parcial.atualizadoEm ?? '2026-03-10T12:00:00.000Z',
  }
}

const MARCO = { inicio: '2026-03-01', fim: '2026-03-31' }
const ABRIL = { inicio: '2026-04-01', fim: '2026-04-30' }

describe('filtrarPorRegime e calcularDRE — regime', () => {
  const receita = lancamento({
    classificacaoId: cls('3.01.001').id,
    valor: 10_000,
    dataEmissao: '2026-03-10',
    dataPagamento: null,
    movimentacao: 'entrada',
  })

  it('inclui lançamento não liquidado na competência e o ignora no caixa', () => {
    const competencia = calcularDRE([receita], CLASSIFS, MARCO, 'competencia')
    const caixa = calcularDRE([receita], CLASSIFS, MARCO, 'caixa')
    expect(competencia.receitaBruta).toBe(10_000)
    expect(caixa.receitaBruta).toBe(0)
    expect(filtrarPorRegime([receita], MARCO.inicio, MARCO.fim, 'caixa')).toEqual([])
  })

  it('lançamento emitido em março e pago em abril conta no mês certo de cada regime', () => {
    const pagoEmAbril = { ...receita, dataPagamento: '2026-04-05' }
    expect(calcularDRE([pagoEmAbril], CLASSIFS, MARCO, 'competencia').receitaBruta).toBe(10_000)
    expect(calcularDRE([pagoEmAbril], CLASSIFS, MARCO, 'caixa').receitaBruta).toBe(0)
    expect(calcularDRE([pagoEmAbril], CLASSIFS, ABRIL, 'competencia').receitaBruta).toBe(0)
    expect(calcularDRE([pagoEmAbril], CLASSIFS, ABRIL, 'caixa').receitaBruta).toBe(10_000)
  })

  it('ignora lançamento com deletadoEm preenchido', () => {
    const apagado = { ...receita, deletadoEm: '2026-03-12T00:00:00.000Z' }
    expect(calcularDRE([apagado], CLASSIFS, MARCO, 'competencia').receitaBruta).toBe(0)
  })
})

describe('período sem lançamentos e divisão por zero', () => {
  it('devolve agregados zerados quando não há lançamentos', () => {
    const vazio = calcularDRE([], CLASSIFS, MARCO, 'competencia')
    expect(vazio.receitaBruta).toBe(0)
    expect(vazio.lucroLiquido).toBe(0)
    expect(vazio.porClassificacao.size).toBe(0)
  })

  it('variação é nula quando o período anterior é zero — nunca divide por zero', () => {
    const atual = calcularDRE(
      [lancamento({ classificacaoId: cls('3.01.001').id, valor: 5_000, movimentacao: 'entrada' })],
      CLASSIFS,
      MARCO,
      'competencia',
    )
    const anterior = calcularDRE([], CLASSIFS, { inicio: '2026-02-01', fim: '2026-02-28' }, 'competencia')
    const linhas = montarLinhasDRE(atual, anterior, CLASSIFS)
    const receita = linhas.find((l) => l.chave === 'receita_bruta')
    expect(receita?.variacao).toBeNull()
    expect(receita?.analiseVertical).toBe(1)
    expect(margem(atual.lucroLiquido, 0)).toBeNull()
    expect(margem(0, 0)).toBeNull()
  })

  it('análise vertical é 0 quando a receita bruta é 0', () => {
    const vazio = calcularDRE([], CLASSIFS, MARCO, 'competencia')
    const linhas = montarLinhasDRE(vazio, vazio, CLASSIFS)
    for (const linha of linhas) {
      expect(Number.isNaN(linha.analiseVertical)).toBe(false)
      expect(linha.analiseVertical).toBe(0)
    }
  })
})

describe('aporte de sócio excluído da DRE', () => {
  it('aparece no fluxo e some da receita bruta', () => {
    const aporte = lancamento({
      classificacaoId: cls('3.02.001').id,
      valor: 5_000_000,
      movimentacao: 'entrada',
      dataPagamento: '2026-03-10',
    })
    const dre = calcularDRE([aporte], CLASSIFS, MARCO, 'competencia')
    expect(dre.receitaBruta).toBe(0)
    expect(dre.lucroLiquido).toBe(0)
    const caixa = calcularResumoCaixa([aporte], 'caixa')
    expect(caixa.entradas).toBe(5_000_000)
    expect(caixa.saldo).toBe(5_000_000)
  })

  it('empréstimo / funding também fica de fora da DRE', () => {
    const funding = lancamento({
      classificacaoId: cls('3.02.002').id,
      valor: 1_000_000,
      movimentacao: 'entrada',
    })
    expect(calcularDRE([funding], CLASSIFS, MARCO, 'competencia').receitaBruta).toBe(0)
  })
})

describe('saída com valor positivo subtrai', () => {
  it('custo direto reduz o lucro bruto', () => {
    const receita = lancamento({
      id: 'r',
      classificacaoId: cls('3.01.001').id,
      valor: 50_000,
      movimentacao: 'entrada',
    })
    const custo = lancamento({
      id: 'c',
      classificacaoId: cls('4.01.001').id,
      valor: 10_000,
      movimentacao: 'saida',
    })
    const dre = calcularDRE([receita, custo], CLASSIFS, MARCO, 'competencia')
    expect(dre.custosDiretos).toBe(10_000)
    expect(dre.lucroBruto).toBe(40_000)
    expect(dre.receitaBruta).toBe(50_000)
  })
})

describe('calcularPeriodoAnterior — virada de mês e de ano', () => {
  it('março/2026 → fevereiro/2026 (28 dias)', () => {
    expect(calcularPeriodoAnterior(periodoDoMes(2026, 3))).toEqual({
      inicio: '2026-02-01',
      fim: '2026-02-28',
    })
  })

  it('janeiro/2026 → dezembro/2025', () => {
    expect(calcularPeriodoAnterior(periodoDoMes(2026, 1))).toEqual({
      inicio: '2025-12-01',
      fim: '2025-12-31',
    })
  })

  it('março/2024 → fevereiro/2024 (29 dias, bissexto)', () => {
    expect(calcularPeriodoAnterior(periodoDoMes(2024, 3))).toEqual({
      inicio: '2024-02-01',
      fim: '2024-02-29',
    })
  })

  it('2º trimestre → 1º trimestre', () => {
    expect(calcularPeriodoAnterior(periodoDoTrimestre(2026, 2))).toEqual(periodoDoTrimestre(2026, 1))
  })

  it('1º trimestre → 4º do ano anterior', () => {
    expect(calcularPeriodoAnterior(periodoDoTrimestre(2026, 1))).toEqual(periodoDoTrimestre(2025, 4))
  })

  it('ano 2026 → 2025', () => {
    expect(calcularPeriodoAnterior(periodoDoAno(2026))).toEqual(periodoDoAno(2025))
  })

  it('intervalo customizado de 10 dias usa os 10 dias imediatamente anteriores', () => {
    expect(calcularPeriodoAnterior({ inicio: '2026-03-10', fim: '2026-03-19' })).toEqual({
      inicio: '2026-02-28',
      fim: '2026-03-09',
    })
    expect(addDias('2026-03-10', -1)).toBe('2026-03-09')
  })
})

describe('fórmulas da DRE', () => {
  it('encadeia receita líquida, lucro bruto, ebitda e lucro líquido', () => {
    const ls = [
      lancamento({ id: '1', classificacaoId: '3.01.001', valor: 100_000, movimentacao: 'entrada' }),
      lancamento({ id: '2', classificacaoId: '4.03.001', valor: 10_000, movimentacao: 'saida' }),
      lancamento({ id: '3', classificacaoId: '4.01.002', valor: 20_000, movimentacao: 'saida' }),
      lancamento({ id: '4', classificacaoId: '4.02.002', valor: 15_000, movimentacao: 'saida' }),
      lancamento({ id: '5', classificacaoId: '4.03.004', valor: 2_000, movimentacao: 'saida' }),
      lancamento({ id: '6', classificacaoId: '4.03.002', valor: 3_000, movimentacao: 'saida' }),
      lancamento({ id: '7', classificacaoId: '4.03.005', valor: 5_000, movimentacao: 'saida' }),
    ]
    const dre = calcularDRE(ls, CLASSIFS, MARCO, 'competencia')
    expect(dre.receitaBruta).toBe(100_000)
    expect(dre.impostosSobreReceita).toBe(10_000)
    expect(dre.receitaLiquida).toBe(90_000)
    expect(dre.custosDiretos).toBe(20_000)
    expect(dre.lucroBruto).toBe(70_000)
    expect(dre.despesasOperacionais).toBe(15_000)
    expect(dre.ebitda).toBe(55_000)
    expect(dre.depreciacao).toBe(2_000)
    expect(dre.resultadoFinanceiro).toBe(-3_000)
    expect(dre.irCsll).toBe(5_000)
    expect(dre.lucroLiquido).toBe(45_000)
  })

  it('pró-labore de entrada entra na receita bruta, não na despesa operacional', () => {
    const ls = [
      lancamento({ id: 'pl', classificacaoId: cls('3.01.005').id, valor: 2_500, movimentacao: 'entrada' }),
      lancamento({ id: 'pessoal', classificacaoId: cls('4.02.002').id, valor: 1_000, movimentacao: 'saida' }),
    ]
    const dre = calcularDRE(ls, CLASSIFS, MARCO, 'competencia')
    expect(dre.receitaBruta).toBe(2_500)
    expect(dre.despesasOperacionais).toBe(1_000)
  })

  it('resultado financeiro soma entradas e subtrai saídas do grupo', () => {
    const jurosRecebidos: Classificacao = {
      id: '4.03.010',
      codigo: '4.03.010',
      nome: 'Rendimentos financeiros',
      movimentacao: 'entrada',
      grupoDRE: 'resultado_financeiro',
      ordem: 506,
      ativa: true,
      sistema: false,
    }
    const ls = [
      lancamento({ id: 'e', classificacaoId: jurosRecebidos.id, valor: 8_000, movimentacao: 'entrada' }),
      lancamento({ id: 's', classificacaoId: '4.03.003', valor: 3_000, movimentacao: 'saida' }),
    ]
    const dre = calcularDRE(ls, [...CLASSIFS, jurosRecebidos], MARCO, 'competencia')
    expect(dre.resultadoFinanceiro).toBe(5_000)
  })
})

describe('montarLinhasDRE', () => {
  it('omite detalhe zerado nos dois períodos e mostra zero explícito se um lado tem valor', () => {
    const atualLs = [
      lancamento({ id: 'r', classificacaoId: '3.01.001', valor: 10_000, movimentacao: 'entrada' }),
      lancamento({ id: 'c', classificacaoId: '4.01.001', valor: 1_000, movimentacao: 'saida' }),
    ]
    const anteriorLs = [
      lancamento({
        id: 'r0',
        classificacaoId: '3.01.002',
        valor: 4_000,
        movimentacao: 'entrada',
        dataEmissao: '2026-02-10',
        vencimento: '2026-02-10',
      }),
    ]
    const atual = calcularDRE(atualLs, CLASSIFS, MARCO, 'competencia')
    const anterior = calcularDRE(anteriorLs, CLASSIFS, { inicio: '2026-02-01', fim: '2026-02-28' }, 'competencia')
    const linhas = montarLinhasDRE(atual, anterior, CLASSIFS)
    const cessao = linhas.find((l) => l.classificacaoId === '3.01.001')
    const exito = linhas.find((l) => l.classificacaoId === '3.01.002')
    const upside = linhas.find((l) => l.classificacaoId === '3.01.003')
    expect(cessao?.valor).toBe(10_000)
    expect(cessao?.valorAnterior).toBe(0)
    expect(exito?.valor).toBe(0)
    expect(exito?.valorAnterior).toBe(4_000)
    expect(upside).toBeUndefined()
    expect(linhas.some((l) => l.chave === 'lucro_liquido' && l.destaque)).toBe(true)
  })

  it('calcula variação percentual contra o período anterior', () => {
    const atual = calcularDRE(
      [lancamento({ classificacaoId: '3.01.001', valor: 12_000, movimentacao: 'entrada' })],
      CLASSIFS,
      MARCO,
      'competencia',
    )
    const anterior = calcularDRE(
      [
        lancamento({
          classificacaoId: '3.01.001',
          valor: 10_000,
          movimentacao: 'entrada',
          dataEmissao: '2026-02-10',
          vencimento: '2026-02-10',
        }),
      ],
      CLASSIFS,
      { inicio: '2026-02-01', fim: '2026-02-28' },
      'competencia',
    )
    const linhas = montarLinhasDRE(atual, anterior, CLASSIFS)
    const receita = linhas.find((l) => l.chave === 'receita_bruta')
    expect(receita?.variacao).toBeCloseTo(0.2)
  })
})

describe('agruparPorClassificacao e resumo de caixa', () => {
  it('soma valores positivos por classificação', () => {
    const ls = [
      lancamento({ id: 'a', classificacaoId: '3.01.001', valor: 100, movimentacao: 'entrada' }),
      lancamento({ id: 'b', classificacaoId: '3.01.001', valor: 50, movimentacao: 'entrada' }),
      lancamento({ id: 'c', classificacaoId: '4.01.001', valor: 30, movimentacao: 'saida' }),
    ]
    const mapa = agruparPorClassificacao(ls)
    expect(mapa.get('3.01.001')).toBe(150)
    expect(mapa.get('4.01.001')).toBe(30)
  })

  it('em competência, a receber e a pagar são os não liquidados', () => {
    const ls = [
      lancamento({
        id: 'e',
        classificacaoId: '3.01.001',
        valor: 8_000,
        movimentacao: 'entrada',
        dataPagamento: null,
      }),
      lancamento({
        id: 's',
        classificacaoId: '4.02.001',
        valor: 2_000,
        movimentacao: 'saida',
        dataPagamento: null,
      }),
    ]
    const resumo = calcularResumoCaixa(ls, 'competencia')
    expect(resumo.entradas).toBe(8_000)
    expect(resumo.saidas).toBe(2_000)
    expect(resumo.saldo).toBe(6_000)
    expect(resumo.aReceber).toBe(8_000)
    expect(resumo.aPagar).toBe(2_000)
  })

  it('em caixa, conta só liquidados e zera a receber / a pagar', () => {
    const ls = [
      lancamento({
        id: 'liq',
        classificacaoId: '3.01.001',
        valor: 8_000,
        movimentacao: 'entrada',
        dataPagamento: '2026-03-12',
      }),
      lancamento({
        id: 'pend',
        classificacaoId: '3.01.001',
        valor: 1_000,
        movimentacao: 'entrada',
        dataPagamento: null,
      }),
    ]
    const resumo = calcularResumoCaixa(ls, 'caixa')
    expect(resumo.entradas).toBe(8_000)
    expect(resumo.aReceber).toBe(0)
    expect(resumo.aPagar).toBe(0)
  })
})

describe('derivarStatus', () => {
  it('pago, pendente e atrasado', () => {
    const hoje = '2026-08-16'
    expect(
      derivarStatus(lancamento({ classificacaoId: '3.01.001', valor: 1, dataPagamento: '2026-08-01' }), hoje),
    ).toBe('pago')
    expect(
      derivarStatus(
        lancamento({ classificacaoId: '3.01.001', valor: 1, dataPagamento: null, vencimento: '2026-08-20' }),
        hoje,
      ),
    ).toBe('pendente')
    expect(
      derivarStatus(
        lancamento({ classificacaoId: '3.01.001', valor: 1, dataPagamento: null, vencimento: '2026-08-01' }),
        hoje,
      ),
    ).toBe('atrasado')
  })
})

describe('ramos restantes da engine', () => {
  it('ignora classificação desconhecida e movimentação invertida no grupo', () => {
    const invertidos = [
      lancamento({ id: 'x1', classificacaoId: 'inexistente', valor: 9_999, movimentacao: 'entrada' }),
      lancamento({ id: 'x2', classificacaoId: '3.01.001', valor: 100, movimentacao: 'saida' }),
      lancamento({ id: 'x3', classificacaoId: '4.03.001', valor: 100, movimentacao: 'entrada' }),
      lancamento({ id: 'x4', classificacaoId: '4.01.001', valor: 100, movimentacao: 'entrada' }),
      lancamento({ id: 'x5', classificacaoId: '4.02.001', valor: 100, movimentacao: 'entrada' }),
      lancamento({ id: 'x6', classificacaoId: '4.03.004', valor: 100, movimentacao: 'entrada' }),
      lancamento({ id: 'x7', classificacaoId: '4.03.005', valor: 100, movimentacao: 'entrada' }),
    ]
    const dre = calcularDRE(invertidos, CLASSIFS, MARCO, 'competencia')
    expect(dre.receitaBruta).toBe(0)
    expect(dre.impostosSobreReceita).toBe(0)
    expect(dre.custosDiretos).toBe(0)
    expect(dre.despesasOperacionais).toBe(0)
    expect(dre.depreciacao).toBe(0)
    expect(dre.irCsll).toBe(0)
  })

  it('agrupa ignorando soft delete e resumo ignora deletados', () => {
    const vivo = lancamento({ id: 'v', classificacaoId: '3.01.001', valor: 100, movimentacao: 'entrada' })
    const morto = lancamento({
      id: 'm',
      classificacaoId: '3.01.001',
      valor: 50,
      movimentacao: 'entrada',
      deletadoEm: '2026-03-11T00:00:00.000Z',
    })
    expect(agruparPorClassificacao([vivo, morto]).get('3.01.001')).toBe(100)
    const resumo = calcularResumoCaixa(
      [
        morto,
        lancamento({
          id: 'p',
          classificacaoId: '4.02.001',
          valor: 40,
          movimentacao: 'saida',
          dataPagamento: '2026-03-10',
        }),
      ],
      'competencia',
    )
    expect(resumo.entradas).toBe(0)
    expect(resumo.saidas).toBe(40)
    expect(resumo.aPagar).toBe(0)
  })

  it('emite linhas de imposto/depreciação/IR quando há valor e calcula margem', () => {
    const ls = [
      lancamento({ id: '1', classificacaoId: '3.01.001', valor: 100_000, movimentacao: 'entrada' }),
      lancamento({ id: '2', classificacaoId: '4.03.001', valor: 10_000, movimentacao: 'saida' }),
      lancamento({ id: '5', classificacaoId: '4.03.004', valor: 2_000, movimentacao: 'saida' }),
      lancamento({ id: '6', classificacaoId: '4.03.002', valor: 3_000, movimentacao: 'saida' }),
      lancamento({ id: '7', classificacaoId: '4.03.005', valor: 5_000, movimentacao: 'saida' }),
    ]
    const atual = calcularDRE(ls, CLASSIFS, MARCO, 'competencia')
    const anterior = calcularDRE([], CLASSIFS, { inicio: '2026-02-01', fim: '2026-02-28' }, 'competencia')
    const linhas = montarLinhasDRE(atual, anterior, CLASSIFS)
    expect(linhas.find((l) => l.chave === 'imposto_sobre_receita')?.valor).toBe(10_000)
    expect(linhas.find((l) => l.chave === 'depreciacao')?.valor).toBe(2_000)
    expect(linhas.find((l) => l.chave === 'ir_csll')?.valor).toBe(5_000)
    expect(linhas.find((l) => l.chave === 'resultado_financeiro')?.valor).toBe(-3_000)
    expect(margem(atual.lucroLiquido, atual.receitaBruta)).toBeCloseTo(atual.lucroLiquido / 100_000)
  })

  it('helpers de data: hojeISO, identificação civil e classificacaoPorCodigo', () => {
    expect(hojeISO(new Date(2026, 7, 16))).toBe('2026-08-16')
    expect(isMesCivil({ inicio: '2026-03-10', fim: '2026-03-31' })).toBe(false)
    expect(isTrimestreCivil({ inicio: '2026-02-01', fim: '2026-04-30' })).toBe(false)
    expect(isTrimestreCivil({ inicio: '2026-01-15', fim: '2026-03-31' })).toBe(false)
    expect(isAnoCivil({ inicio: '2026-01-01', fim: '2026-11-30' })).toBe(false)
    expect(classificacaoPorCodigo(CLASSIFS, '3.01.001')?.nome).toBe('Cessão de crédito')
    expect(classificacaoPorCodigo(CLASSIFS, '3.01.005')).toMatchObject({
      nome: 'Pró-labore',
      movimentacao: 'entrada',
      grupoDRE: 'receita_bruta',
    })
    expect(classificacaoPorCodigo(CLASSIFS, '99')).toBeUndefined()
    const extra: Classificacao = {
      id: '9.99.001',
      codigo: '9.99.001',
      nome: 'Aluguel excepcional',
      movimentacao: 'saida',
      grupoDRE: 'despesa_operacional',
      ordem: 999,
      ativa: true,
      sistema: false,
    }
    const merged = mesclarPlanoContas([extra])
    expect(merged.find((c) => c.codigo === '3.01.001')?.sistema).toBe(true)
    expect(merged.find((c) => c.id === '9.99.001')?.nome).toBe('Aluguel excepcional')
    expect(
      filtrarPorRegime(
        [lancamento({ classificacaoId: '3.01.001', valor: 1, dataEmissao: '2026-01-01' })],
        MARCO.inicio,
        MARCO.fim,
        'competencia',
      ),
    ).toEqual([])
  })
})

describe('somarProLaboreRecebido', () => {
  it('soma só entradas da conta de pró-labore e ignora o restante', () => {
    const lancamentos = [
      lancamento({ id: 'pl1', classificacaoId: cls('3.01.005').id, valor: 250_000, movimentacao: 'entrada' }),
      lancamento({ id: 'pl2', classificacaoId: cls('3.01.005').id, valor: 250_000, movimentacao: 'entrada' }),
      lancamento({ id: 'honorarios', classificacaoId: cls('3.01.002').id, valor: 100_000, movimentacao: 'entrada' }),
      lancamento({ id: 'pessoal', classificacaoId: cls('4.02.002').id, valor: 80_000, movimentacao: 'saida' }),
      lancamento({
        id: 'apagado',
        classificacaoId: cls('3.01.005').id,
        valor: 250_000,
        movimentacao: 'entrada',
        deletadoEm: '2026-03-12T00:00:00.000Z',
      }),
    ]
    expect(somarProLaboreRecebido(lancamentos)).toBe(500_000)
    expect(proLaboreCentavosParaReais(500_000)).toBe(5_000)
  })

  it('marca pró-labore do caso como pago só quando não há pendência', () => {
    expect(resumirProLaboreDoCaso(0, 0)).toEqual({
      valorPago: 0,
      valorPendente: 0,
      status: 'nao_pago',
    })
    expect(resumirProLaboreDoCaso(500_000, 0)).toEqual({
      valorPago: 5_000,
      valorPendente: 0,
      status: 'pago',
    })
    expect(resumirProLaboreDoCaso(300_000, 200_000)).toEqual({
      valorPago: 3_000,
      valorPendente: 2_000,
      status: 'nao_pago',
    })
  })

  it('devolve zero quando não há pró-labore cadastrado', () => {
    expect(somarProLaboreRecebido([])).toBe(0)
    expect(
      somarProLaboreRecebido([
        lancamento({ classificacaoId: cls('3.01.001').id, valor: 10_000, movimentacao: 'entrada' }),
      ]),
    ).toBe(0)
  })
})
