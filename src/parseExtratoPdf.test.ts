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

const BENX_LINHAS = [
  'Posição Financeira',
  'VIVA BENX CASA DO ATOR',
  'APTO - Unidade 1302',
  'Data base: 31/08/2026 Atenção: Os valores constantes na posição financeira estão projetados.',
  'Resumo Financeiro',
  'Total Pago: R$ 332.123,17 A vencer: R$ 0,00 Em atraso: R$ 0,00',
  'Valores em atraso',
  'Vencimento Valor Encargos Valor Atualizado',
  'Não há valores em atraso para a unidade selecionada.',
  'Valores a vencer',
  'Não há valores a vencer para a unidade selecionada.',
  'Valores pagos',
  'Vencimento Pagamento Valor Encargos Descontos Total',
  '14/12/2021 15/12/2021 R$ 16.370,00 R$ 0,00 R$ 0,00 R$ 16.370,00',
  '25/02/2022 22/02/2022 R$ 1.515,31 R$ 0,00 R$ 0,00 R$ 1.515,31',
  '25/05/2023 30/05/2023 R$ 1.709,51 R$ 37,81 R$ 0,00 R$ 1.709,51',
  '25/02/2024 04/03/2024 R$ 1.756,64 R$ 38,31 R$ 0,00 R$ 1.756,64',
  '30/05/2025 17/06/2025 R$ 229.856,65 R$ 2.336,13 R$ 0,00 R$ 229.856,65',
]

describe('parseExtratoFromRows — Posição Financeira Benx', () => {
  it('detecta o layout do Portal Benx e extrai os lançamentos pagos', () => {
    const resultado = parseExtratoFromRows(rowsFromLines(BENX_LINHAS))

    expect(resultado.dataAssinatura).toBeNull()
    expect(resultado.lancamentos).toHaveLength(5)
    expect(resultado.lancamentos[0]).toMatchObject({
      dataPagamento: '2021-12-15',
      valorContratual: '16.370,00',
      valorPago: '16.370,00',
      jurosMora: '0,00',
      descontos: '0,00',
    })
  })

  it('subtrai encargos do valor para obter a base contratual', () => {
    const resultado = parseExtratoFromRows(rowsFromLines(BENX_LINHAS))

    expect(
      resultado.lancamentos.find((l) => l.dataPagamento === '2023-05-30'),
    ).toMatchObject({
      valorContratual: '1.671,70',
      valorPago: '1.709,51',
      jurosMora: '37,81',
    })

    expect(
      resultado.lancamentos.find((l) => l.dataPagamento === '2024-03-04'),
    ).toMatchObject({
      valorContratual: '1.718,33',
      valorPago: '1.756,64',
      jurosMora: '38,31',
    })

    expect(
      resultado.lancamentos.find((l) => l.dataPagamento === '2025-06-17'),
    ).toMatchObject({
      valorContratual: '227.520,52',
      valorPago: '229.856,65',
      jurosMora: '2.336,13',
    })
  })

  it('ignora resumo, cabeçalhos e seções sem valores', () => {
    const resultado = parseExtratoFromRows(rowsFromLines(BENX_LINHAS))
    expect(resultado.lancamentos.some((l) => l.valorPago === '332.123,17')).toBe(false)
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

const RELACAO_LINHAS = [
  'Cliente: Henry Magnus Guarnieri Borgatto',
  'Projeto: Boulevard Lapa',
  'Bloco: Origens Data da Compra: 04/11/2013',
  'Unidade: 74',
  'S P Original Dt.Venc. Dt.Pagto Atualizado Atr. P.Rata Mora Desc.Adic. Pago Status',
  '1 1 115.720,00 04/11/2013 08/11/2013 115.720,00 4 0 0 0 115.720,00 Pago',
  '2 1 2.000,00 04/12/2013 02/12/2013 2.005,26 0 0 0 0 2.005,26 Pago',
  '4 1 30.000,00 10/11/2014 13/05/2014 30.662,79 0 8,3 0 590,6 30.080,49 Pago',
  '4 2 30.000,00 10/11/2015 27/02/2015 32.314,28 0 14,43 0 1.698,02 30.630,69 Pago',
  '5 1 11.443,82 01/08/2016 21/05/2015 12.555,64 0 51,98 0 1.107,62 11.500,00 Pago',
  '7 1 538,35 01/11/2016 08/11/2016 652,75 7 0,3 1,5 0 654,55 Pago',
  '7 1 139.061,31 01/11/2016 15/12/2016 168.878,78 44 123,88 2.448,40 1.076,92 170.374,14 Pago',
  '409.631,21 452.583,43 254,99 2.449,90 5.510,58 449.777,74',
  'Relação Valores Pagos',
]

describe('parseExtratoFromRows — Relação Valores Pagos', () => {
  it('extrai data da compra e lançamentos do Boulevard', () => {
    const resultado = parseExtratoFromRows(rowsFromLines(RELACAO_LINHAS))

    expect(resultado.dataAssinatura).toBe('2013-11-04')
    expect(resultado.lancamentos.length).toBeGreaterThanOrEqual(7)
  })

  it('mapeia P.Rata + Mora em juros de mora e Desc. em descontos', () => {
    const resultado = parseExtratoFromRows(rowsFromLines(RELACAO_LINHAS))

    expect(
      resultado.lancamentos.find((l) => l.dataPagamento === '2014-05-13'),
    ).toMatchObject({
      parcela: '4-1',
      valorContratual: '30.000,00',
      valorPago: '30.080,49',
      jurosMora: '8,30',
      descontos: '590,60',
      taxasAdicionais: '0,00',
    })

    expect(
      resultado.lancamentos.find((l) => l.dataPagamento === '2016-11-08'),
    ).toMatchObject({
      valorContratual: '538,35',
      valorPago: '654,55',
      jurosMora: '1,80',
      descontos: '0,00',
    })

    expect(
      resultado.lancamentos.find((l) => l.dataPagamento === '2016-12-15'),
    ).toMatchObject({
      valorContratual: '139.061,31',
      valorPago: '170.374,14',
      jurosMora: '2.572,28',
      descontos: '1.076,92',
    })
  })

  it('ignora totalizador e não confunde com CivilWeb', () => {
    const resultado = parseExtratoFromRows(rowsFromLines(RELACAO_LINHAS))
    expect(resultado.lancamentos.some((l) => l.valorPago === '449.777,74')).toBe(false)
    expect(resultado.lancamentos.every((l) => l.jurosMora !== '0,00' || l.descontos !== '590,60')).toBe(
      true,
    )
  })
})
