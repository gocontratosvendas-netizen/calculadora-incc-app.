import { jsPDF } from 'jspdf'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export type MemoriaCalculoRow = {
  pagamento: string
  vc: number
  vp: number
  renegociacao: number
  multa: number
  descontos: number
  jurosMora: number
  taxasAdicionais: number
  incc: number | null
  janela: string | null
  erroIndice: string | null
  devido: number
  excesso: number
}

export type MemoriaCalculoRelatorio = {
  rows: MemoriaCalculoRow[]
  totalDevido: number
  totalPago: number
  totalExcesso: number
  totalRenegociacao: number
  totalMulta: number
  totalDescontos: number
  totalJurosMora: number
  totalTaxasAdicionais: number
}

function formatPdfMoney(value: number) {
  return numberFormatter.format(value)
}

function formatPercent4(value: number | null) {
  if (value == null) return '—'
  return `${value.toFixed(4).replace('.', ',')}%`
}

function drawPdfTextFit(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  align: 'left' | 'right' | 'center',
  baseSize: number,
) {
  const pad = 3.5
  let size = baseSize
  pdf.setFontSize(size)
  while (size > 5 && pdf.getTextWidth(text) > maxWidth - pad * 2) {
    size -= 0.4
    pdf.setFontSize(size)
  }
  const textWidth = pdf.getTextWidth(text)
  let drawX = x + pad
  if (align === 'right') drawX = x + maxWidth - pad - textWidth
  if (align === 'center') drawX = x + (maxWidth - textWidth) / 2
  pdf.text(text, drawX, y, { baseline: 'middle' })
}

export function gerarMemoriaCalculoPdf(
  relatorio: MemoriaCalculoRelatorio,
  opcoes: { incluirResumo?: boolean; titulo?: string } = {},
): jsPDF {
  const incluirResumo = opcoes.incluirResumo ?? false
  const titulo = opcoes.titulo ?? 'Memória de Cálculo Revisão INCC'

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 18
  const marginY = 22
  const usableWidth = pageWidth - marginX * 2

  const headers = [
    'Pagamento',
    'Contratual',
    'Renegociação',
    'Multa',
    'Juros mora',
    'Descontos',
    'Taxas',
    'INCC %',
    'Devido',
    'Pago',
    'Excesso',
  ]

  const colWeights = [1.15, 1.35, 1.15, 0.95, 1.15, 1.1, 1.0, 1.55, 1.35, 1.35, 1.25]
  const weightSum = colWeights.reduce((a, b) => a + b, 0)
  const colWidths = colWeights.map((w) => (w / weightSum) * usableWidth)
  const colXs: number[] = []
  {
    let acc = marginX
    for (const w of colWidths) {
      colXs.push(acc)
      acc += w
    }
  }

  const rowHeight = 14
  const headerHeight = 22
  const fontBody = 6.8
  const fontHeader = 6.5

  let y = marginY

  const paintTitle = () => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.setTextColor(16, 57, 111)
    pdf.text(titulo, pageWidth / 2, y + 6, { align: 'center' })
    y += 22
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(90, 90, 90)
    pdf.text('Valores em R$ (reais)', marginX, y)
    y += 12
  }

  const paintResumo = () => {
    const cards = [
      { label: 'Valor pago', value: currencyFormatter.format(relatorio.totalPago) },
      { label: 'Valor devido', value: currencyFormatter.format(relatorio.totalDevido) },
      {
        label: 'Cobrado em excesso',
        value: currencyFormatter.format(relatorio.totalExcesso),
      },
      {
        label: 'Dobro do excesso',
        value: currencyFormatter.format(relatorio.totalExcesso * 2),
      },
    ]
    const gap = 8
    const cardW = (usableWidth - gap * 3) / 4
    const cardH = 36
    cards.forEach((card, i) => {
      const x = marginX + i * (cardW + gap)
      pdf.setFillColor(235, 242, 250)
      pdf.setDrawColor(180, 200, 220)
      pdf.roundedRect(x, y, cardW, cardH, 4, 4, 'FD')
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(70, 90, 120)
      pdf.text(card.label, x + 8, y + 12)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(15, 47, 95)
      drawPdfTextFit(pdf, card.value, x + 6, y + 25, cardW - 12, 'left', 9)
    })
    y += cardH + 14
  }

  const alignForColumn = (i: number): 'left' | 'right' | 'center' => {
    if (i === 0) return 'left'
    if (i === 6 || i === 7) return 'center'
    return 'right'
  }

  const paintColumnRules = (top: number, height: number) => {
    pdf.setDrawColor(210, 220, 230)
    pdf.setLineWidth(0.25)
    for (let i = 1; i < colXs.length; i += 1) {
      pdf.line(colXs[i], top, colXs[i], top + height)
    }
  }

  const paintTableHeader = () => {
    pdf.setFillColor(16, 57, 111)
    pdf.rect(marginX, y, usableWidth, headerHeight, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(fontHeader)
    headers.forEach((header, i) => {
      const lines = pdf.splitTextToSize(header, colWidths[i] - 7)
      const lineH = 8
      const startY = y + (headerHeight - lines.length * lineH) / 2 + lineH / 2
      ;(lines as string[]).forEach((line, li) => {
        drawPdfTextFit(
          pdf,
          line,
          colXs[i],
          startY + li * lineH,
          colWidths[i],
          'center',
          fontHeader,
        )
      })
    })
    pdf.setDrawColor(255, 255, 255)
    pdf.setLineWidth(0.35)
    for (let i = 1; i < colXs.length; i += 1) {
      pdf.line(colXs[i], y + 3, colXs[i], y + headerHeight - 3)
    }
    y += headerHeight
  }

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - marginY) return
    pdf.addPage()
    y = marginY
    paintTableHeader()
  }

  const paintDataRow = (cells: string[], opts?: { bold?: boolean; fill?: boolean }) => {
    ensureSpace(rowHeight)
    if (opts?.fill) {
      pdf.setFillColor(245, 248, 252)
      pdf.rect(marginX, y, usableWidth, rowHeight, 'F')
    }
    paintColumnRules(y, rowHeight)
    pdf.setDrawColor(220, 228, 236)
    pdf.setLineWidth(0.3)
    pdf.line(marginX, y + rowHeight, marginX + usableWidth, y + rowHeight)

    pdf.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
    pdf.setTextColor(30, 30, 30)
    cells.forEach((cell, i) => {
      drawPdfTextFit(
        pdf,
        cell,
        colXs[i],
        y + rowHeight / 2,
        colWidths[i],
        alignForColumn(i),
        fontBody,
      )
    })
    y += rowHeight
  }

  paintTitle()
  if (incluirResumo) paintResumo()
  paintTableHeader()

  relatorio.rows.forEach((r, idx) => {
    paintDataRow(
      [
        r.pagamento || '-',
        formatPdfMoney(r.vc),
        formatPdfMoney(r.renegociacao),
        formatPdfMoney(r.multa),
        formatPdfMoney(r.jurosMora),
        formatPdfMoney(r.descontos),
        formatPdfMoney(r.taxasAdicionais),
        r.erroIndice
          ? r.erroIndice
          : `${formatPercent4(r.incc)}${r.janela ? ` ${r.janela}` : ''}`,
        formatPdfMoney(r.devido),
        formatPdfMoney(r.vp),
        formatPdfMoney(r.excesso),
      ],
      { fill: idx % 2 === 1 },
    )
  })

  paintDataRow(
    [
      'Total',
      '',
      formatPdfMoney(relatorio.totalRenegociacao),
      formatPdfMoney(relatorio.totalMulta),
      formatPdfMoney(relatorio.totalJurosMora),
      formatPdfMoney(relatorio.totalDescontos),
      formatPdfMoney(relatorio.totalTaxasAdicionais),
      '',
      formatPdfMoney(relatorio.totalDevido),
      formatPdfMoney(relatorio.totalPago),
      formatPdfMoney(relatorio.totalExcesso),
    ],
    { bold: true, fill: true },
  )

  return pdf
}

export function gerarMemoriaCalculoPdfBlob(
  relatorio: MemoriaCalculoRelatorio,
  opcoes?: { incluirResumo?: boolean; titulo?: string },
): Blob {
  return gerarMemoriaCalculoPdf(relatorio, opcoes).output('blob')
}

export function nomeArquivoMemoriaRevisaoIncc(cliente: string) {
  const slug = cliente
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `memoria-calculo-revisao-incc${slug ? `-${slug}` : ''}.pdf`
}
