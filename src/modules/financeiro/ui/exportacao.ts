import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import type { Classificacao, Lancamento, LinhaDRE, Periodo, Regime } from '../types'
import { formatarDataLonga, formatarMoedaContabil, formatarPercentual, formatarVariacao, rotuloRegime } from '../format'

function nomeClassificacao(id: string, classificacoes: Classificacao[]): string {
  return classificacoes.find((c) => c.id === id)?.nome ?? id
}

export function exportarLancamentosCsv(
  lancamentos: Lancamento[],
  classificacoes: Classificacao[],
  nome = 'fluxo-caixa',
) {
  const linhas = [
    ['Emissão', 'Mov.', 'Histórico', 'Classificação', 'Valor (R$)', 'Venc.', 'Pagto.'],
    ...lancamentos.map((l) => [
      formatarDataLonga(l.dataEmissao),
      l.movimentacao === 'entrada' ? 'Entrada' : 'Saída',
      l.historico,
      nomeClassificacao(l.classificacaoId, classificacoes),
      formatarMoedaContabil(l.movimentacao === 'saida' ? -l.valor : l.valor, false),
      formatarDataLonga(l.vencimento),
      l.dataPagamento ? formatarDataLonga(l.dataPagamento) : '',
    ]),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(linhas)
  const csv = XLSX.utils.sheet_to_csv(sheet)
  baixar(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${nome}.csv`)
}

export function exportarLancamentosXlsx(
  lancamentos: Lancamento[],
  classificacoes: Classificacao[],
  nome = 'fluxo-caixa',
) {
  const linhas = [
    ['Emissão', 'Mov.', 'Histórico', 'Classificação', 'Valor (R$)', 'Venc.', 'Pagto.'],
    ...lancamentos.map((l) => [
      formatarDataLonga(l.dataEmissao),
      l.movimentacao === 'entrada' ? 'Entrada' : 'Saída',
      l.historico,
      nomeClassificacao(l.classificacaoId, classificacoes),
      (l.movimentacao === 'saida' ? -l.valor : l.valor) / 100,
      formatarDataLonga(l.vencimento),
      l.dataPagamento ? formatarDataLonga(l.dataPagamento) : '',
    ]),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(linhas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Fluxo')
  XLSX.writeFile(wb, `${nome}.xlsx`)
}

export function exportarDreXlsx(linhas: LinhaDRE[], periodo: Periodo, nome = 'dre') {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Descrição', 'Período (R$)', 'AV', 'Período anterior (R$)', 'Var'],
    ...linhas.map((l) => [
      l.rotulo,
      l.valor / 100,
      formatarPercentual(l.analiseVertical),
      l.valorAnterior / 100,
      formatarVariacao(l.variacao),
    ]),
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'DRE')
  XLSX.writeFile(wb, `${nome}-${periodo.inicio}-${periodo.fim}.xlsx`)
}

export function exportarDrePdf(
  linhas: LinhaDRE[],
  periodo: Periodo,
  regime: Regime,
  nome = 'dre',
) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const margem = 40
  let y = 48
  pdf.setFontSize(14)
  pdf.text('Demonstração do Resultado', margem, y)
  y += 18
  pdf.setFontSize(10)
  pdf.text(
    `${rotuloRegime(regime)} · ${formatarDataLonga(periodo.inicio)} a ${formatarDataLonga(periodo.fim)}`,
    margem,
    y,
  )
  y += 22
  const cols = [margem, 280, 340, 420, 500]
  pdf.setFontSize(8)
  pdf.text('Descrição', cols[0] ?? 0, y)
  pdf.text('Período', cols[1] ?? 280, y)
  pdf.text('AV', cols[2] ?? 340, y)
  pdf.text('Anterior', cols[3] ?? 420, y)
  pdf.text('Var', cols[4] ?? 500, y)
  y += 12
  pdf.setFontSize(9)
  for (const linha of linhas) {
    if (y > 780) {
      pdf.addPage()
      y = 48
    }
    const indent = linha.nivel === 'detalhe' ? 14 : 0
    pdf.text(linha.rotulo, (cols[0] ?? 0) + indent, y)
    pdf.text(formatarMoedaContabil(linha.valor), cols[1] ?? 280, y)
    pdf.text(formatarPercentual(linha.analiseVertical), cols[2] ?? 340, y)
    pdf.text(formatarMoedaContabil(linha.valorAnterior), cols[3] ?? 420, y)
    pdf.text(formatarVariacao(linha.variacao), cols[4] ?? 500, y)
    y += 14
  }
  pdf.save(`${nome}-${periodo.inicio}.pdf`)
}

function baixar(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
