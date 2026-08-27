import { useMemo, useRef, useState } from 'react'
import './App.css'
import { arredondarMoeda, calcularFatorCorrecaoPorAniversarios, formatarAnoMes, mesBaseDoIndice, type DefasagemMeses } from './inccTable'
import { cadastrarCaso } from './lib/casos'
import { mensagemErroSupabase } from './lib/supabase'
import {
  gerarMemoriaCalculoPdf,
  gerarMemoriaCalculoPdfBlob,
  nomeArquivoMemoriaRevisaoIncc,
} from './lib/memoriaCalculoPdf'
import { useRouter } from './lib/router-context'
import { parseExtratoFinanceiroPdf, PdfSemCamadaDeTextoError } from './parseExtratoPdf'
import * as XLSX from 'xlsx'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

let ultimoNomePdfImportado = ''

const MENSAGEM_IMAGEM_EXTRATO =
  'Esta é uma foto do extrato, não o PDF. A calculadora já lê o Relatório de Extrato do Cliente (CivilWeb), mas só com a camada de texto do PDF — JPEG/PNG, principalmente pelo WhatsApp, embaralha os valores. Peça ao cliente o PDF desse mesmo relatório (imprimir ou exportar em PDF no CivilWeb) e arraste aqui.'

const MENSAGEM_PDF_SO_IMAGEM =
  'Este PDF é a foto do extrato salva como PDF — não tem texto selecionável. Converter JPEG em PDF não resolve. Peça ao cliente o arquivo gerado pelo CivilWeb (imprimir ou exportar PDF na tela do Relatório de Extrato), não uma captura de tela.'

function ehImagemExtrato(file: File) {
  if (file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif|tiff?)$/i.test(file.name)
}

function formatDataCurta(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y.slice(2)}`
}

function formatDataBase(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

function formatMesAnoExtenso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, d),
  )
}

function formatCelulaNumero(value: number) {
  if (value === 0) return '—'
  return numberFormatter.format(value)
}

function formatPercent4(value: number) {
  return `${value.toFixed(4).replace('.', ',')}%`
}

function App() {
  const { navigate } = useRouter()

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
  const [defasagemMeses, setDefasagemMeses] = useState<DefasagemMeses>(0)
  const [linhas, setLinhas] = useState<Linha[]>([criarLinhaVazia()])
  const [edicaoValorPago, setEdicaoValorPago] = useState<{
    linhaId: string
    valorPago: string
  } | null>(null)
  const [popupExportarAberto, setPopupExportarAberto] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [importandoPdf, setImportandoPdf] = useState(false)
  const [mensagemImportacao, setMensagemImportacao] = useState<string | null>(null)
  const [detalharAjustes, setDetalharAjustes] = useState(false)
  const [popupCadastrarClienteAberto, setPopupCadastrarClienteAberto] = useState(false)
  const [nomeClienteCaso, setNomeClienteCaso] = useState('')
  const [empreendimentoCaso, setEmpreendimentoCaso] = useState('')
  const [incorporadoraCaso, setIncorporadoraCaso] = useState('')
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false)
  const [erroCadastroCliente, setErroCadastroCliente] = useState<string | null>(null)

  const pdfInputRef = useRef<HTMLInputElement | null>(null)

  async function handleImportarPdf(file: File) {
    if (ehImagemExtrato(file)) {
      setMensagemImportacao(MENSAGEM_IMAGEM_EXTRATO)
      if (pdfInputRef.current) pdfInputRef.current.value = ''
      return
    }

    setImportandoPdf(true)
    setMensagemImportacao(null)
    try {
      const resultado = await parseExtratoFinanceiroPdf(file)
      if (!resultado.lancamentos.length) {
        setMensagemImportacao(
          'Não encontrei lançamentos neste PDF. Confira se é um Extrato Financeiro, Posição Financeira (incl. Portal Benx ou MAC) ou Relação Valores Pagos da incorporadora.',
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
        err instanceof PdfSemCamadaDeTextoError
          ? MENSAGEM_PDF_SO_IMAGEM
          : 'Falha ao ler o PDF. Tente outro arquivo ou informe o erro do console.',
      )
    } finally {
      setImportandoPdf(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ''
    }
  }

  function exportarRelatorioComoPdf(
    nomeArquivo: string,
    opcoes: { incluirResumo: boolean } = { incluirResumo: true },
  ) {
    setExportando(true)
    try {
      const pdf = gerarMemoriaCalculoPdf(relatorio, {
        incluirResumo: opcoes.incluirResumo,
        titulo: opcoes.incluirResumo ? 'Relatório completo' : 'Memória de Cálculo Revisão INCC',
      })
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
      'Janela do índice',
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
      r.incc == null ? null : Number(r.incc.toFixed(4)),
      r.janela,
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
      { wch: 22 },
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

    const maisAntiga = linhasValidas.reduce<Date | null>((acc, l) => {
      const data = l.data!
      if (!acc || data.getTime() < acc.getTime()) return data
      return acc
    }, null)
    const inicioEfetivo = parseDate(dataAniversarioManual) ?? maisAntiga

    const rows = linhasValidas.map((l) => {
      const baseInicio = inicioEfetivo ?? l.data!
      const correcao = calcularFatorCorrecaoPorAniversarios(
        baseInicio,
        l.data!,
        defasagemMeses,
      )
      const encargos =
        l.renegociacao + l.multa + l.jurosMora + l.taxasAdicionais - l.descontos
      const baseCorrigida = correcao.erro ? l.vc : arredondarMoeda(l.vc * correcao.fator)
      const devido = correcao.erro ? l.vc + encargos : arredondarMoeda(baseCorrigida + encargos)
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
        n: correcao.n,
        incc: correcao.acumuladoPercentual,
        janela: correcao.janelaLabel,
        erroIndice: correcao.erro,
        baseCorrigida,
        devido,
        excesso,
      }
    })

    const totalDevido = arredondarMoeda(rows.reduce((acc, r) => acc + r.devido, 0))
    const totalPago = arredondarMoeda(rows.reduce((acc, r) => acc + r.vp, 0))
    const totalExcesso = arredondarMoeda(rows.reduce((acc, r) => acc + r.excesso, 0))
    const totalRenegociacao = rows.reduce((acc, r) => acc + r.renegociacao, 0)
    const totalMulta = rows.reduce((acc, r) => acc + r.multa, 0)
    const totalDescontos = rows.reduce((acc, r) => acc + r.descontos, 0)
    const totalJurosMora = rows.reduce((acc, r) => acc + r.jurosMora, 0)
    const totalTaxasAdicionais = rows.reduce((acc, r) => acc + r.taxasAdicionais, 0)
    const pagamentosIso = rows.map((r) => r.pagamento).slice().sort()
    const ultimaComCorrecao = rows.reduce<(typeof rows)[number] | null>((acc, r) => {
      if (r.n <= 0) return acc
      if (!acc || r.pagamento.localeCompare(acc.pagamento) > 0) return r
      return acc
    }, null)

    return {
      inicioEfetivo,
      indiceBaseLabel: inicioEfetivo
        ? formatarAnoMes(mesBaseDoIndice(inicioEfetivo, defasagemMeses))
        : null,
      errosIndice: [...new Set(rows.map((r) => r.erroIndice).filter((e): e is string => Boolean(e)))],
      rows,
      periodoInicio: pagamentosIso[0] ?? '',
      periodoFim: pagamentosIso[pagamentosIso.length - 1] ?? '',
      inccUltimaCorrecao: ultimaComCorrecao?.incc ?? null,
      totalDevido,
      totalPago,
      totalExcesso,
      totalRenegociacao,
      totalMulta,
      totalDescontos,
      totalJurosMora,
      totalTaxasAdicionais,
    }
  }, [linhas, dataAniversarioManual, defasagemMeses])

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

  const importacaoOk = Boolean(mensagemImportacao?.startsWith('PDF importado'))
  const importacaoErro = Boolean(mensagemImportacao && !importacaoOk)

  function aplicarTextoColado(text: string) {
    const bruto = text.replace(/\r/g, '').trim()
    if (!bruto) return
    const parsed = bruto
      .split('\n')
      .map((linhaTexto) => linhaTexto.split(/\t|;/))
      .filter((cols) => cols.some((c) => c.trim()))
    if (!parsed.length) return
    const start = parsed[0]?.[0] && /data/i.test(parsed[0][0]) ? 1 : 0
    const novas: Linha[] = parsed.slice(start).map((cols) => {
      const base = criarLinhaVazia()
      const rawDate = (cols[0] ?? '').trim()
      let dataPagamento = ''
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        dataPagamento = rawDate
      } else {
        const m = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
        if (m) {
          dataPagamento = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
        }
      }
      const full = cols.length >= 8
      return {
        ...base,
        dataPagamento,
        valorContratual: (cols[1] ?? '').trim(),
        renegociacao: full ? (cols[2] ?? '').trim() || '0,00' : '0,00',
        multa: full ? (cols[3] ?? '').trim() || '0,00' : '0,00',
        jurosMora: full ? (cols[4] ?? '').trim() || '0,00' : '0,00',
        descontos: full ? (cols[5] ?? '').trim() || '0,00' : '0,00',
        taxasAdicionais: full ? (cols[6] ?? '').trim() || '0,00' : '0,00',
        valorPago: (full ? (cols[7] ?? '') : (cols[2] ?? '')).trim(),
      }
    })
    if (!novas.length) return
    setLinhas(novas)
    setDataAniversarioManual(novas[0]?.dataPagamento ?? '')
  }

  const totalContratualEntrada = linhas.reduce((acc, l) => acc + parseMoney(l.valorContratual), 0)
  const totalPagoEntrada = linhas.reduce((acc, l) => acc + parseMoney(l.valorPago), 0)
  const totalRenegociacaoEntrada = linhas.reduce((acc, l) => acc + parseMoney(l.renegociacao), 0)
  const totalMultaEntrada = linhas.reduce((acc, l) => acc + parseMoney(l.multa), 0)
  const totalJurosEntrada = linhas.reduce((acc, l) => acc + parseMoney(l.jurosMora), 0)
  const totalDescontosEntrada = linhas.reduce((acc, l) => acc + parseMoney(l.descontos), 0)
  const totalTaxasEntrada = linhas.reduce((acc, l) => acc + parseMoney(l.taxasAdicionais), 0)

  function abrirPopupCadastrarCliente() {
    setNomeClienteCaso('')
    setEmpreendimentoCaso('')
    setIncorporadoraCaso('')
    setErroCadastroCliente(null)
    setPopupCadastrarClienteAberto(true)
  }

  async function confirmarCadastroCliente() {
    const nome = nomeClienteCaso.trim()
    if (!nome) {
      setErroCadastroCliente('Informe o nome do cliente.')
      return
    }

    const valorContrato = relatorio.rows.reduce((acc, r) => acc + r.vc, 0)
    const excessoApurado = relatorio.totalExcesso > 0 ? relatorio.totalExcesso : null
    const valorCausa = relatorio.totalExcesso > 0 ? relatorio.totalExcesso * 2 : null

    setCadastrandoCliente(true)
    setErroCadastroCliente(null)
    try {
      const blob = gerarMemoriaCalculoPdfBlob(relatorio, { incluirResumo: false })
      const arquivoMemoria = new File([blob], nomeArquivoMemoriaRevisaoIncc(nome), {
        type: 'application/pdf',
      })
      const caso = await cadastrarCaso({
        cliente: nome,
        empreendimento: empreendimentoCaso,
        incorporadora: incorporadoraCaso,
        valorContrato,
        excessoApurado,
        valorCausa,
        memoriaRevisaoIncc: arquivoMemoria,
      })
      setPopupCadastrarClienteAberto(false)
      navigate(`/casos/${caso.id}`)
    } catch (err) {
      setErroCadastroCliente(mensagemErroSupabase(err, 'Não foi possível cadastrar o cliente.'))
    } finally {
      setCadastrandoCliente(false)
    }
  }

  return (
    <div className="app-root">
      {tela === 'entrada' ? (
        <>
          <header className="app-header">
            <h1>Calculadora INCC</h1>
            <p className="app-subtitle">
              Lançamento de pagamentos e apuração da correção no aniversário do contrato.
            </p>
          </header>

          <div
            className={[
              'import-card',
              importacaoOk && !importandoPdf && !importacaoErro ? 'import-card--compact' : '',
              importandoPdf ? 'is-disabled' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.classList.add('is-dragging')
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                e.currentTarget.classList.remove('is-dragging')
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.classList.remove('is-dragging')
              const file = e.dataTransfer.files?.[0]
              if (file) {
                ultimoNomePdfImportado = file.name
                void handleImportarPdf(file)
              }
            }}
          >
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
              className="hidden-file-input"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  ultimoNomePdfImportado = file.name
                  void handleImportarPdf(file)
                }
              }}
            />

            {importandoPdf ? (
              <div className="import-reading">
                <span className="import-spinner" aria-hidden="true" />
                Lendo o extrato…
              </div>
            ) : importacaoOk && !importacaoErro ? (
              <div className="import-compact-row">
                <span>
                  {ultimoNomePdfImportado || 'PDF'} · {resumoLancamentos.totalLinhas}{' '}
                  lançamentos importados
                </span>
                <button
                  type="button"
                  className="import-link"
                  onClick={() => pdfInputRef.current?.click()}
                >
                  Trocar arquivo
                </button>
              </div>
            ) : (
              <>
                <div className="import-main">
                  <div className="import-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </div>
                  <div className="import-copy">
                    <p className="import-title">Importar PDF do extrato</p>
                    <p className="import-hint">
                      Arraste o PDF do extrato financeiro, da posição financeira ou da relação de valores pagos da
                      incorporadora. Foto de tela (JPEG/PNG) não serve — peça o PDF.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={importandoPdf}
                    onClick={() => pdfInputRef.current?.click()}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 16V4M12 4l-4 4M12 4l4 4M4 20h16"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Selecionar arquivo
                  </button>
                </div>
                <div className="import-secondary">
                  <span className="import-manual-label">Prefere lançar manualmente?</span>
                  <button
                    type="button"
                    className="import-link"
                    onClick={() => setLinhas((prev) => [...prev, criarLinhaVazia()])}
                  >
                    Adicionar linha
                  </button>
                  <button
                    type="button"
                    className="import-link"
                    onClick={() => {
                      setLinhas(mockLinhas)
                      setDataAniversarioManual(mockLinhas[0]?.dataPagamento ?? '')
                    }}
                  >
                    Carregar exemplo
                  </button>
                  <button
                    type="button"
                    className="import-link"
                    onClick={() => {
                      void navigator.clipboard
                        .readText()
                        .then(aplicarTextoColado)
                        .catch(() => {})
                    }}
                  >
                    Colar do Excel
                  </button>
                </div>
                {importacaoErro ? (
                  <p className="import-error">
                    {mensagemImportacao}
                    <button
                      type="button"
                      className="import-link"
                      onClick={() => pdfInputRef.current?.click()}
                    >
                      Tentar outro arquivo
                    </button>
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="params-card">
            <div className="params-row">
            <div className="param-field">
              <label htmlFor="dataInicioContrato">Data de início do contrato</label>
              <div className="param-date-wrap">
                <input
                  id="dataInicioContrato"
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="16"
                    rx="2"
                    stroke="#8794A8"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M3 10h18M8 3v4M16 3v4"
                    stroke="#8794A8"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
            <label className="param-check">
              <input
                type="checkbox"
                checked={!dataAniversarioManual}
                onChange={() => setDataAniversarioManual('')}
              />
              Usar a data da 1ª linha
            </label>
            <div className="param-field">
              <label htmlFor="defasagemIndice">Defasagem do índice</label>
              <select
                id="defasagemIndice"
                className="param-select"
                value={defasagemMeses}
                onChange={(e) =>
                  setDefasagemMeses(Number(e.target.value) as DefasagemMeses)
                }
              >
                <option value={0}>Sem defasagem</option>
                <option value={1}>1 mês</option>
                <option value={2}>2 meses</option>
                <option value={3}>3 meses</option>
              </select>
            </div>
            <details className="method-pill">
              <summary>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="#4A6FA8" strokeWidth="1.6" />
                  <path
                    d="M12 11v6M12 8h.01"
                    stroke="#4A6FA8"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <span>
                  INCC-DI acumulado 12 meses · <em>metodologia</em>
                </span>
              </summary>
              <div className="method-panel">
                No aniversário, aplicamos o INCC-DI acumulado em 12 meses. A defasagem só recua
                o índice-base; a faixa continua vindo da data do pagamento.
              </div>
            </details>
            </div>
            {relatorio.indiceBaseLabel ? (
              <p className="param-indice-base">Índice-base: {relatorio.indiceBaseLabel}</p>
            ) : null}
          </div>

          <section className="launch-card">
            <div className="launch-card-bar">
              <span className="launch-card-title">Lançamentos</span>
              <span className="launch-card-meta">
                {resumoLancamentos.totalLinhas} linhas · {resumoLancamentos.linhasComData} com data
                · {resumoLancamentos.linhasComPagamento} com valor pago
              </span>
            </div>

            {linhas.length === 0 ? (
              <p className="launch-empty">
                Nenhum lançamento ainda. Importe o extrato ou adicione uma linha.
              </p>
            ) : (
              <table className="launch-table" role="table">
                <thead>
                  <tr className="launch-groups" role="row">
                    <th role="columnheader" />
                    <th role="columnheader" />
                    <th scope="colgroup" role="columnheader">
                      Contrato
                    </th>
                    <th colSpan={5} scope="colgroup" role="columnheader">
                      Ajustes
                    </th>
                    <th scope="colgroup" role="columnheader">
                      Pago
                    </th>
                    <th role="columnheader" />
                  </tr>
                  <tr className="launch-cols" role="row">
                    <th scope="col" role="columnheader" />
                    <th scope="col" role="columnheader">
                      Data
                      <br />
                      pagamento
                    </th>
                    <th scope="col" role="columnheader">
                      Valor
                      <br />
                      contratual
                    </th>
                    <th scope="col" role="columnheader">
                      Renegociação
                    </th>
                    <th scope="col" role="columnheader">
                      Multa
                    </th>
                    <th scope="col" role="columnheader">
                      Juros
                      <br />
                      de mora
                    </th>
                    <th scope="col" role="columnheader">
                      Descontos
                    </th>
                    <th scope="col" role="columnheader">
                      Taxas
                      <br />
                      adicionais
                    </th>
                    <th scope="col" role="columnheader">
                      Valor
                      <br />
                      pago
                    </th>
                    <th scope="col" role="columnheader" />
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha, index) => (
                    <tr key={linha.id} role="row">
                      <td role="cell">{index + 1}</td>
                      <td
                        role="cell"
                        className={!parseDate(linha.dataPagamento) ? 'is-date-invalid' : undefined}
                      >
                        <input
                          className="table-input"
                          type="date"
                          aria-label={`Data pagamento, linha ${index + 1}`}
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
                          ['valorContratual', 'ex: 2.500,00', 'Valor contratual'],
                          ['renegociacao', '0,00', 'Renegociação'],
                          ['multa', '0,00', 'Multa'],
                          ['jurosMora', '0,00', 'Juros de mora'],
                          ['descontos', '0,00', 'Descontos'],
                          ['taxasAdicionais', '0,00', 'Taxas adicionais'],
                          ['valorPago', 'ex: 2.650,00', 'Valor pago'],
                        ] as const
                      ).map(([campo, placeholder, rotulo]) => (
                        <td
                          key={campo}
                          role="cell"
                          className={parseMoney(linha[campo]) === 0 ? 'is-zero' : undefined}
                        >
                          <input
                            className="table-input"
                            inputMode="decimal"
                            placeholder={placeholder}
                            aria-label={`${rotulo}, linha ${index + 1}`}
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
                      <td role="cell">
                        <button
                          type="button"
                          className="row-delete"
                          aria-label={`Excluir linha ${index + 1}`}
                          onClick={() =>
                            setLinhas((prev) => prev.filter((p) => p.id !== linha.id))
                          }
                          disabled={linhas.length === 1}
                        >
                          <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
                            <path
                              d="M3 3l7 7M10 3l-7 7"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              fill="none"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="launch-totals" role="row">
                    <td role="cell" />
                    <td role="cell">TOTAIS</td>
                    <td
                      role="cell"
                      className={totalContratualEntrada === 0 ? 'is-zero' : undefined}
                    >
                      {numberFormatter.format(totalContratualEntrada)}
                    </td>
                    <td
                      role="cell"
                      className={totalRenegociacaoEntrada === 0 ? 'is-zero' : undefined}
                    >
                      {numberFormatter.format(totalRenegociacaoEntrada)}
                    </td>
                    <td role="cell" className={totalMultaEntrada === 0 ? 'is-zero' : undefined}>
                      {numberFormatter.format(totalMultaEntrada)}
                    </td>
                    <td role="cell" className={totalJurosEntrada === 0 ? 'is-zero' : undefined}>
                      {numberFormatter.format(totalJurosEntrada)}
                    </td>
                    <td role="cell" className={totalDescontosEntrada === 0 ? 'is-zero' : undefined}>
                      {numberFormatter.format(totalDescontosEntrada)}
                    </td>
                    <td role="cell" className={totalTaxasEntrada === 0 ? 'is-zero' : undefined}>
                      {numberFormatter.format(totalTaxasEntrada)}
                    </td>
                    <td role="cell" className={totalPagoEntrada === 0 ? 'is-zero' : undefined}>
                      {numberFormatter.format(totalPagoEntrada)}
                    </td>
                    <td role="cell" />
                  </tr>
                </tfoot>
              </table>
            )}
          </section>

          <div className="totals-bar">
            <div className="totals-left">
              <div className="totals-block">
                <span className="totals-label">TOTAL CONTRATUAL</span>
                <span className="totals-value">
                  {currencyFormatter.format(totalContratualEntrada)}
                </span>
              </div>
              <div className="totals-block">
                <span className="totals-label">TOTAL PAGO</span>
                <span className="totals-value totals-value--paid">
                  {currencyFormatter.format(totalPagoEntrada)}
                </span>
              </div>
            </div>
            <button type="button" className="primary-button" onClick={() => setTela('resultado')}>
              Ver relatório
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </>
      ) : (
        <div className="report-view">
          <header className="report-header">
            <div className="report-header-left">
              <p className="report-eyebrow">Relatório de apuração</p>
              <h1 className="report-title">Correção monetária pelo INCC</h1>
              <div className="report-gold-rule" aria-hidden="true" />
              <p className="report-id">
                {dataAniversarioManual
                  ? `Contrato de ${formatDataBase(dataAniversarioManual)}`
                  : 'Contrato'}
              </p>
            </div>
            <div className="report-header-actions no-print">
              <button
                type="button"
                className="report-btn-secondary"
                onClick={() => setTela('entrada')}
              >
                Voltar
              </button>
              <button
                type="button"
                className="report-btn-primary"
                onClick={() => setPopupExportarAberto(true)}
                disabled={exportando}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 3v12m0 0l4-4m-4 4l-4-4M5 21h14"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {exportando ? 'Exportando...' : 'Exportar'}
              </button>
            </div>
          </header>

          <section
            className={
              relatorio.totalExcesso > 0
                ? 'report-result-panel'
                : 'report-result-panel report-result-panel--neutral'
            }
            aria-label="Resultado da análise"
          >
            <p className="report-result-label">Resultado da análise</p>
            <p className="report-result-lead">
              {relatorio.totalExcesso > 0 ? (
                <>
                  Foram identificados{' '}
                  <span className="report-em">
                    {currencyFormatter.format(relatorio.totalExcesso)}
                  </span>{' '}
                  cobrados a maior em {relatorio.rows.length} pagamentos realizados entre{' '}
                  {formatMesAnoExtenso(relatorio.periodoInicio)} e{' '}
                  {formatMesAnoExtenso(relatorio.periodoFim)}
                  .
                </>
              ) : (
                <>
                  Não foi identificada cobrança a maior nos {relatorio.rows.length} pagamentos
                  apurados.
                </>
              )}
            </p>
            <div className="report-result-findings">
              <div className="report-finding">
                <svg
                  className="report-finding-icon"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M19 5L5 19M7.5 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm9 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p>
                  O excesso representa{' '}
                  <span className="report-em">
                    {relatorio.totalPago > 0
                      ? ((relatorio.totalExcesso / relatorio.totalPago) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </span>{' '}
                  de tudo que foi pago no contrato.
                </p>
              </div>
              <div className="report-finding">
                <svg
                  className="report-finding-icon"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="16"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="M3 10h18M8 3v4M16 3v4"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
                <p>
                  A correção passou a incidir após o 1º aniversário, com INCC-DI de{' '}
                  <span className="report-em">
                    {relatorio.inccUltimaCorrecao == null
                      ? '—'
                      : formatPercent4(relatorio.inccUltimaCorrecao)}
                  </span>
                  .
                </p>
              </div>
              <div className="report-finding">
                <svg
                  className="report-finding-icon"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 3v18M5 8l7 3 7-3M5 16l7-3 7 3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p>
                  Com devolução em dobro do CDC, o montante alcança{' '}
                  <span className="report-em">
                    {currencyFormatter.format(relatorio.totalExcesso * 2)}
                  </span>
                  .
                </p>
              </div>
            </div>
          </section>

          <div className="report-kpi-grid" aria-label="Indicadores do relatório">
            <div className="report-kpi-card">
              <span className="report-kpi-label">Valor pago</span>
              <span className="report-kpi-value">
                {currencyFormatter.format(relatorio.totalPago)}
              </span>
            </div>
            <div className="report-kpi-card">
              <span className="report-kpi-label">Valor devido</span>
              <span className="report-kpi-value">
                {currencyFormatter.format(relatorio.totalDevido)}
              </span>
            </div>
            <div className="report-kpi-card report-kpi-card--excess">
              <span className="report-kpi-label">Cobrado em excesso</span>
              <span className="report-kpi-value report-kpi-value--primary">
                {currencyFormatter.format(relatorio.totalExcesso)}
              </span>
            </div>
            <div className="report-kpi-card">
              <span className="report-kpi-label">Dobro do excesso</span>
              <span className="report-kpi-value report-kpi-value--green">
                {currencyFormatter.format(relatorio.totalExcesso * 2)}
              </span>
            </div>
          </div>

          {relatorio.totalExcesso > 0 ? (
            <div className="report-compare">
              <h2 className="report-compare-title">Comparação</h2>
              <div
                className="report-compare-rows"
                role="img"
                aria-label={`Valor devido ${numberFormatter.format(relatorio.totalDevido)}, valor pago ${numberFormatter.format(relatorio.totalPago)}, diferença ${numberFormatter.format(relatorio.totalExcesso)}`}
              >
                <div className="report-compare-row">
                  <span className="report-compare-label">Valor devido</span>
                  <div className="report-compare-track">
                    <div
                      className="report-compare-fill report-compare-fill--due"
                      style={{
                        width: `${
                          relatorio.totalPago > 0
                            ? (relatorio.totalDevido / relatorio.totalPago) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="report-compare-value">
                    {numberFormatter.format(relatorio.totalDevido)}
                  </span>
                </div>
                <div className="report-compare-row">
                  <span className="report-compare-label">Valor pago</span>
                  <div className="report-compare-track report-compare-track--split">
                    <div
                      className="report-compare-fill report-compare-fill--paid"
                      style={{
                        width: `${
                          relatorio.totalPago > 0
                            ? (relatorio.totalDevido / relatorio.totalPago) * 100
                            : 0
                        }%`,
                      }}
                    />
                    <div className="report-compare-fill report-compare-fill--gold" />
                  </div>
                  <span className="report-compare-value">
                    {numberFormatter.format(relatorio.totalPago)}
                  </span>
                </div>
              </div>
              <div className="report-compare-legend">
                <span className="report-compare-swatch" aria-hidden="true" />
                <p>
                  Faixa em dourado: {currencyFormatter.format(relatorio.totalExcesso)} cobrados além
                  do devido.
                </p>
              </div>
            </div>
          ) : null}

          <div className="memoria-card export-scope">
            <div className="memoria-toolbar">
              <h2 className="memoria-title">Memória de cálculo</h2>
              <button
                type="button"
                className="memoria-toggle no-print"
                aria-pressed={detalharAjustes}
                onClick={() => setDetalharAjustes((prev) => !prev)}
              >
                <span>Detalhar ajustes</span>
                <span className="memoria-switch" aria-hidden="true">
                  <span className="memoria-switch-knob" />
                </span>
              </button>
            </div>

            {relatorio.errosIndice.length > 0 ? (
              <p className="incc-erro-banner" role="alert">
                {relatorio.errosIndice.join(' ')}
              </p>
            ) : null}

            <table
              className={
                detalharAjustes
                  ? 'memoria-table memoria-table--expanded'
                  : 'memoria-table memoria-table--collapsed'
              }
            >
              <thead>
                <tr>
                  <th scope="col" className="col-data">
                    Data
                  </th>
                  <th scope="col" className="col-vc col-divider">
                    Valor
                    <br />
                    contratual
                  </th>
                  <th scope="col" className="col-ajustes col-divider">
                    Ajustes
                  </th>
                  <th scope="col" className="col-detail col-divider">
                    Renegociação
                  </th>
                  <th scope="col" className="col-detail">
                    Multa
                  </th>
                  <th scope="col" className="col-detail">
                    Juros de mora
                  </th>
                  <th scope="col" className="col-detail">
                    Descontos
                  </th>
                  <th scope="col" className="col-detail">
                    Taxas adicionais
                  </th>
                  <th scope="col" className="col-incc">
                    INCC
                    <br />
                    / janela
                  </th>
                  <th scope="col" className="col-devido col-divider">
                    Valor
                    <br />
                    devido
                  </th>
                  <th scope="col" className="col-pago">
                    Valor
                    <br />
                    pago
                  </th>
                  <th scope="col" className="col-excesso col-divider">
                    Excesso
                  </th>
                  <th scope="col" className="col-acao no-export">
                    <span className="visually-hidden">Ação</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {relatorio.rows.map((r) => {
                  const ajustes =
                    r.renegociacao + r.multa + r.jurosMora + r.taxasAdicionais - r.descontos
                  return (
                    <tr key={r.id}>
                      <td className="col-data">{formatDataCurta(r.pagamento)}</td>
                      <td className="col-vc col-divider col-num">
                        {formatCelulaNumero(r.vc)}
                      </td>
                      <td className="col-ajustes col-divider col-num">
                        {formatCelulaNumero(ajustes)}
                      </td>
                      <td className="col-detail col-divider col-num">
                        {formatCelulaNumero(r.renegociacao)}
                      </td>
                      <td className="col-detail col-num">{formatCelulaNumero(r.multa)}</td>
                      <td className="col-detail col-num">{formatCelulaNumero(r.jurosMora)}</td>
                      <td className="col-detail col-num">{formatCelulaNumero(r.descontos)}</td>
                      <td className="col-detail col-num">
                        {formatCelulaNumero(r.taxasAdicionais)}
                      </td>
                      <td className="col-incc col-num col-incc-value">
                        {r.erroIndice ? (
                          <span className="incc-erro">{r.erroIndice}</span>
                        ) : (
                          <>
                            <span>{formatPercent4(r.incc)}</span>
                            {r.janela ? <small className="incc-janela">{r.janela}</small> : null}
                          </>
                        )}
                      </td>
                      <td className="col-devido col-divider col-num">
                        {formatCelulaNumero(r.devido)}
                      </td>
                      <td className="col-pago col-num">{formatCelulaNumero(r.vp)}</td>
                      <td
                        className={
                          r.excesso > 0
                            ? 'col-excesso col-divider col-num excesso-pos'
                            : r.excesso < 0
                              ? 'col-excesso col-divider col-num excesso-neg'
                              : 'col-excesso col-divider col-num'
                        }
                      >
                        {formatCelulaNumero(r.excesso)}
                      </td>
                      <td className="col-acao no-export">
                        <button
                          type="button"
                          className="memoria-edit"
                          aria-label={`Editar lançamento de ${formatDataCurta(r.pagamento)}`}
                          onClick={() => {
                            const linha = linhas.find((l) => l.id === r.id)
                            setEdicaoValorPago({
                              linhaId: r.id,
                              valorPago: linha?.valorPago ?? '',
                            })
                          }}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3zM13.5 6.5l3 3"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="memoria-total">
                  <td className="col-data">Total</td>
                  <td className="col-vc col-divider" />
                  <td className="col-ajustes col-divider col-num">
                    {formatCelulaNumero(
                      relatorio.totalRenegociacao +
                        relatorio.totalMulta +
                        relatorio.totalJurosMora +
                        relatorio.totalTaxasAdicionais -
                        relatorio.totalDescontos,
                    )}
                  </td>
                  <td className="col-detail col-divider col-num">
                    {formatCelulaNumero(relatorio.totalRenegociacao)}
                  </td>
                  <td className="col-detail col-num">
                    {formatCelulaNumero(relatorio.totalMulta)}
                  </td>
                  <td className="col-detail col-num">
                    {formatCelulaNumero(relatorio.totalJurosMora)}
                  </td>
                  <td className="col-detail col-num">
                    {formatCelulaNumero(relatorio.totalDescontos)}
                  </td>
                  <td className="col-detail col-num">
                    {formatCelulaNumero(relatorio.totalTaxasAdicionais)}
                  </td>
                  <td className="col-incc" />
                  <td className="col-devido col-divider col-num">
                    {formatCelulaNumero(relatorio.totalDevido)}
                  </td>
                  <td className="col-pago col-num">
                    {formatCelulaNumero(relatorio.totalPago)}
                  </td>
                  <td
                    className={
                      relatorio.totalExcesso > 0
                        ? 'col-excesso col-divider col-num excesso-pos'
                        : relatorio.totalExcesso < 0
                          ? 'col-excesso col-divider col-num excesso-neg'
                          : 'col-excesso col-divider col-num'
                    }
                  >
                    {formatCelulaNumero(relatorio.totalExcesso)}
                  </td>
                  <td className="col-acao no-export" />
                </tr>
              </tfoot>
            </table>

            <p className="memoria-note">
              <span className="memoria-note-label">Metodologia.</span> Valor devido = (Valor
              contratual × fator INCC) + Renegociação + Multa + Juros de mora + Taxas adicionais −
              Descontos. A correção INCC só começa após o 1º aniversário. A defasagem recua o
              índice-base, sem alterar a faixa nem o tamanho da janela. Valores em reais.{' '}
              {relatorio.rows.length} lançamentos apurados.
            </p>
          </div>

          <div className="report-footer-actions no-print">
            <button
              type="button"
              className="report-btn-primary"
              onClick={abrirPopupCadastrarCliente}
              disabled={relatorio.rows.length === 0}
            >
              Cadastrar cliente
            </button>
          </div>
        </div>
      )}

      {popupCadastrarClienteAberto ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Cadastrar cliente"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !cadastrandoCliente) {
              setPopupCadastrarClienteAberto(false)
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h3>Cadastrar cliente</h3>
              <button
                type="button"
                className="ghost-button"
                disabled={cadastrandoCliente}
                onClick={() => setPopupCadastrarClienteAberto(false)}
              >
                Fechar
              </button>
            </div>

            <div className="modal-body">
              <p className="result-highlight">
                Os valores do relatório serão usados automaticamente no caso. Informe o cliente e,
                se quiser, o empreendimento e a incorporadora.
              </p>
              <div className="field">
                <label htmlFor="nomeClienteCaso">Nome do cliente</label>
                <input
                  id="nomeClienteCaso"
                  className="table-input"
                  value={nomeClienteCaso}
                  onChange={(e) => setNomeClienteCaso(e.target.value)}
                  placeholder="ex: Maria Silva"
                  autoFocus
                  disabled={cadastrandoCliente}
                />
              </div>
              <div className="field">
                <label htmlFor="empreendimentoCaso">Empreendimento (opcional)</label>
                <input
                  id="empreendimentoCaso"
                  className="table-input"
                  value={empreendimentoCaso}
                  onChange={(e) => setEmpreendimentoCaso(e.target.value)}
                  placeholder="ex: Henry Boulevard"
                  disabled={cadastrandoCliente}
                />
              </div>
              <div className="field">
                <label htmlFor="incorporadoraCaso">Incorporadora (opcional)</label>
                <input
                  id="incorporadoraCaso"
                  className="table-input"
                  value={incorporadoraCaso}
                  onChange={(e) => setIncorporadoraCaso(e.target.value)}
                  placeholder="ex: Kallas"
                  disabled={cadastrandoCliente}
                />
              </div>
              <div className="cadastro-resumo" aria-label="Dados puxados do relatório">
                <p>
                  <span>Valor do contrato</span>
                  <span>
                    {currencyFormatter.format(
                      relatorio.rows.reduce((acc, r) => acc + r.vc, 0),
                    )}
                  </span>
                </p>
                <p>
                  <span>Excesso apurado</span>
                  <span>
                    {relatorio.totalExcesso > 0
                      ? currencyFormatter.format(relatorio.totalExcesso)
                      : '—'}
                  </span>
                </p>
                <p>
                  <span>Valor da causa (dobro)</span>
                  <span>
                    {relatorio.totalExcesso > 0
                      ? currencyFormatter.format(relatorio.totalExcesso * 2)
                      : '—'}
                  </span>
                </p>
                <p>
                  <span>Status inicial</span>
                  <span>Processo de venda</span>
                </p>
              </div>
              {erroCadastroCliente ? (
                <p className="cadastro-erro" role="alert">
                  {erroCadastroCliente}
                </p>
              ) : null}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                disabled={cadastrandoCliente}
                onClick={() => setPopupCadastrarClienteAberto(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={cadastrandoCliente}
                onClick={() => void confirmarCadastroCliente()}
              >
                {cadastrandoCliente ? 'Cadastrando...' : 'Cadastrar e abrir caso'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                  onClick={() => {
                    setPopupExportarAberto(false)
                    exportarRelatorioComoPdf('relatorio-completo.pdf', {
                      incluirResumo: true,
                    })
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
                  onClick={() => {
                    setPopupExportarAberto(false)
                    exportarRelatorioComoPdf('memoria-de-calculos.pdf', {
                      incluirResumo: false,
                    })
                  }}
                >
                  Memória de cálculo (PDF)
                </button>
              </div>
              <p className="result-highlight">
                Dica: o PDF é gerado em paisagem com todas as colunas e valores legíveis.
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
    </div>
  )
}

export default App
