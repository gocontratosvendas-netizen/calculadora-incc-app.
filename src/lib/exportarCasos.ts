import * as XLSX from 'xlsx'
import {
  honorariosExitoDoCaso,
  type Caso,
  type CasoStatus,
} from './casos'
import {
  rotuloSituacaoHonorario,
  situacaoHonorario,
  valorHonorarioExibido,
  valorHonorarioRecebido,
  type HonorariosDoCaso,
} from '../modules/financeiro/engine/honorariosCarteira'

export type StatusRotulo = Record<CasoStatus, { rotulo: string }>

const MOEDA_XLSX = '"R$ "#,##0.00'

export type LinhaExportacaoCaso = {
  cliente: string
  empreendimento: string
  incorporadora: string
  ano: number | ''
  contrato: number
  excesso: number | ''
  valorCausa: number | ''
  proLaboreSituacao: string
  proLaboreValor: number | ''
  exitoSituacao: string
  exitoRecebido: number | ''
  exitoEsperado: number | ''
  percentualExito: number | ''
  responsavel: string
  status: string
}

export function montarLinhasExportacaoCasos(
  casos: Caso[],
  honorarios: Record<string, HonorariosDoCaso>,
  statusMeta: StatusRotulo,
): LinhaExportacaoCaso[] {
  return casos.map((c) => {
    const hon = honorarios[c.id]
    const esperado = honorariosExitoDoCaso(c.valorCausa, c.percentualExito)
    const proLaboreValor = valorHonorarioExibido(hon?.proLabore)
    const exitoRecebido = valorHonorarioRecebido(hon?.exito)
    return {
      cliente: c.cliente,
      empreendimento: c.empreendimento,
      incorporadora: c.incorporadora,
      ano: c.anoAjuizamento ?? '',
      contrato: c.valorContrato,
      excesso: c.excessoApurado ?? '',
      valorCausa: c.valorCausa ?? '',
      proLaboreSituacao: rotuloSituacaoHonorario(situacaoHonorario(hon?.proLabore)),
      proLaboreValor: proLaboreValor ?? '',
      exitoSituacao: rotuloSituacaoHonorario(situacaoHonorario(hon?.exito)),
      exitoRecebido: exitoRecebido > 0 ? exitoRecebido : '',
      exitoEsperado: esperado ?? '',
      percentualExito: c.valorCausa == null ? '' : c.percentualExito,
      responsavel: c.responsavel.nome,
      status: statusMeta[c.status].rotulo,
    }
  })
}

function somarNumeros(valores: Array<number | ''>): number {
  return valores.reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0)
}

function aplicarFormatoMoeda(sheet: XLSX.WorkSheet, colunas: number[], linhaInicio: number, linhaFim: number) {
  for (let r = linhaInicio; r <= linhaFim; r += 1) {
    for (const c of colunas) {
      const ref = XLSX.utils.encode_cell({ r, c })
      const cell = sheet[ref] as XLSX.CellObject | undefined
      if (cell && cell.t === 'n') cell.z = MOEDA_XLSX
    }
  }
}

function dataHoje(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())
}

function nomeArquivoHoje(): string {
  const iso = new Date().toISOString().slice(0, 10)
  return `carteira-casos-${iso}.xlsx`
}

export function exportarCarteiraCasos(
  casos: Caso[],
  honorarios: Record<string, HonorariosDoCaso>,
  statusMeta: StatusRotulo,
  extras?: { filtrado?: boolean },
) {
  const linhas = montarLinhasExportacaoCasos(casos, honorarios, statusMeta)
  const hoje = dataHoje()
  const filtrado = extras?.filtrado === true

  const totalContrato = somarNumeros(linhas.map((l) => l.contrato))
  const totalExcesso = somarNumeros(linhas.map((l) => l.excesso))
  const totalCausa = somarNumeros(linhas.map((l) => l.valorCausa))
  const totalProLabore = somarNumeros(linhas.map((l) => l.proLaboreValor))
  const totalExitoRecebido = somarNumeros(linhas.map((l) => l.exitoRecebido))
  const totalExitoEsperado = somarNumeros(linhas.map((l) => l.exitoEsperado))

  const resumoAoA: (string | number)[][] = [
    ['VERUM'],
    ['Carteira de casos'],
    [`Exportado em ${hoje}`],
    filtrado ? ['Lista filtrada — reflete os filtros aplicados na tela'] : ['Lista completa da carteira'],
    [],
    ['Indicador', 'Valor'],
    ['Casos', linhas.length],
    ['Valor de contrato', totalContrato],
    ['Excesso apurado', totalExcesso],
    ['Valor da causa', totalCausa],
    ['Pró-labore recebido', totalProLabore],
    ['Honorários de êxito recebidos', totalExitoRecebido],
    ['Honorários de êxito esperados', totalExitoEsperado],
  ]

  const cabecalho = [
    'Cliente',
    'Empreendimento',
    'Incorporadora',
    'Ano',
    'Contrato',
    'Excesso',
    'Valor da causa',
    'Pró-labore',
    'Valor pró-labore',
    'Honorários de êxito',
    'Êxito recebido',
    'Êxito esperado',
    '% êxito',
    'Responsável',
    'Status',
  ]

  const casosAoA: (string | number)[][] = [
    ['VERUM — Carteira de casos'],
    [`Exportado em ${hoje}${filtrado ? ' · filtros aplicados' : ''}`],
    [],
    cabecalho,
    ...linhas.map((l) => [
      l.cliente,
      l.empreendimento,
      l.incorporadora,
      l.ano,
      l.contrato,
      l.excesso,
      l.valorCausa,
      l.proLaboreSituacao,
      l.proLaboreValor,
      l.exitoSituacao,
      l.exitoRecebido,
      l.exitoEsperado,
      l.percentualExito,
      l.responsavel,
      l.status,
    ]),
    [],
    [
      'TOTAL',
      '',
      '',
      '',
      totalContrato,
      totalExcesso,
      totalCausa,
      '',
      totalProLabore,
      '',
      totalExitoRecebido,
      totalExitoEsperado,
      '',
      '',
      '',
    ],
  ]

  const wsResumo = XLSX.utils.aoa_to_sheet(resumoAoA)
  wsResumo['!cols'] = [{ wch: 36 }, { wch: 22 }]
  wsResumo['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
  aplicarFormatoMoeda(wsResumo, [1], 7, 12)

  const wsCasos = XLSX.utils.aoa_to_sheet(casosAoA)
  wsCasos['!cols'] = [
    { wch: 28 },
    { wch: 28 },
    { wch: 22 },
    { wch: 8 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 22 },
    { wch: 26 },
  ]
  wsCasos['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } }]
  const ultimaLinhaDados = 3 + linhas.length
  wsCasos['!autofilter'] = { ref: `A4:O${Math.max(4, ultimaLinhaDados)}` }
  wsCasos['!freeze'] = { xSplit: 0, ySplit: 4, topLeftCell: 'A5', activeCell: 'A5' }
  aplicarFormatoMoeda(wsCasos, [4, 5, 6, 8, 10, 11], 4, ultimaLinhaDados)
  aplicarFormatoMoeda(wsCasos, [4, 5, 6, 8, 10, 11], ultimaLinhaDados + 2, ultimaLinhaDados + 2)

  const wb = XLSX.utils.book_new()
  wb.Props = {
    Title: 'Carteira de casos',
    Author: 'VERUM',
    Company: 'VERUM',
  }
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')
  XLSX.utils.book_append_sheet(wb, wsCasos, 'Casos')
  XLSX.writeFile(wb, nomeArquivoHoje())
}
