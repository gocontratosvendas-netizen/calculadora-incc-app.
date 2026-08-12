import { useMemo, useRef, useState } from 'react'
import './App.css'
import { calcularFatorCorrecaoPorAniversarios } from './inccTable'
import { parseExtratoFinanceiroPdf } from './parseExtratoPdf'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function App() {
  type Linha = {
    id: string
    dataPagamento: string // yyyy-mm-dd
    valorContratual: string
    valorPago: string
    renegociacao: string
    multa: string
    descontos: string
    jurosMora: string
    taxasAdicionais: string
  }

  function criarLinhaVazia(): Linha {
    return {
      id: crypto.randomUUID(),
      dataPagamento: '',
      valorContratual: '',
      valorPago: '',
      renegociacao: '0,00',
      multa: '0,00',
      descontos: '0,00',
      jurosMora: '0,00',
      taxasAdicionais: '0,00',
    }
  }

  const mockLinhas = useMemo((): Linha[] => {
    const mk = (
      dataPagamento: string,
      valorContratual: string,
      valorPago: string,
      extras?: Partial<
        Pick<Linha, 'renegociacao' | 'multa' | 'descontos' | 'jurosMora' | 'taxasAdicionais'>
      >,
    ): Linha => ({
      id: crypto.randomUUID(),
      dataPagamento,
      valorContratual,
      valorPago,
      renegociacao: extras?.renegociacao ?? '0,00',
      multa: extras?.multa ?? '0,00',
      descontos: extras?.descontos ?? '0,00',
      jurosMora: extras?.jurosMora ?? '0,00',
      taxasAdicionais: extras?.taxasAdicionais ?? '0,00',
    })

    // Mock baseado na planilha enviada (valores em BRL com vírgula decimal).
    return [
      mk('2021-06-23', '108.604,00', '108.604,00'),
      mk('2021-07-15', '2.500,00', '2.650,00'),
      mk('2021-08-20', '2.500,00', '2.610,70'),
      mk('2021-09-10', '2.500,00', '2.032,80'),
      mk('2021-10-10', '2.500,00', '2.045,00'),
      mk('2021-11-15', '2.500,00', '2.658,40'),
      mk('2021-12-15', '2.500,00', '2.207,40'),
      mk('2022-01-15', '2.500,00', '2.200,32'),
      mk('2022-02-15', '2.500,00', '2.708,77'),
      mk('2022-03-15', '2.500,00', '2.720,00'),
      mk('2022-04-14', '2.500,00', '2.738,36'),
      mk('2022-05-16', '2.500,00', '2.701,91'),
      mk('2022-06-15', '2.500,00', '2.581,15'),
      mk('2022-07-15', '2.500,00', '2.851,72'),
      mk('2022-08-15', '2.500,00', '2.912,75'),
      mk('2022-09-15', '2.500,00', '2.037,80'),
      mk('2022-10-17', '2.500,00', '2.940,44'),
      mk('2022-11-16', '2.500,00', '2.943,09'),
      mk('2022-12-29', '5.000,00', '5.000,00'),
      mk('2023-01-16', '2.500,00', '2.957,23'),
      mk('2023-02-15', '2.500,00', '2.959,80'),
      mk('2023-03-15', '2.500,00', '2.973,51'),
      mk('2023-04-17', '2.500,00', '2.974,99'),
      mk('2023-05-15', '2.500,00', '2.929,00'),
      mk('2023-06-16', '2.500,00', '3.003,72'),
      mk('2023-07-17', '2.500,00', '3.010,73'),
      mk('2023-11-14', '5.000,00', '5.000,00'),
      mk('2024-01-15', '409.080,00', '300.000,00'),
      mk('2024-11-14', '5.000,00', '1.104,50'),
    ]
  }, [])

  const [tela, setTela] = useState<'entrada' | 'resultado'>('entrada')
  const [dataAniversarioManual, setDataAniversarioManual] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([criarLinhaVazia()])
  const [edicaoValorPago, setEdicaoValorPago] = useState<{
    linhaId: string
    valorPago: string
  } | null>(null)
  const [popupExportarAberto, setPopupExportarAberto] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [importandoPdf, setImportandoPdf] = useState(false)
  const [mensagemImportacao, setMensagemImportacao] = useState<string | null>(null)

  const exportRelatorioCompletoRef = useRef<HTMLDivElement | null>(null)
  const exportMemoriaRef = useRef<HTMLDivElement | null>(null)
  const pdfInputRef = useRef<HTMLInputElement | null>(null)

  async function handleImportarPdf(file: File) {
    setImportandoPdf(true)
    setMensagemImportacao(null)
    try {
      const resultado = await parseExtratoFinanceiroPdf(file)
      if (!resultado.lancamentos.length) {
        setMensagemImportacao(
          'Não encontrei lançamentos neste PDF. Confira se é um Extrato Financeiro/Extrato de Cliente.',
        )
        return
      }

      const novasLinhas: Linha[] = resultado.lancamentos.map((l) => ({
        id: crypto.randomUUID(),
        dataPagamento: l.dataPagamento,
        valorContratual: l.valorContratual,
        valorPago: l.valorPago,
        renegociacao: l.renegociacao,
        multa: l.multa,
        descontos: l.descontos,
        jurosMora: l.jurosMora,
        taxasAdicionais: l.taxasAdicionais,
      }))

      setLinhas(novasLinhas)
      setDataAniversarioManual(
        resultado.dataAssinatura ?? novasLinhas[0]?.dataPagamento ?? '',
      )
      setMensagemImportacao(
        `PDF importado: ${novasLinhas.length} lançamento(s)${
          resultado.dataAssinatura
            ? ` · aniversário ${resultado.dataAssinatura.split('-').reverse().join('/')}`
            : ''
        }.`,
      )
    } catch (err) {
      console.error(err)
      setMensagemImportacao(
        'Falha ao ler o PDF. Tente outro arquivo ou informe o erro do console.',
      )
    } finally {
      setImportandoPdf(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ''
    }
  }

  async function exportarElementoComoPdf(
    element: HTMLElement,
    nomeArquivo: string,
    orientation: 'portrait' | 'landscape' = 'landscape',
    titulo = 'Memória de cálculo',
  ) {
    setExportando(true)
    const restoreStyles: Array<() => void> = []
    try {
      // dá tempo da UI (popup) fechar e layout estabilizar
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 50))

      // Expande wraps/tabelas para o html2canvas não cortar colunas (overflow:auto)
      element.classList.add('is-exporting-pdf')
      restoreStyles.push(() => element.classList.remove('is-exporting-pdf'))

      for (const wrap of element.querySelectorAll<HTMLElement>('.table-wrap')) {
        const prev = {
          overflow: wrap.style.overflow,
          width: wrap.style.width,
          maxWidth: wrap.style.maxWidth,
        }
        wrap.style.overflow = 'visible'
        wrap.style.width = 'max-content'
        wrap.style.maxWidth = 'none'
        restoreStyles.push(() => {
          wrap.style.overflow = prev.overflow
          wrap.style.width = prev.width
          wrap.style.maxWidth = prev.maxWidth
        })
      }

      for (const table of element.querySelectorAll<HTMLElement>('.data-table')) {
        const prev = {
          width: table.style.width,
          minWidth: table.style.minWidth,
          tableLayout: table.style.tableLayout,
        }
        table.style.width = 'max-content'
        table.style.minWidth = 'max-content'
        table.style.tableLayout = 'auto'
        restoreStyles.push(() => {
          table.style.width = prev.width
          table.style.minWidth = prev.minWidth
          table.style.tableLayout = prev.tableLayout
        })
      }

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

      const captureWidth = Math.max(
        element.scrollWidth,
        element.offsetWidth,
        ...[...element.querySelectorAll<HTMLElement>('.table-wrap, .data-table')].map(
          (el) => Math.max(el.scrollWidth, el.offsetWidth),
        ),
      )
      const captureHeight = Math.max(element.scrollHeight, element.offsetHeight)

      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        ignoreElements: (el) => el.classList?.contains('no-export') ?? false,
        width: captureWidth,
        height: captureHeight,
        windowWidth: captureWidth,
        windowHeight: captureHeight,
        onclone: (_doc, cloned) => {
          cloned.classList.add('is-exporting-pdf')
          for (const el of cloned.querySelectorAll('.no-export')) {
            el.remove()
          }
          for (const wrap of cloned.querySelectorAll<HTMLElement>('.table-wrap')) {
            wrap.style.overflow = 'visible'
            wrap.style.width = 'max-content'
            wrap.style.maxWidth = 'none'
          }
          for (const table of cloned.querySelectorAll<HTMLElement>('.data-table')) {
            table.style.width = 'max-content'
            table.style.minWidth = 'max-content'
            table.style.tableLayout = 'auto'
          }
          for (const cell of cloned.querySelectorAll<HTMLElement>(
            '.data-table th, .data-table td',
          )) {
            cell.style.overflow = 'visible'
            cell.style.textOverflow = 'clip'
            cell.style.whiteSpace = 'nowrap'
            cell.style.fontSize = '9px'
            cell.style.padding = '5px 6px'
          }
        },
      })

      const pdf = new jsPDF({
        orientation,
        unit: 'pt',
        format: 'a4',
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const marginX = 24
      const marginY = 28
      const titleGap = 28
      const contentWidth = pageWidth - marginX * 2
      const firstPageContentTop = marginY + titleGap
      const firstPageContentHeight = pageHeight - firstPageContentTop - marginY
      const otherPageContentHeight = pageHeight - marginY * 2

      // escala a imagem para caber na largura útil (com margem)
      const scale = contentWidth / canvas.width
      const pageCanvas = document.createElement('canvas')
      const pageCtx = pageCanvas.getContext('2d')
      if (!pageCtx) throw new Error('Não foi possível criar canvas para o PDF.')

      pageCanvas.width = canvas.width

      let sourceY = 0
      let pageIndex = 0

      while (sourceY < canvas.height) {
        const isFirstPage = pageIndex === 0
        const availableHeightPt = isFirstPage ? firstPageContentHeight : otherPageContentHeight
        const sliceHeightPx = Math.min(
          Math.floor(availableHeightPt / scale),
          canvas.height - sourceY,
        )

        pageCanvas.height = sliceHeightPx
        pageCtx.fillStyle = '#ffffff'
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
        pageCtx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sliceHeightPx,
          0,
          0,
          pageCanvas.width,
          sliceHeightPx,
        )

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.92)
        if (pageIndex > 0) pdf.addPage()

        // fundo branco + título na primeira página
        pdf.setFillColor(255, 255, 255)
        pdf.rect(0, 0, pageWidth, pageHeight, 'F')

        if (isFirstPage) {
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(16)
          pdf.setTextColor(16, 57, 111)
          pdf.text(titulo, pageWidth / 2, marginY + 8, { align: 'center' })
        }

        const drawY = isFirstPage ? firstPageContentTop : marginY
        const drawHeight = sliceHeightPx * scale
        pdf.addImage(imgData, 'JPEG', marginX, drawY, contentWidth, drawHeight)

        sourceY += sliceHeightPx
        pageIndex += 1
      }

      pdf.save(nomeArquivo)
    } catch (err) {
      console.error(err)
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Erro desconhecido'
      alert(`Não foi possível exportar o PDF.\n\nDetalhes: ${msg}`)
    } finally {
      for (const restore of restoreStyles.reverse()) restore()
      setExportando(false)
    }
  }

  function exportarMemoriaComoExcel(nomeArquivo: string) {
    const header = [
      'Pagamento',
      'Valor contratual',
      'Renegociação',
      'Multa',
      'Juros de mora',
      'Descontos',
      'Taxas adicionais',
      'INCC acumulado',
      'Valor devido',
      'Valor pago',
      'Valor cobrado em excesso',
    ]

    const rows = relatorio.rows.map((r) => [
      r.pagamento,
      r.vc,
      r.renegociacao,
      r.multa,
      r.jurosMora,
      r.descontos,
      r.taxasAdicionais,
      r.incc == null ? null : Number(r.incc.toFixed(2)),
      r.devido,
      r.vp,
      r.excesso,
    ])

    const totalRow = [
      'Total',
      null,
      relatorio.totalRenegociacao,
      relatorio.totalMulta,
      relatorio.totalJurosMora,
      relatorio.totalDescontos,
      relatorio.totalTaxasAdicionais,
      null,
      relatorio.totalDevido,
      relatorio.totalPago,
      relatorio.totalExcesso,
    ]

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows, totalRow])

    ws['!cols'] = [
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 22 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Memoria')
    XLSX.writeFile(wb, nomeArquivo)
  }

  function parseMoney(value: string) {
    const normalized = value
      .replace(/\s/g, '')
      .replace('R$', '')
      .replace(/\./g, '')
      .replace(',', '.')
    const num = Number(normalized)
    return Number.isFinite(num) ? num : 0
  }

  function parseDate(value: string) {
    // yyyy-mm-dd
    const [y, m, d] = value.split('-').map(Number)
    if (!y || !m || !d) return null
    const date = new Date(y, m - 1, d)
    if (Number.isNaN(date.getTime())) return null
    return date
  }

  const relatorio = useMemo(() => {
    const linhasValidas = linhas
      .map((l) => ({
        ...l,
        data: parseDate(l.dataPagamento),
        vc: parseMoney(l.valorContratual),
        vp: parseMoney(l.valorPago),
        renegociacao: parseMoney(l.renegociacao),
        multa: parseMoney(l.multa),
        descontos: parseMoney(l.descontos),
        jurosMora: parseMoney(l.jurosMora),
        taxasAdicionais: parseMoney(l.taxasAdicionais),
      }))
      .filter((l) => l.data && l.vc > 0)
      .sort((a, b) => a.data!.getTime() - b.data!.getTime())

    const inicioEfetivo = parseDate(dataAniversarioManual) ?? (linhasValidas[0]?.data ?? null)

    const rows = linhasValidas.map((l) => {
      const baseInicio = inicioEfetivo ?? l.data!
      const { fator, ultimaTaxa } = calcularFatorCorrecaoPorAniversarios(baseInicio, l.data!)
      const baseCorrigida = l.vc * fator
      const encargos =
        l.renegociacao + l.multa + l.jurosMora + l.taxasAdicionais - l.descontos
      const devido = baseCorrigida + encargos
      const excesso = l.vp - devido
      return {
        id: l.id,
        pagamento: l.dataPagamento,
        vc: l.vc,
        vp: l.vp,
        renegociacao: l.renegociacao,
        multa: l.multa,
        descontos: l.descontos,
        jurosMora: l.jurosMora,
        taxasAdicionais: l.taxasAdicionais,
        incc: ultimaTaxa,
        baseCorrigida,
        devido,
        excesso,
      }
    })

    const totalDevido = rows.reduce((acc, r) => acc + r.devido, 0)
    const totalPago = rows.reduce((acc, r) => acc + r.vp, 0)
    const totalExcesso = rows.reduce((acc, r) => acc + r.excesso, 0)
    const totalRenegociacao = rows.reduce((acc, r) => acc + r.renegociacao, 0)
    const totalMulta = rows.reduce((acc, r) => acc + r.multa, 0)
    const totalDescontos = rows.reduce((acc, r) => acc + r.descontos, 0)
    const totalJurosMora = rows.reduce((acc, r) => acc + r.jurosMora, 0)
    const totalTaxasAdicionais = rows.reduce((acc, r) => acc + r.taxasAdicionais, 0)

    return {
      inicioEfetivo,
      rows,
      totalDevido,
      totalPago,
      totalExcesso,
      totalRenegociacao,
      totalMulta,
      totalDescontos,
      totalJurosMora,
      totalTaxasAdicionais,
    }
  }, [linhas, dataAniversarioManual])

  const linhaEmEdicao = useMemo(() => {
    if (!edicaoValorPago) return null
    return linhas.find((l) => l.id === edicaoValorPago.linhaId) ?? null
  }, [edicaoValorPago, linhas])

  const resumoLancamentos = useMemo(() => {
    const totalLinhas = linhas.length
    const linhasComData = linhas.filter((l) => Boolean(parseDate(l.dataPagamento))).length
    const linhasComPagamento = linhas.filter((l) => parseMoney(l.valorPago) > 0).length
    return { totalLinhas, linhasComData, linhasComPagamento }
  }, [linhas])

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Calculadora INCC</h1>
        <p>
          Lançamento de pagamentos e relatório em formato de planilha (correção no
          aniversário do contrato).
        </p>
      </header>

      <main className="app-main">
        {tela === 'entrada' ? (
          <section className="card card-wide launch-card">
            <div className="launch-header">
              <div>
                <h2>1) Lançamento dos pagamentos</h2>
                <p className="launch-subtitle">
                  Preencha os lançamentos mensais para gerar o relatório de cobrança.
                </p>
              </div>
              <div className="launch-kpis">
                <div className="launch-kpi">
                  <span>Linhas</span>
                  <strong>{resumoLancamentos.totalLinhas}</strong>
                </div>
                <div className="launch-kpi">
                  <span>Com data</span>
                  <strong>{resumoLancamentos.linhasComData}</strong>
                </div>
                <div className="launch-kpi">
                  <span>Com valor pago</span>
                  <strong>{resumoLancamentos.linhasComPagamento}</strong>
                </div>
              </div>
            </div>

            <div className="form-grid form-grid-3">
              <div className="field">
                <label>Data de início do contrato (aniversário)</label>
                <div className="aniversario-inline">
                  <span className="aniversario-helper">
                    Defina a data de aniversário (se vazio, usamos a 1ª linha).
                  </span>
                  <div className="aniversario-input-row">
                    <input
                      type="date"
                      className="table-input aniversario-input"
                      value={
                        dataAniversarioManual ||
                        (relatorio.inicioEfetivo
                          ? `${relatorio.inicioEfetivo.getFullYear()}-${String(
                              relatorio.inicioEfetivo.getMonth() + 1,
                            ).padStart(2, '0')}-${String(relatorio.inicioEfetivo.getDate()).padStart(2, '0')}`
                          : '')
                      }
                      onChange={(e) => setDataAniversarioManual(e.target.value)}
                    />
                    <button
                      type="button"
                      className="ghost-button aniversario-reset"
                      onClick={() => setDataAniversarioManual('')}
                    >
                      Usar 1ª linha
                    </button>
                  </div>
                </div>
              </div>
              <div className="field field-help">
                <span className="help-title">Como é calculado</span>
                <span className="help-text">
                  No aniversário, aplicamos o INCC-DI acumulado em 12 meses do mês do aniversário.
                </span>
              </div>
            </div>

            <div className="table-wrap launch-table-wrap">
              <table className="data-table launch-table launch-table-wide">
                <thead>
                  <tr>
                    <th>Data pagamento</th>
                    <th>Valor contratual</th>
                    <th>Renegociação</th>
                    <th>Multa</th>
                    <th>Juros de mora</th>
                    <th>Descontos</th>
                    <th>Taxas adicionais</th>
                    <th>Valor pago</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => (
                    <tr key={linha.id}>
                      <td>
                        <input
                          className="table-input"
                          type="date"
                          value={linha.dataPagamento}
                          onChange={(e) => {
                            const v = e.target.value
                            setLinhas((prev) =>
                              prev.map((p) => (p.id === linha.id ? { ...p, dataPagamento: v } : p)),
                            )
                          }}
                        />
                      </td>
                      {(
                        [
                          ['valorContratual', 'ex: 2.500,00'],
                          ['renegociacao', '0,00'],
                          ['multa', '0,00'],
                          ['jurosMora', '0,00'],
                          ['descontos', '0,00'],
                          ['taxasAdicionais', '0,00'],
                          ['valorPago', 'ex: 2.650,00'],
                        ] as const
                      ).map(([campo, placeholder]) => (
                        <td key={campo}>
                          <input
                            className="table-input"
                            inputMode="decimal"
                            placeholder={placeholder}
                            value={linha[campo]}
                            onChange={(e) => {
                              const v = e.target.value
                              setLinhas((prev) =>
                                prev.map((p) => (p.id === linha.id ? { ...p, [campo]: v } : p)),
                              )
                            }}
                          />
                        </td>
                      ))}
                      <td className="table-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() =>
                            setLinhas((prev) => prev.filter((p) => p.id !== linha.id))
                          }
                          disabled={linhas.length === 1}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="actions-row launch-actions-row">
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden-file-input"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleImportarPdf(file)
                }}
              />
              <button
                type="button"
                className="secondary-button"
                disabled={importandoPdf}
                onClick={() => pdfInputRef.current?.click()}
              >
                {importandoPdf ? 'Lendo PDF...' : 'Importar PDF do extrato'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setLinhas(mockLinhas)
                  setDataAniversarioManual(mockLinhas[0]?.dataPagamento ?? '')
                }}
              >
                Carregar exemplo da planilha
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setLinhas((prev) => [...prev, criarLinhaVazia()])}
              >
                Adicionar linha
              </button>
              <button type="button" className="primary-button" onClick={() => setTela('resultado')}>
                Ver relatório
              </button>
            </div>
            {mensagemImportacao ? (
              <p className="import-feedback">{mensagemImportacao}</p>
            ) : null}
          </section>
        ) : (
          <section className="card card-wide report-card">
            <div className="results-header">
              <h2>2) Relatório (planilha)</h2>
              <div className="results-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPopupExportarAberto(true)}
                  disabled={exportando}
                >
                  {exportando ? 'Exportando...' : 'Exportar'}
                </button>
                <button type="button" className="secondary-button" onClick={() => setTela('entrada')}>
                  Voltar
                </button>
              </div>
            </div>

            <div className="export-scope" ref={exportRelatorioCompletoRef}>
              <div className="kpi-grid" aria-label="Resumo do relatório">
                <div className="kpi-card">
                  <span className="kpi-label">Valor pago</span>
                  <span className="kpi-value">{currencyFormatter.format(relatorio.totalPago)}</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Valor devido</span>
                  <span className="kpi-value">{currencyFormatter.format(relatorio.totalDevido)}</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Valor cobrado em excesso</span>
                  <span className="kpi-value kpi-accent">
                    {currencyFormatter.format(relatorio.totalExcesso)}
                  </span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Dobro do cobrado em excesso</span>
                  <span className="kpi-value kpi-accent-strong">
                    {currencyFormatter.format(relatorio.totalExcesso * 2)}
                  </span>
                </div>
              </div>

              <div className="export-scope" ref={exportMemoriaRef}>
                <div className="table-wrap">
                  <table className="data-table report-table-wide">
                    <thead>
                      <tr>
                        <th>Pagamento</th>
                        <th>Valor contratual</th>
                        <th>Renegociação</th>
                        <th>Multa</th>
                        <th>Juros mora</th>
                        <th>Descontos</th>
                        <th>Taxas adic.</th>
                        <th>INCC acum.</th>
                        <th>Valor devido</th>
                        <th>Valor pago</th>
                        <th className="no-export">Ação</th>
                        <th>Excesso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.rows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.pagamento || '-'}</td>
                          <td>{currencyFormatter.format(r.vc)}</td>
                          <td>{currencyFormatter.format(r.renegociacao)}</td>
                          <td>{currencyFormatter.format(r.multa)}</td>
                          <td>{currencyFormatter.format(r.jurosMora)}</td>
                          <td>{currencyFormatter.format(r.descontos)}</td>
                          <td>{currencyFormatter.format(r.taxasAdicionais)}</td>
                          <td>{r.incc == null ? '-' : `${r.incc.toFixed(2)}%`}</td>
                          <td>{currencyFormatter.format(r.devido)}</td>
                          <td>{currencyFormatter.format(r.vp)}</td>
                          <td className="table-actions no-export">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => {
                                const linha = linhas.find((l) => l.id === r.id)
                                setEdicaoValorPago({
                                  linhaId: r.id,
                                  valorPago: linha?.valorPago ?? '',
                                })
                              }}
                            >
                              Editar
                            </button>
                          </td>
                          <td className={r.excesso >= 0 ? 'excesso-pos' : 'excesso-neg'}>
                            {currencyFormatter.format(r.excesso)}
                          </td>
                        </tr>
                      ))}
                      <tr className="table-total">
                        <td>Total</td>
                        <td></td>
                        <td>{currencyFormatter.format(relatorio.totalRenegociacao)}</td>
                        <td>{currencyFormatter.format(relatorio.totalMulta)}</td>
                        <td>{currencyFormatter.format(relatorio.totalJurosMora)}</td>
                        <td>{currencyFormatter.format(relatorio.totalDescontos)}</td>
                        <td>{currencyFormatter.format(relatorio.totalTaxasAdicionais)}</td>
                        <td></td>
                        <td>{currencyFormatter.format(relatorio.totalDevido)}</td>
                        <td>{currencyFormatter.format(relatorio.totalPago)}</td>
                        <td className="no-export"></td>
                        <td>{currencyFormatter.format(relatorio.totalExcesso)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <p className="result-highlight">
              Observação: Valor devido = (Valor contratual × fator INCC) + Renegociação + Multa +
              Juros de mora + Taxas adicionais − Descontos. A correção INCC só começa após o 1º
              aniversário.
            </p>
          </section>
        )}
      </main>

      {popupExportarAberto ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Exportar relatório"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPopupExportarAberto(false)
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h3>Exportar</h3>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setPopupExportarAberto(false)}
              >
                Fechar
              </button>
            </div>

            <div className="modal-body">
              <div className="export-options">
                <button
                  type="button"
                  className="primary-button"
                  disabled={exportando}
                  onClick={async () => {
                    const el = exportRelatorioCompletoRef.current
                    if (!el) return
                    setPopupExportarAberto(false)
                    await exportarElementoComoPdf(
                      el,
                      'relatorio-completo.pdf',
                      'landscape',
                      'Memória de cálculo',
                    )
                  }}
                >
                  Relatório completo (PDF)
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={exportando}
                  onClick={() => {
                    setPopupExportarAberto(false)
                    exportarMemoriaComoExcel('memoria-de-calculos.xlsx')
                  }}
                >
                  Memória de cálculo (Excel)
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={exportando}
                  onClick={async () => {
                    const el = exportMemoriaRef.current
                    if (!el) return
                    setPopupExportarAberto(false)
                    await exportarElementoComoPdf(
                      el,
                      'memoria-de-calculos.pdf',
                      'landscape',
                      'Memória de cálculo',
                    )
                  }}
                >
                  Memória de cálculo (PDF)
                </button>
              </div>
              <p className="result-highlight">
                Dica: o PDF é gerado com base na renderização da tela (fica igualzinho ao relatório).
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {edicaoValorPago ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Editar valor pago"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEdicaoValorPago(null)
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h3>Editar valor pago</h3>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setEdicaoValorPago(null)}
              >
                Fechar
              </button>
            </div>

            <div className="modal-body">
              <div className="field">
                <label>Pagamento</label>
                <div className="readonly-pill">
                  {linhaEmEdicao?.dataPagamento
                    ? new Date(linhaEmEdicao.dataPagamento).toLocaleDateString('pt-BR')
                    : '-'}
                </div>
              </div>
              <div className="field">
                <label htmlFor="novoValorPago">Novo valor pago</label>
                <input
                  id="novoValorPago"
                  className="table-input"
                  inputMode="decimal"
                  placeholder="ex: 2.650,00"
                  value={edicaoValorPago.valorPago}
                  onChange={(e) =>
                    setEdicaoValorPago((prev) => (prev ? { ...prev, valorPago: e.target.value } : prev))
                  }
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEdicaoValorPago(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setLinhas((prev) =>
                    prev.map((l) =>
                      l.id === edicaoValorPago.linhaId
                        ? { ...l, valorPago: edicaoValorPago.valorPago }
                        : l,
                    ),
                  )
                  setEdicaoValorPago(null)
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="app-footer">
        <small>Simulador ilustrativo. Confirme sempre os índices oficiais.</small>
      </footer>
    </div>
  )
}

export default App
