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

const MAC_LINHAS = [
  'POSIÇÃO FINANCEIRA',
  'Data: 26/08/2026 Data Base: 26/08/2026',
  'BOULEVARD LAPA LAÇOS DA LAPA 156 10996 - PCV 14/08/2014 01/08/2016 01/08/2016 12,00000 2,00000 1,00000 INCC-2 IGPM-2 Quitado',
  'PROPRIETÁRIOS',
  '013.870.568-24 16476-FERNANDO LUIS DIAS 50,00000 Não',
  'PLANO PAGAMENTO',
  'Série Tipo Parcela Periodicidade Qtd. Data Base Original c/ Juros Atualizado Data 1o Venc. Correção? Juros? Data Juros',
  '1 Sinal Única 1 14/08/2014 7.000,00 7.000,00 7.000,00 14/08/2014 Não Não 01/08/2016',
  '5 Poupança Mensal 20 14/08/2014 2.500,00 2.500,00 5.331,07 10/12/2014 Sim Não 01/08/2016',
  '8 Financiamento Única 1 14/08/2014 302.850,00 311.553,10 664.364,23 01/11/2016 Sim Sim 01/08/2016',
  '9 Poupança Mensal 3 14/08/2014 100,00 113,06 241,09 01/08/2017 Sim Sim 01/08/2016',
  '442.572,90 451.315,18 954.469,67',
  'RESUMO FINANCEIRO (100,00%)',
  '10996-PCV 509.877,19 971.868,51 20.978,11 26.087,94 514.987,02 0,00 0,01 514.987,03',
  'S P Original Dt.Venc. Dt.Pagto Atualizado Atr. At.Pago P.Rata Multa Mora Desc.TP Desc.Adic. Resíduo Dif.Encargo Pago Status Documento Recibo',
  '1 1 7.000,00 14/08/2014 20/08/2014 7.000,00 6 7.000,00 0,00 0,00 0,00 0,00 0,00 0,00 0,00 7.000,00 Pago 6000028274 1400000163',
  '2 1 7.000,00 14/09/2014 25/09/2014 7.052,18 11 7.052,18 19,23 0,00 25,42 0,00 0,00 0,00 0,00 7.096,83 Pago 6000031689 1400000180',
  '3 1 12.422,90 14/10/2014 29/09/2014 12.525,06 0 12.525,06 0,00 0,00 0,00 0,00 0,00 0,00 0,00 12.525,06 Pago 6000030254 7000000704',
  '4 1 14.000,00 14/11/2014 14/11/2014 14.136,93 0 14.136,93 0,00 0,00 0,00 0,00 0,00 0,00 0,00 14.136,93 Pago 6000035048 7000000889',
  '5 1 2.500,00 10/12/2014 26/11/2014 2.528,84 0 2.528,84 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.528,84 Pago 6000038690 7000000906',
  '5 2 2.500,00 10/01/2015 09/01/2015 2.540,03 0 2.540,03 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.540,03 Pago 6000041599 7000000053',
  '6 1 6.000,00 10/01/2015 12/01/2015 6.096,07 2 6.096,07 0,00 0,00 0,00 0,00 0,00 0,00 0,00 6.096,07 Pago 6000041600 7000000069',
  '5 3 2.500,00 10/02/2015 13/02/2015 2.542,14 3 2.542,14 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.542,14 Pago 6000000471 7000000179',
  '5 4 2.500,00 10/03/2015 10/03/2015 2.565,47 0 2.565,47 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.565,47 Pago 6000003817 7000000274',
  '5 5 2.500,00 10/04/2015 09/04/2015 2.573,37 0 2.573,37 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.573,37 Pago 6000008576 7000000336',
  '5 6 2.500,00 10/05/2015 08/05/2015 2.589,37 0 2.589,37 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.589,37 Pago 6000009825 7000000449',
  '5 7 2.500,00 10/06/2015 08/06/2015 2.601,21 0 2.601,21 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.601,21 Pago 6000012946 7000000537',
  '5 8 2.500,00 10/07/2015 08/07/2015 2.626,00 0 2.626,00 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.626,00 Pago 6000016122 7000000615',
  '6 2 6.000,00 10/07/2015 06/07/2015 6.302,40 0 6.302,40 0,00 0,00 0,00 0,00 0,00 0,00 0,00 6.302,40 Pago 6000016123 7000000610',
  '5 9 2.500,00 10/08/2015 10/08/2015 2.674,20 0 2.674,20 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.674,20 Pago 6000018609 7000000694',
  '5 10 2.500,00 10/09/2015 10/09/2015 2.688,83 0 2.688,83 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.688,83 Pago 6000021320 7000000771',
  '5 11 2.500,00 10/10/2015 09/10/2015 2.704,67 0 2.704,67 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.704,67 Pago 6000023938 7000000828',
  '5 12 2.500,00 10/11/2015 10/11/2015 2.710,57 0 2.710,57 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.710,57 Pago 6000026498 7000000933',
  '5 13 2.500,00 10/12/2015 04/12/2015 2.720,29 0 2.720,29 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.720,29 Pago 6000029075 7000000984',
  '5 14 2.500,00 10/01/2016 11/01/2016 2.729,49 1 2.729,49 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.729,49 Pago 6000031464 7000000052',
  '6 3 6.000,00 10/01/2016 11/01/2016 6.550,79 1 6.550,79 0,00 0,00 0,00 0,00 0,00 0,00 0,00 6.550,79 Pago 6000031449 7000000051',
  '5 15 2.500,00 10/02/2016 10/02/2016 2.732,33 0 2.732,33 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.732,33 Pago 6000000396 7000000111',
  '5 16 2.500,00 10/03/2016 10/03/2016 2.743,03 0 2.743,03 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.743,03 Pago 6000003528 7000000176',
  '5 17 2.500,00 10/04/2016 07/04/2016 2.757,78 0 2.757,78 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.757,78 Pago 6000004637 7000000222',
  '5 18 2.500,00 10/05/2016 10/05/2016 2.775,39 0 2.775,39 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.775,39 Pago 6000010570 1400000125',
  '5 19 2.500,00 10/06/2016 25/05/2016 2.790,58 0 2.790,58 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.790,58 Pago 6000010810 7000000241',
  '5 20 2.500,00 10/07/2016 23/06/2016 2.792,91 0 2.792,91 0,00 0,00 0,00 0,00 0,00 0,00 0,00 2.792,91 Pago 6000013159 7000000307',
  '6 4 6.000,00 10/07/2016 11/07/2016 6.702,98 1 6.702,98 0,00 0,00 0,00 0,00 0,00 0,00 0,00 6.702,98 Pago 6000013160 7000000370',
  '7 1 25.000,00 01/08/2016 01/08/2016 28.468,23 0 28.468,23 0,00 0,00 0,00 0,00 0,00 0,00 0,00 28.468,23 Pago 6000014955 7000000399',
  '8 1 3.422,56 01/11/2016 18/11/2016 3.917,64 17 3.917,64 4,37 0,00 21,85 0,00 0,00 0,00 0,00 3.943,86 Pago 6000021221 1400000232',
  '8 1 308.130,55 01/11/2016 24/03/2017 357.345,06 143 357.345,05 1.754,41 7.146,90 17.113,84 0,00 20.935,93 0,01 0,00 362.424,27 Pago 6000002498 1400000082',
  '9 1 113,06 01/08/2017 24/03/2017 131,13 0 131,13 0,64 0,00 0,00 5,19 7,68 0,00 0,00 118,90 Pago 6000002498 1400000082',
  '9 2 113,06 01/09/2017 24/03/2017 131,11 0 131,11 0,64 0,00 0,00 6,39 7,68 0,00 0,00 117,68 Pago 6000002498 1400000082',
  '9 3 113,06 01/10/2017 24/03/2017 131,12 0 131,12 0,64 0,00 0,00 7,55 7,69 0,00 0,00 116,52 Pago 6000002498 1400000082',
  '451.315,19 509.877,20 509.877,19 1.779,93 7.146,90 17.161,11 19,13 20.958,98 0,01 514.987,02',
  'CHEQUE DEVOLVIDO',
]

describe('parseExtratoFromRows — Posição Financeira MAC', () => {
  it('extrai as 34 parcelas pagas e a data do contrato', () => {
    const resultado = parseExtratoFromRows(rowsFromLines(MAC_LINHAS))

    expect(resultado.dataAssinatura).toBe('2014-08-14')
    expect(resultado.lancamentos).toHaveLength(34)
  })

  it('usa Original, Pago e Dt.Pagto da tabela de pagamentos', () => {
    const resultado = parseExtratoFromRows(rowsFromLines(MAC_LINHAS))

    expect(
      resultado.lancamentos.find((l) => l.dataPagamento === '2014-08-20'),
    ).toMatchObject({
      parcela: '1-1',
      valorContratual: '7.000,00',
      valorPago: '7.000,00',
    })

    expect(
      resultado.lancamentos.find((l) => l.parcela === '5-1'),
    ).toMatchObject({
      valorContratual: '2.500,00',
      valorPago: '2.528,84',
      dataPagamento: '2014-11-26',
    })

    expect(
      resultado.lancamentos.find((l) => l.parcela === '9-1'),
    ).toMatchObject({
      valorContratual: '113,06',
      valorPago: '118,90',
    })
  })

  it('mapeia P.Rata + Mora, multa e descontos da tabela larga', () => {
    const resultado = parseExtratoFromRows(rowsFromLines(MAC_LINHAS))

    expect(
      resultado.lancamentos.find((l) => l.dataPagamento === '2014-09-25'),
    ).toMatchObject({
      valorContratual: '7.000,00',
      valorPago: '7.096,83',
      jurosMora: '44,65',
      multa: '0,00',
      descontos: '0,00',
    })

    expect(
      resultado.lancamentos.find((l) => l.valorContratual === '308.130,55'),
    ).toMatchObject({
      parcela: '8-1',
      valorPago: '362.424,27',
      multa: '7.146,90',
      jurosMora: '18.868,25',
      descontos: '0,00',
      taxasAdicionais: '20.935,93',
    })
  })

  it('inclui o financiamento e ignora plano, resumo e totalizador', () => {
    const resultado = parseExtratoFromRows(rowsFromLines(MAC_LINHAS))

    expect(resultado.lancamentos.some((l) => l.valorContratual === '3.422,56')).toBe(
      true,
    )
    expect(resultado.lancamentos.some((l) => l.valorContratual === '308.130,55')).toBe(
      true,
    )
    expect(resultado.lancamentos.some((l) => l.valorContratual === '302.850,00')).toBe(
      false,
    )
    expect(resultado.lancamentos.some((l) => l.valorContratual === '100,00')).toBe(
      false,
    )
    expect(resultado.lancamentos.some((l) => l.valorPago === '514.987,02')).toBe(false)
    expect(resultado.lancamentos.some((l) => l.valorPago === '509.877,19')).toBe(false)
    expect(resultado.lancamentos.some((l) => l.valorContratual === '442.572,90')).toBe(
      false,
    )
  })

  it('lê a data do contrato no cabeçalho MAC quando PCV vem em outra linha', () => {
    const resultado = parseExtratoFromRows(
      rowsFromLines([
        'POSIÇÃO FINANCEIRA',
        'LAÇOS DA 10996 -',
        'BOULEVARD LAPA 156 14/08/2014 01/08/2016 01/08/2016 12,00000 2,00000 1,00000 INCC-2 IGPM-2 Quitado Não há 24/03/2017',
        'LAPA PCV',
        'S P Original Dt.Venc. Dt.Pagto Atualizado Atr. At.Pago P.Rata Multa Mora Desc.TP Desc.Adic. Resíduo Dif.Encargo Pago Status Documento Recibo',
        '1 1 7.000,00 14/08/2014 20/08/2014 7.000,00 6 7.000,00 0,00 0,00 0,00 0,00 0,00 0,00 0,00 7.000,00 Pago 6000028274 1400000163',
      ]),
    )

    expect(resultado.dataAssinatura).toBe('2014-08-14')
    expect(resultado.lancamentos).toHaveLength(1)
  })
})
