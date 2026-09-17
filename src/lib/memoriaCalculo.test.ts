import { describe, expect, it } from 'vitest'
import { arredondarMoeda } from '../inccTable'
import {
  compararRelatorios,
  montarRelatorioMemoria,
  normalizarMemoriaCalculo,
  type MemoriaCalculoInput,
} from './memoriaCalculo'

function lancamento(
  parcial: Partial<MemoriaCalculoInput['linhas'][number]> &
    Pick<MemoriaCalculoInput['linhas'][number], 'id' | 'dataPagamento' | 'valorContratual' | 'valorPago'>,
): MemoriaCalculoInput['linhas'][number] {
  return {
    dataVencimento: '',
    renegociacao: 0,
    multa: 0,
    descontos: 0,
    jurosMora: 0,
    taxasAdicionais: 0,
    ...parcial,
  }
}

const inputBase: MemoriaCalculoInput = {
  versao: 1,
  dataAniversario: '2023-05-15',
  dataHabiteSe: '2023-08-10',
  defasagemMeses: 0,
  linhas: [
    lancamento({
      id: 'entrada',
      dataPagamento: '2023-05-15',
      dataVencimento: '2023-05-15',
      valorContratual: 100_000,
      valorPago: 100_000,
    }),
    lancamento({
      id: 'parcela',
      dataPagamento: '2024-07-24',
      dataVencimento: '2024-05-16',
      valorContratual: 2_500,
      valorPago: 2_900,
      jurosMora: 12.5,
    }),
  ],
}

describe('montarRelatorioMemoria', () => {
  it('separa correção, INCC, IGP-M, juros de mora e juros compensatórios', () => {
    const relatorio = montarRelatorioMemoria(inputBase)
    const parcela = relatorio.rows.find((r) => r.id === 'parcela')
    expect(parcela).toBeTruthy()
    expect(parcela!.correcao).toBeGreaterThan(0)
    expect(parcela!.inccValor).toBeGreaterThan(0)
    expect(parcela!.igpmValor).toBeGreaterThan(0)
    expect(arredondarMoeda(parcela!.inccValor + parcela!.igpmValor)).toBe(parcela!.correcao)
    expect(parcela!.jurosMora).toBe(12.5)
    expect(parcela!.jurosCompensatorios).toBeGreaterThan(0)
    expect(relatorio.totalIncc + relatorio.totalIgpm).toBeCloseTo(relatorio.totalCorrecao, 2)
  })

  it('recalcula com data de vencimento e defasagem sem alterar o input original', () => {
    const pagamento = montarRelatorioMemoria(inputBase, { usarDataVencimento: false, defasagemMeses: 0 })
    const vencimento = montarRelatorioMemoria(inputBase, { usarDataVencimento: true, defasagemMeses: 0 })
    const defasagem = montarRelatorioMemoria(inputBase, { usarDataVencimento: false, defasagemMeses: 1 })

    expect(pagamento.rows[1]?.pagamento).toBe('2024-07-24')
    expect(vencimento.rows[1]?.pagamento).toBe('2024-05-16')
    expect(defasagem.indiceBaseLabel).not.toBe(pagamento.indiceBaseLabel)
    expect(inputBase.defasagemMeses).toBe(0)
  })
})

describe('compararRelatorios', () => {
  it('mostra o delta de devido e excesso entre pagamento e vencimento', () => {
    const pagamento = montarRelatorioMemoria(inputBase, { usarDataVencimento: false })
    const vencimento = montarRelatorioMemoria(inputBase, { usarDataVencimento: true })
    const comparativo = compararRelatorios(pagamento, vencimento)
    expect(comparativo.deltaDevido).toBe(
      arredondarMoeda(vencimento.totalDevido - pagamento.totalDevido),
    )
    expect(comparativo.deltaExcesso).toBe(
      arredondarMoeda(vencimento.totalExcesso - pagamento.totalExcesso),
    )
    expect(comparativo.rows).toHaveLength(2)
  })
})

describe('normalizarMemoriaCalculo', () => {
  it('rejeita payload sem versão ou lançamentos', () => {
    expect(normalizarMemoriaCalculo(null)).toBeNull()
    expect(normalizarMemoriaCalculo({ versao: 2, linhas: [] })).toBeNull()
  })

  it('aceita o payload persistido no caso', () => {
    const normalizado = normalizarMemoriaCalculo(inputBase)
    expect(normalizado?.linhas).toHaveLength(2)
    expect(normalizado?.defasagemMeses).toBe(0)
  })
})
