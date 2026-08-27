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
    excessoApurado: parcial.excessoApurado ?? 80_000,
    valorCausa: parcial.valorCausa ?? 100_000,
    percentualExito: parcial.percentualExito ?? PERCENTUAL_EXITO_PADRAO,
    anoAjuizamento: parcial.anoAjuizamento ?? 2024,
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
})
