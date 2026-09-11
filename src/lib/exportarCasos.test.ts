import { describe, expect, it } from 'vitest'
import { PERCENTUAL_EXITO_PADRAO, type Caso } from './casos'
import { montarLinhasExportacaoCasos } from './exportarCasos'
import { resumirProLaboreDoCaso } from '../modules/financeiro/engine/somarProLaboreRecebido'

const STATUS_META = {
  stand_by: { rotulo: 'Stand-by' },
  processo_de_venda: { rotulo: 'Processo de venda' },
  confeccao_de_peticao_inicial: { rotulo: 'Confecção de Petição Inicial' },
  ajuizado: { rotulo: 'Ajuizado' },
  encerrado: { rotulo: 'Encerrado' },
} as const

function caso(parcial: Partial<Caso> = {}): Caso {
  const responsavel = parcial.responsavel ?? { id: 'vitor', nome: 'Vitor Paludetto', iniciais: 'VP' }
  return {
    id: parcial.id ?? 'caso-1',
    cliente: parcial.cliente ?? 'Ana',
    empreendimento: parcial.empreendimento ?? 'Residencial',
    incorporadora: parcial.incorporadora ?? 'Construtora',
    valorContrato: parcial.valorContrato ?? 200_000,
    excessoApurado: 'excessoApurado' in parcial ? (parcial.excessoApurado ?? null) : 80_000,
    valorCausa: 'valorCausa' in parcial ? (parcial.valorCausa ?? null) : 100_000,
    percentualExito: parcial.percentualExito ?? PERCENTUAL_EXITO_PADRAO,
    creditoComprado: parcial.creditoComprado ?? false,
    anoAjuizamento: 'anoAjuizamento' in parcial ? (parcial.anoAjuizamento ?? null) : 2024,
    status: parcial.status ?? 'ajuizado',
    responsavel,
    responsaveis: parcial.responsaveis ?? [responsavel],
    atualizadoEm: parcial.atualizadoEm ?? '2026-08-27T12:00:00.000Z',
  }
}

describe('exportação da carteira', () => {
  it('formata situação e valores de pró-labore e êxito', () => {
    const linhas = montarLinhasExportacaoCasos(
      [caso()],
      {
        'caso-1': {
          proLabore: resumirProLaboreDoCaso(450_000, 0),
          exito: resumirProLaboreDoCaso(0, 0),
        },
      },
      STATUS_META,
    )
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({
      cliente: 'Ana',
      contrato: 200_000,
      excesso: 80_000,
      valorCausa: 100_000,
      proLaboreSituacao: 'Recebido',
      proLaboreValor: 4_500,
      exitoSituacao: 'Não recebido',
      exitoRecebido: '',
      exitoEsperado: 30_000,
      percentualExito: 30,
      creditoComprado: 'Não',
      creditoCompradoValor: '',
      status: 'Ajuizado',
    })
  })

  it('deixa nulos como vazio quando o caso não tem causa nem lançamento', () => {
    const linhas = montarLinhasExportacaoCasos(
      [caso({ valorCausa: null, excessoApurado: null, anoAjuizamento: null })],
      {},
      STATUS_META,
    )
    expect(linhas[0]).toMatchObject({
      ano: '',
      excesso: '',
      valorCausa: '',
      proLaboreSituacao: 'Não recebido',
      proLaboreValor: '',
      exitoSituacao: 'Não recebido',
      exitoRecebido: '',
      exitoEsperado: '',
      percentualExito: '',
      creditoComprado: 'Não',
      creditoCompradoValor: '',
    })
  })

  it('junta os nomes quando o caso tem mais de um responsável', () => {
    const linhas = montarLinhasExportacaoCasos(
      [
        caso({
          responsaveis: [
            { id: 'vitor', nome: 'Vitor P.', iniciais: 'VP' },
            { id: 'rafaela', nome: 'Rafaela Moura', iniciais: 'RM' },
          ],
        }),
      ],
      {},
      STATUS_META,
    )
    expect(linhas[0].responsavel).toBe('Vitor P., Rafaela Moura')
  })

  it('exporta a diferença quando o crédito foi comprado', () => {
    const linhas = montarLinhasExportacaoCasos(
      [caso({ creditoComprado: true })],
      {},
      STATUS_META,
    )
    expect(linhas[0]).toMatchObject({
      creditoComprado: 'Sim',
      creditoCompradoValor: 70_000,
      exitoEsperado: 30_000,
    })
  })
})
