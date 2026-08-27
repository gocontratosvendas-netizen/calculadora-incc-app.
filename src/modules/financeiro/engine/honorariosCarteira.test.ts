import { describe, expect, it } from 'vitest'
import {
  honorariosVazio,
  mapearHonorariosDaCarteira,
  rotuloSituacaoHonorario,
  situacaoHonorario,
  valorHonorarioExibido,
  valorHonorarioRecebido,
} from './honorariosCarteira'
import { resumirProLaboreDoCaso } from './somarProLaboreRecebido'

describe('honorários da carteira', () => {
  it('mapeia o payload agregado por caso', () => {
    const mapa = mapearHonorariosDaCarteira([
      {
        casoId: 'caso-1',
        proLaborePago: 500_000,
        proLaborePendente: 0,
        exitoPago: 0,
        exitoPendente: 1_200_000,
      },
    ])
    expect(mapa['caso-1']).toEqual({
      proLabore: { valorPago: 5_000, valorPendente: 0, status: 'pago' },
      exito: { valorPago: 0, valorPendente: 12_000, status: 'nao_pago' },
    })
  })

  it('ignora itens sem caso e payload vazio', () => {
    expect(mapearHonorariosDaCarteira(null)).toEqual({})
    expect(mapearHonorariosDaCarteira([{ proLaborePago: 1 }])).toEqual({})
  })

  it('classifica recebido, parcial e não recebido', () => {
    expect(situacaoHonorario(undefined)).toBe('nao_recebido')
    expect(situacaoHonorario(resumirProLaboreDoCaso(0, 0))).toBe('nao_recebido')
    expect(situacaoHonorario(resumirProLaboreDoCaso(100, 0))).toBe('recebido')
    expect(situacaoHonorario(resumirProLaboreDoCaso(100, 50))).toBe('parcial')
    expect(rotuloSituacaoHonorario('nao_recebido')).toBe('Não recebido')
    expect(rotuloSituacaoHonorario('parcial')).toBe('Parcial')
    expect(rotuloSituacaoHonorario('recebido')).toBe('Recebido')
  })

  it('escolhe o valor exibido e o recebido', () => {
    expect(valorHonorarioExibido(undefined)).toBeNull()
    expect(valorHonorarioExibido(undefined, 30_000)).toBe(30_000)
    expect(valorHonorarioExibido(resumirProLaboreDoCaso(250_000, 0))).toBe(2_500)
    expect(valorHonorarioExibido(resumirProLaboreDoCaso(0, 400_000), 10)).toBe(4_000)
    expect(valorHonorarioRecebido(honorariosVazio().exito)).toBe(0)
    expect(valorHonorarioRecebido(resumirProLaboreDoCaso(150_000, 20_000))).toBe(1_500)
  })
})
