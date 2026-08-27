import { describe, expect, it } from 'vitest'
import {
  calcularResumoCarteira,
  calcularResumoFinanceiro,
  casoEntraNaCarteiraJudicial,
  honorariosExitoDoCaso,
  pessoasDoCaso,
  rotuloResponsaveis,
  HONORARIOS_EXITO_PERCENTUAL,
  PERCENTUAL_EXITO_PADRAO,
  type Caso,
  type CasoStatus,
  type PessoaCaso,
} from './casos'

function caso(parcial: Partial<Caso> & Pick<Caso, 'status'>): Caso {
  const responsavel: PessoaCaso = parcial.responsavel ?? { id: 'ana', nome: 'Ana', iniciais: 'AN' }
  return {
    id: parcial.id ?? 'caso',
    cliente: parcial.cliente ?? 'Cliente',
    empreendimento: parcial.empreendimento ?? 'Empreendimento',
    incorporadora: parcial.incorporadora ?? 'Incorporadora',
    valorContrato: parcial.valorContrato ?? 100_000,
    excessoApurado: parcial.excessoApurado ?? null,
    valorCausa: parcial.valorCausa ?? null,
    percentualExito: parcial.percentualExito ?? PERCENTUAL_EXITO_PADRAO,
    anoAjuizamento: parcial.anoAjuizamento ?? null,
    status: parcial.status,
    responsavel,
    responsaveis: parcial.responsaveis ?? [responsavel],
    atualizadoEm: parcial.atualizadoEm ?? '2026-08-24T12:00:00.000Z',
  }
}

describe('carteira judicial', () => {
  it('só entra nos gráficos a partir da confecção de petição inicial', () => {
    const status: CasoStatus[] = [
      'stand_by',
      'processo_de_venda',
      'confeccao_de_peticao_inicial',
      'ajuizado',
      'encerrado',
    ]
    expect(status.map(casoEntraNaCarteiraJudicial)).toEqual([false, false, true, true, true])
  })

  it('ignora processo de venda nos indicadores da carteira', () => {
    const standBy = caso({
      id: 'standby',
      status: 'stand_by',
      valorCausa: 50_000,
      excessoApurado: 25_000,
    })
    const venda = caso({
      id: 'venda',
      status: 'processo_de_venda',
      valorCausa: 280_496,
      excessoApurado: 140_248,
    })
    const peticao = caso({
      id: 'peticao',
      status: 'confeccao_de_peticao_inicial',
      valorCausa: 80_000,
      excessoApurado: 40_000,
    })
    const ajuizado = caso({
      id: 'ajuizado',
      status: 'ajuizado',
      valorCausa: 20_000,
      excessoApurado: 10_000,
    })
    const encerrado = caso({
      id: 'encerrado',
      status: 'encerrado',
      valorCausa: 10_000,
      excessoApurado: 5_000,
    })

    expect(calcularResumoCarteira([standBy, venda, peticao, ajuizado, encerrado])).toEqual({
      casosCadastrados: 3,
      emAndamento: 2,
      valorTotalCausa: 110_000,
      excessoTotalCarteira: 55_000,
      recuperado: 5_000,
    })
    expect(calcularResumoFinanceiro([standBy, venda, peticao, ajuizado, encerrado], 5_000)).toEqual({
      proLaboreRecebido: 5_000,
      honorariosExitoEsperados: 110_000 * HONORARIOS_EXITO_PERCENTUAL,
    })
  })

  it('zera os gráficos quando a carteira ainda está só em processo de venda', () => {
    const casos = [
      caso({ status: 'processo_de_venda', valorCausa: 280_496, excessoApurado: 140_248 }),
      caso({ id: 'outro', status: 'processo_de_venda', valorCausa: 50_000, excessoApurado: 20_000 }),
    ]
    expect(calcularResumoCarteira(casos)).toEqual({
      casosCadastrados: 0,
      emAndamento: 0,
      valorTotalCausa: 0,
      excessoTotalCarteira: 0,
      recuperado: 0,
    })
    expect(calcularResumoFinanceiro(casos)).toEqual({
      proLaboreRecebido: 0,
      honorariosExitoEsperados: 0,
    })
  })

  it('calcula honorários de êxito pelo percentual de cada caso', () => {
    expect(honorariosExitoDoCaso(100_000, 10)).toBe(10_000)
    expect(honorariosExitoDoCaso(100_000, 20)).toBe(20_000)
    expect(honorariosExitoDoCaso(100_000, PERCENTUAL_EXITO_PADRAO)).toBe(30_000)
    expect(honorariosExitoDoCaso(null, 20)).toBeNull()

    const casos = [
      caso({ status: 'ajuizado', valorCausa: 100_000, percentualExito: 10 }),
      caso({ id: 'outro', status: 'ajuizado', valorCausa: 50_000, percentualExito: 20 }),
    ]
    expect(calcularResumoFinanceiro(casos).honorariosExitoEsperados).toBe(20_000)
  })
})

describe('responsáveis do caso', () => {
  it('usa a lista quando há um ou mais responsáveis', () => {
    const unico = caso({ status: 'ajuizado' })
    expect(pessoasDoCaso(unico)).toEqual([unico.responsavel])
    expect(rotuloResponsaveis(pessoasDoCaso(unico))).toBe('Ana')

    const varios = caso({
      status: 'ajuizado',
      responsaveis: [
        { id: 'vitor', nome: 'Vitor P.', iniciais: 'VP' },
        { id: 'rafaela', nome: 'Rafaela Moura', iniciais: 'RM' },
      ],
    })
    expect(pessoasDoCaso(varios)).toHaveLength(2)
    expect(rotuloResponsaveis(pessoasDoCaso(varios))).toBe('Vitor P., Rafaela Moura')
  })

  it('cai no responsável principal quando a lista vem vazia', () => {
    const semLista = caso({ status: 'ajuizado', responsaveis: [] })
    expect(pessoasDoCaso(semLista)).toEqual([semLista.responsavel])
  })
})
