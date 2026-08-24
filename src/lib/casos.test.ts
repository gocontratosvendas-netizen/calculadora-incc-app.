import { describe, expect, it } from 'vitest'
import {
  calcularResumoCarteira,
  calcularResumoFinanceiro,
  casoEntraNaCarteiraJudicial,
  HONORARIOS_EXITO_PERCENTUAL,
  PRO_LABORE_POR_AJUIZAMENTO,
  type Caso,
  type CasoStatus,
} from './casos'

function caso(parcial: Partial<Caso> & Pick<Caso, 'status'>): Caso {
  return {
    id: parcial.id ?? 'caso',
    cliente: parcial.cliente ?? 'Cliente',
    empreendimento: parcial.empreendimento ?? 'Empreendimento',
    incorporadora: parcial.incorporadora ?? 'Incorporadora',
    valorContrato: parcial.valorContrato ?? 100_000,
    excessoApurado: parcial.excessoApurado ?? null,
    valorCausa: parcial.valorCausa ?? null,
    anoAjuizamento: parcial.anoAjuizamento ?? null,
    status: parcial.status,
    responsavel: parcial.responsavel ?? { nome: 'Ana', iniciais: 'AN' },
    atualizadoEm: parcial.atualizadoEm ?? '2026-08-24T12:00:00.000Z',
  }
}

describe('carteira judicial', () => {
  it('só entra nos gráficos a partir da confecção de petição inicial', () => {
    const status: CasoStatus[] = [
      'processo_de_venda',
      'confeccao_de_peticao_inicial',
      'ajuizado',
      'encerrado',
    ]
    expect(status.map(casoEntraNaCarteiraJudicial)).toEqual([false, true, true, true])
  })

  it('ignora processo de venda nos indicadores da carteira', () => {
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

    expect(calcularResumoCarteira([venda, peticao, ajuizado, encerrado])).toEqual({
      casosCadastrados: 3,
      emAndamento: 2,
      valorTotalCausa: 110_000,
      excessoTotalCarteira: 55_000,
      recuperado: 5_000,
    })
    expect(calcularResumoFinanceiro([venda, peticao, ajuizado, encerrado])).toEqual({
      proLaboreRecebido: 2 * PRO_LABORE_POR_AJUIZAMENTO,
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
})
