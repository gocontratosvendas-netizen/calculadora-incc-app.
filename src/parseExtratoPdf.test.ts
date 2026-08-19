import { describe, expect, it } from 'vitest'
import { parseExtratoFromRows, type PdfTextRow } from './parseExtratoPdfCore'

function rowsFromLines(lines: string[]): PdfTextRow[] {
  return lines.map((text, i) => ({
    y: 500 - i * 16,
    cells: text.split(/\s+/).map((str) => ({ str })),
    text,
  }))
}

const POSICAO_LINHAS = [
  'POSIÇÃO FINANCEIRA',
  'Status do contrato: Quitado Contrato: 70698 Ano base: 2026',
  'Valor original do contrato: R$ 1.239.000,00 Saldo devedor: R$ 0,00',
  'Total pago: R$ 1.357.621,93 Data do contrato: 15/05/2023 Última atualização: 18/08/2026 20:01:50',
  'Parcela Situação Vencimento / Pagamento Valor Pago Valor Original Correção Monetária Encargos Desconto',
  'Sinal QUITADA Paga em 31/05/2023 R$ 100.000,00 R$ 100.000,00 R$ 0,00 R$ 0,00 R$ 0,00',
  'Intermediária QUITADA Paga em 19/01/2024 R$ 40.936,68 R$ 40.000,00 R$ 936,68 R$ 0,00 R$ 0,00',
  'Intermediária QUITADA Paga em 24/07/2024 R$ 41.915,80 R$ 40.000,00 R$ 1.915,80 R$ 0,00 R$ 0,00',
  'Intermediária QUITADA Paga em 23/01/2025 R$ 43.529,53 R$ 40.000,00 R$ 3.529,53 R$ 0,00 R$ 0,00',
  'Intermediária QUITADA Paga em 25/03/2025 R$ 551.378,77 R$ 508.600,61 R$ 42.778,16 R$ 0,00 R$ 0,00',
  'Conclusão QUITADA Paga em 30/06/2025 R$ 299.999,99 R$ 268.512,55 R$ 31.487,44 R$ 0,00 R$ 0,00',
  'Conclusão QUITADA Paga em 10/07/2025 R$ 278.743,89 R$ 249.487,45 R$ 29.256,44 R$ 0,00 R$ 0,00',
  'Mensal QUITADA Paga em 10/07/2025 R$ 1.117,27 R$ 1.000,00 R$ 117,27 R$ 0,00 R$ 0,00',
  'TOTAIS R$ 1.357.621,93 R$ 1.239.000,00 - - -',
  'Posição financeira detalhada por parcela.',
]

describe('parseExtratoFromRows — Posição Financeira', () => {
  it('extrai as 8 parcelas pagas e a data do contrato', () => {
    const resultado = parseExtratoFromRows(rowsFromLines(POSICAO_LINHAS))

    expect(resultado.dataAssinatura).toBe('2023-05-15')
    expect(resultado.lancamentos).toHaveLength(8)
    expect(resultado.lancamentos.map((l) => l.parcela)).toEqual([
      'Sinal',
      'Intermediária',
      'Intermediária',
      'Intermediária',
      'Intermediária',
      'Conclusão',
      'Conclusão',
      'Mensal',
    ])
  })

  it('usa valor pago e valor original na ordem da posição financeira', () => {
    const resultado = parseExtratoFromRows(rowsFromLines(POSICAO_LINHAS))
    const intermediaria = resultado.lancamentos.find(
      (l) => l.dataPagamento === '2024-01-19',
    )

    expect(intermediaria).toMatchObject({
      valorPago: '40.936,68',
      valorContratual: '40.000,00',
      jurosMora: '0,00',
      descontos: '0,00',
    })
  })

  it('não importa o totalizador nem o cabeçalho', () => {
    const resultado = parseExtratoFromRows(rowsFromLines(POSICAO_LINHAS))
    expect(resultado.lancamentos.some((l) => l.valorPago === '1.357.621,93')).toBe(false)
    expect(resultado.lancamentos.some((l) => l.valorContratual === '1.239.000,00')).toBe(
      false,
    )
  })

  it('mapeia encargos e desconto quando existem', () => {
    const resultado = parseExtratoFromRows(
      rowsFromLines([
        'POSIÇÃO FINANCEIRA',
        'Data do contrato: 15/05/2023',
        'Mensal QUITADA Paga em 10/07/2025 R$ 1.200,00 R$ 1.000,00 R$ 100,00 R$ 80,00 R$ 20,00',
      ]),
    )

    expect(resultado.lancamentos[0]).toMatchObject({
      valorPago: '1.200,00',
      valorContratual: '1.000,00',
      jurosMora: '80,00',
      descontos: '20,00',
    })
  })

  it('junta nome da parcela quando ele veio na linha anterior', () => {
    const resultado = parseExtratoFromRows(
      rowsFromLines([
        'POSIÇÃO FINANCEIRA',
        'Data do contrato: 15/05/2023',
        'Sinal',
        'QUITADA Paga em 31/05/2023 R$ 100.000,00 R$ 100.000,00 R$ 0,00 R$ 0,00 R$ 0,00',
      ]),
    )

    expect(resultado.lancamentos).toHaveLength(1)
    expect(resultado.lancamentos[0]).toMatchObject({
      parcela: 'Sinal',
      dataPagamento: '2023-05-31',
      valorPago: '100.000,00',
      valorContratual: '100.000,00',
    })
  })
})

describe('parseExtratoFromRows — CivilWeb', () => {
  it('continua lendo extrato com duas datas e onze colunas monetárias', () => {
    const linha =
      '001/048-A 10/01/2024 15/01/2024 2.500,00 0,00 10,00 0,00 50,00 20,00 5,00 0,00 2.560,00 2.560,00 2.575,00'
    const resultado = parseExtratoFromRows(
      rowsFromLines(['Extrato de Cliente', 'Data Assinatura: 01/12/2023', linha]),
    )

    expect(resultado.dataAssinatura).toBe('2023-12-01')
    expect(resultado.lancamentos).toHaveLength(1)
    expect(resultado.lancamentos[0]).toMatchObject({
      parcela: '001/048-A',
      dataPagamento: '2024-01-15',
      valorContratual: '2.500,00',
      renegociacao: '0,00',
      multa: '50,00',
      jurosMora: '20,00',
      descontos: '5,00',
      taxasAdicionais: '0,00',
      valorPago: '2.575,00',
    })
  })
})
