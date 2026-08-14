import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  listarCasos,
  obterResumoCarteira,
  type CarteiraResumo,
  type Caso,
  type CasoStatus,
} from '../lib/casos'
import { useRouter } from '../lib/router-context'
import './Casos.css'

type StatusFiltro = 'todos' | CasoStatus
type SortKey = 'valorContrato' | 'excessoApurado' | 'valorCausa' | 'anoAjuizamento'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 20

const STATUS_CHIPS: { id: StatusFiltro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'processo_de_venda', rotulo: 'Processo de venda' },
  { id: 'ajuizado', rotulo: 'Ajuizado' },
  { id: 'encerrado', rotulo: 'Encerrado' },
]

const STATUS_META: Record<
  CasoStatus,
  { rotulo: string; className: string }
> = {
  processo_de_venda: { rotulo: 'Processo de venda', className: 'casos-badge--venda' },
  ajuizado: { rotulo: 'Ajuizado', className: 'casos-badge--ajuizado' },
  encerrado: { rotulo: 'Encerrado', className: 'casos-badge--encerrado' },
}

const EMPTY_RESUMO: CarteiraResumo = {
  casosCadastrados: 0,
  emAndamento: 0,
  valorTotalCausa: 0,
  excessoTotalCarteira: 0,
  recuperado: 0,
}

const moneyCell = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const moneyFull = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function formatMoneyCell(value: number | null) {
  if (value == null) return null
  return moneyCell.format(value)
}

function formatMoneyCard(value: number) {
  if (value >= 1_000_000) {
    const abbreviated = (value / 1_000_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `R$ ${abbreviated} mi`
  }
  return moneyFull.format(value)
}

function compareNullable(
  a: number | null,
  b: number | null,
  dir: SortDir,
): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return dir === 'asc' ? a - b : b - a
}

function buildPageItems(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  if (current <= 3) {
    return [1, 2, 3, 4, 'ellipsis', total]
  }

  if (current >= total - 2) {
    return [1, 'ellipsis', total - 3, total - 2, total - 1, total]
  }

  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.5v7.5M5.25 7.75 8 10.5l2.75-2.75"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.5 13h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.25v9.5M2.25 7h9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg className="casos-search-icon" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.6 9.6L12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconCaret() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2.25 3.75 5 6.5l2.75-2.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSortArrow({ dir }: { dir: SortDir }) {
  return (
    <svg className="casos-sort-arrow" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      {dir === 'desc' ? (
        <path d="M5 2v6M2.5 5.5 5 8l2.5-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M5 8V2M2.5 4.5 5 2l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

function IconChevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      {dir === 'left' ? (
        <path d="M7.5 3 4.5 6l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M4.5 3 7.5 6l-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

function exportarCsv(casos: Caso[]) {
  const header = [
    'Cliente',
    'Empreendimento',
    'Incorporadora',
    'Ano',
    'Contrato',
    'Excesso',
    'Valor da causa',
    'Responsável',
    'Status',
  ]
  const rows = casos.map((c) => [
    c.cliente,
    c.empreendimento,
    c.incorporadora,
    c.anoAjuizamento?.toString() ?? '',
    c.valorContrato.toString(),
    c.excessoApurado?.toString() ?? '',
    c.valorCausa?.toString() ?? '',
    c.responsavel.nome,
    STATUS_META[c.status].rotulo,
  ])
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`
  const csv = [header, ...rows].map((row) => row.map(escape).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'casos.csv'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function Casos() {
  const { navigate } = useRouter()
  const [casos, setCasos] = useState<Caso[]>([])
  const [resumo, setResumo] = useState<CarteiraResumo>(EMPTY_RESUMO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos')
  const [anoFiltro, setAnoFiltro] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('excessoApurado')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [lista, carteira] = await Promise.all([listarCasos(), obterResumoCarteira()])
      setCasos(lista)
      setResumo(carteira)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    const id = window.setTimeout(() => setBuscaDebounced(busca), 200)
    return () => window.clearTimeout(id)
  }, [busca])

  useEffect(() => {
    setPage(1)
  }, [statusFiltro, anoFiltro, buscaDebounced])

  const anos = useMemo(() => {
    const set = new Set<number>()
    for (const c of casos) {
      if (c.anoAjuizamento != null) set.add(c.anoAjuizamento)
    }
    return [...set].sort((a, b) => b - a)
  }, [casos])

  const filtrados = useMemo(() => {
    const q = normalizar(buscaDebounced.trim())
    return casos.filter((c) => {
      if (statusFiltro !== 'todos' && c.status !== statusFiltro) return false
      if (anoFiltro !== 'todos' && c.anoAjuizamento !== Number(anoFiltro)) return false
      if (!q) return true
      return (
        normalizar(c.cliente).includes(q) ||
        normalizar(c.empreendimento).includes(q) ||
        normalizar(c.incorporadora).includes(q)
      )
    })
  }, [casos, statusFiltro, anoFiltro, buscaDebounced])

  const ordenados = useMemo(() => {
    return [...filtrados].sort((a, b) => compareNullable(a[sortKey], b[sortKey], sortDir))
  }, [filtrados, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(ordenados.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)

  useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe)
  }, [page, pageSafe])

  const pageItems = ordenados.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)

  const pageTotals = useMemo(() => {
    return pageItems.reduce(
      (acc, c) => ({
        contrato: acc.contrato + c.valorContrato,
        excesso: acc.excesso + (c.excessoApurado ?? 0),
        causa: acc.causa + (c.valorCausa ?? 0),
      }),
      { contrato: 0, excesso: 0, causa: 0 },
    )
  }, [pageItems])

  const filtroAtivo =
    statusFiltro !== 'todos' || anoFiltro !== 'todos' || buscaDebounced.trim().length > 0

  const carteiraVazia = !loading && !error && casos.length === 0
  const semResultado = !loading && !error && casos.length > 0 && ordenados.length === 0

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'excessoApurado' ? 'desc' : 'asc')
    }
  }

  function ariaSortFor(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (sortKey !== key) return 'none'
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }

  function limparFiltros() {
    setStatusFiltro('todos')
    setAnoFiltro('todos')
    setBusca('')
    setBuscaDebounced('')
    setPage(1)
  }

  function abrirCaso(id: string) {
    navigate(`/casos/${id}`)
  }

  function onRowKeyDown(event: ReactKeyboardEvent, id: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      abrirCaso(id)
    }
  }

  const resumoExibido = carteiraVazia ? EMPTY_RESUMO : resumo

  const kpis = [
    {
      label: 'CASOS CADASTRADOS',
      value: String(resumoExibido.casosCadastrados),
      className: '',
      destaque: false,
    },
    {
      label: 'EM ANDAMENTO',
      value: String(resumoExibido.emAndamento),
      className: '',
      destaque: false,
    },
    {
      label: 'VALOR TOTAL DE CAUSA',
      value: formatMoneyCard(resumoExibido.valorTotalCausa),
      className: '',
      destaque: false,
    },
    {
      label: 'EXCESSO TOTAL DA CARTEIRA',
      value: formatMoneyCard(resumoExibido.excessoTotalCarteira),
      className: 'casos-kpi-value--azul',
      destaque: true,
    },
    {
      label: 'RECUPERADO',
      value: formatMoneyCard(resumoExibido.recuperado),
      className: 'casos-kpi-value--verde',
      destaque: false,
    },
  ]

  const paginationLabel = filtroAtivo
    ? `Mostrando ${pageItems.length} de ${ordenados.length} casos filtrados`
    : `Mostrando ${pageItems.length} de ${ordenados.length} casos`

  return (
    <div className="casos-page">
      <header className="casos-header">
        <div>
          <h1>Casos</h1>
          <div className="casos-header-rule" aria-hidden="true" />
          <p className="casos-header-sub">Carteira completa do escritório.</p>
        </div>
        <div className="casos-header-actions">
          <button
            type="button"
            className="casos-btn casos-btn--secondary"
            onClick={() => exportarCsv(ordenados)}
            disabled={loading || ordenados.length === 0}
          >
            <IconDownload />
            Exportar
          </button>
          <button
            type="button"
            className="casos-btn casos-btn--primary"
            onClick={() => navigate('/casos/novo')}
          >
            <IconPlus />
            Cadastrar caso
          </button>
        </div>
      </header>

      <section className="casos-kpis" aria-label="Indicadores da carteira">
        {loading
          ? Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={`casos-kpi${i === 3 ? ' casos-kpi--destaque' : ''}`}>
                <div className="casos-skeleton" />
                <div className="casos-skeleton casos-skeleton--value" />
              </div>
            ))
          : kpis.map((kpi) => (
              <div
                key={kpi.label}
                className={`casos-kpi${kpi.destaque ? ' casos-kpi--destaque' : ''}`}
              >
                <span className="casos-kpi-label">{kpi.label}</span>
                <span className={`casos-kpi-value ${kpi.className}`.trim()}>{kpi.value}</span>
              </div>
            ))}
      </section>

      {!carteiraVazia ? (
        <div className="casos-filters">
          <div className="casos-chips" role="group" aria-label="Filtrar por status">
            {STATUS_CHIPS.map((chip) => {
              const active = statusFiltro === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  className={`casos-chip${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => setStatusFiltro(chip.id)}
                >
                  {chip.rotulo}
                </button>
              )
            })}
          </div>
          <div className="casos-filters-right">
            <div className="casos-year">
              <label htmlFor="casos-ano" className="casos-visually-hidden">
                Ano
              </label>
              <select
                id="casos-ano"
                value={anoFiltro}
                onChange={(e) => setAnoFiltro(e.target.value)}
                aria-label="Ano"
              >
                <option value="todos">Todos</option>
                {anos.map((ano) => (
                  <option key={ano} value={String(ano)}>
                    {ano}
                  </option>
                ))}
              </select>
              <span className="casos-year-caret">
                <IconCaret />
              </span>
            </div>
            <div className="casos-search">
              <IconSearch />
              <input
                type="search"
                placeholder="Buscar"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="casos-table-wrap">
        {loading ? (
          <table className="casos-table" role="table">
            <thead>
              <tr role="row">
                <th scope="col" role="columnheader">
                  Caso
                </th>
                <th scope="col" role="columnheader">
                  Incorporadora
                </th>
                <th scope="col" role="columnheader" className="is-center">
                  Ano
                </th>
                <th scope="col" role="columnheader" className="is-right">
                  Contrato
                </th>
                <th scope="col" role="columnheader" className="is-right">
                  Excesso
                </th>
                <th scope="col" role="columnheader" className="is-right">
                  Valor da
                  <br />
                  causa
                </th>
                <th scope="col" role="columnheader" className="is-center">
                  Resp.
                </th>
                <th scope="col" role="columnheader" className="is-right">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, i) => (
                <tr key={i} className="casos-skel-row" role="row">
                  {Array.from({ length: 8 }, (_, j) => (
                    <td key={j} role="cell">
                      <div className="casos-skeleton" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : error ? (
          <div className="casos-table-empty">
            <p className="is-error">Não foi possível carregar os casos.</p>
            <button type="button" className="casos-btn casos-btn--text" onClick={() => void carregar()}>
              Tentar novamente
            </button>
          </div>
        ) : carteiraVazia ? (
          <div className="casos-table-empty">
            <p>Nenhum caso cadastrado ainda.</p>
            <button
              type="button"
              className="casos-btn casos-btn--primary"
              onClick={() => navigate('/casos/novo')}
            >
              <IconPlus />
              Cadastrar caso
            </button>
          </div>
        ) : semResultado ? (
          <div className="casos-table-empty">
            <p>Nenhum caso encontrado com os filtros aplicados.</p>
            <button type="button" className="casos-btn casos-btn--text" onClick={limparFiltros}>
              Limpar filtros
            </button>
          </div>
        ) : (
          <table className="casos-table" role="table">
            <thead>
              <tr role="row">
                <th scope="col" role="columnheader">
                  Caso
                </th>
                <th scope="col" role="columnheader">
                  Incorporadora
                </th>
                <th
                  scope="col"
                  role="columnheader"
                  className={`is-center${sortKey === 'anoAjuizamento' ? ' is-sorted' : ''}`}
                  aria-sort={ariaSortFor('anoAjuizamento')}
                >
                  <button type="button" className="casos-sort" onClick={() => handleSort('anoAjuizamento')}>
                    Ano
                    {sortKey === 'anoAjuizamento' ? <IconSortArrow dir={sortDir} /> : null}
                  </button>
                </th>
                <th
                  scope="col"
                  role="columnheader"
                  className={`is-right${sortKey === 'valorContrato' ? ' is-sorted' : ''}`}
                  aria-sort={ariaSortFor('valorContrato')}
                >
                  <button type="button" className="casos-sort" onClick={() => handleSort('valorContrato')}>
                    Contrato
                    {sortKey === 'valorContrato' ? <IconSortArrow dir={sortDir} /> : null}
                  </button>
                </th>
                <th
                  scope="col"
                  role="columnheader"
                  className={`is-right${sortKey === 'excessoApurado' ? ' is-sorted' : ''}`}
                  aria-sort={ariaSortFor('excessoApurado')}
                >
                  <button type="button" className="casos-sort" onClick={() => handleSort('excessoApurado')}>
                    Excesso
                    {sortKey === 'excessoApurado' ? <IconSortArrow dir={sortDir} /> : null}
                  </button>
                </th>
                <th
                  scope="col"
                  role="columnheader"
                  className={`is-right${sortKey === 'valorCausa' ? ' is-sorted' : ''}`}
                  aria-sort={ariaSortFor('valorCausa')}
                >
                  <button type="button" className="casos-sort" onClick={() => handleSort('valorCausa')}>
                    Valor da
                    <br />
                    causa
                    {sortKey === 'valorCausa' ? <IconSortArrow dir={sortDir} /> : null}
                  </button>
                </th>
                <th scope="col" role="columnheader" className="is-center">
                  Resp.
                </th>
                <th scope="col" role="columnheader" className="is-right">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((caso) => {
                const status = STATUS_META[caso.status]
                const excesso = formatMoneyCell(caso.excessoApurado)
                const causa = formatMoneyCell(caso.valorCausa)
                return (
                  <tr
                    key={caso.id}
                    className="casos-row"
                    role="row"
                    tabIndex={0}
                    aria-label={`${caso.cliente}, ${status.rotulo}`}
                    onClick={() => abrirCaso(caso.id)}
                    onKeyDown={(e) => onRowKeyDown(e, caso.id)}
                  >
                    <td role="cell" className="casos-caso-cell">
                      <span className="casos-caso-nome">{caso.cliente}</span>
                      <span className="casos-caso-emp">{caso.empreendimento}</span>
                    </td>
                    <td role="cell">{caso.incorporadora}</td>
                    <td role="cell" className="is-center">
                      {caso.anoAjuizamento != null ? (
                        caso.anoAjuizamento
                      ) : (
                        <span className="casos-empty-dash">—</span>
                      )}
                    </td>
                    <td role="cell" className="is-num">
                      {formatMoneyCell(caso.valorContrato)}
                    </td>
                    <td role="cell" className="is-num">
                      {excesso != null ? (
                        <span className="casos-excesso">{excesso}</span>
                      ) : (
                        <span className="casos-empty-dash">—</span>
                      )}
                    </td>
                    <td role="cell" className="is-num">
                      {causa != null ? (
                        <span className="casos-causa">{causa}</span>
                      ) : (
                        <span className="casos-empty-dash">—</span>
                      )}
                    </td>
                    <td role="cell" className="is-center">
                      <span
                        className="casos-avatar"
                        title={caso.responsavel.nome}
                        aria-label={caso.responsavel.nome}
                      >
                        {caso.responsavel.iniciais}
                      </span>
                    </td>
                    <td role="cell" className="is-right">
                      <span className={`casos-badge ${status.className}`}>{status.rotulo}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr role="row">
                <td role="cell">
                  <span className="casos-total-label">TOTAL DA PÁGINA</span>
                </td>
                <td role="cell" />
                <td role="cell" />
                <td role="cell" className="is-num">
                  <span className="casos-total-contrato">{moneyCell.format(pageTotals.contrato)}</span>
                </td>
                <td role="cell" className="is-num">
                  <span className="casos-total-excesso">{moneyCell.format(pageTotals.excesso)}</span>
                </td>
                <td role="cell" className="is-num">
                  <span className="casos-total-causa">{moneyCell.format(pageTotals.causa)}</span>
                </td>
                <td role="cell" />
                <td role="cell" />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {!loading && !error && !carteiraVazia && !semResultado ? (
        <div className="casos-pagination">
          <span className="casos-pagination-info">{paginationLabel}</span>
          <nav className="casos-pagination-nav" aria-label="Paginação">
            <button
              type="button"
              className="casos-page-btn"
              aria-label="Página anterior"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <IconChevron dir="left" />
            </button>
            {buildPageItems(pageSafe, totalPages).map((item, idx) =>
              item === 'ellipsis' ? (
                <span key={`e-${idx}`} className="casos-page-ellipsis" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`casos-page-btn${item === pageSafe ? ' is-active' : ''}`}
                  aria-label={`Página ${item}`}
                  aria-current={item === pageSafe ? 'page' : undefined}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              className="casos-page-btn"
              aria-label="Próxima página"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <IconChevron dir="right" />
            </button>
          </nav>
        </div>
      ) : null}
    </div>
  )
}
