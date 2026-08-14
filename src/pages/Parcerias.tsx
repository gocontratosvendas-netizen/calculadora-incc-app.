import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { ParceiroFormModal } from '../components/ParceiroFormModal'
import {
  ESTAGIO_META,
  excluirParceiro,
  formatarEncerradaEm,
  formatarMoeda,
  formatarTempoRelativo,
  listarParceiros,
  obterResumoParcerias,
  TIPO_ROTULO,
  usuarioAtualId,
  type EstagioParceria,
  type Parceiro,
  type ParceriasResumo,
} from '../lib/parcerias'
import './Parcerias.css'

type EstagioFiltro = 'todos' | EstagioParceria

const EMPTY_RESUMO: ParceriasResumo = {
  parceirosAtivos: 0,
  emNegociacao: 0,
  casosIndicados: 0,
  excessoOriginado: 0,
}

const CHIPS: { id: EstagioFiltro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'prospeccao', rotulo: 'Prospecção' },
  { id: 'em_negociacao', rotulo: 'Em negociação' },
  { id: 'ativa', rotulo: 'Ativa' },
  { id: 'encerrada', rotulo: 'Encerrada' },
]

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
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
    <svg className="parcerias-search-icon" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.6 9.6L12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconCaret() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path
        d="M2.25 3.75 5 6.5l2.75-2.75"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconNextStep({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.25" stroke={color} strokeWidth="1.2" />
      <path
        d="M7 4.2v3.2l2 1.2"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 4.5h9M6.25 4.5V3.4c0-.5.4-.9.9-.9h1.7c.5 0 .9.4.9.9v1.1M5.25 4.5l.5 8.1c.05.5.45.9.95.9h2.6c.5 0 .9-.4.95-.9l.5-8.1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ConfirmDialog({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const root = dialogRef.current
    if (!root) return

    const focaveis = [
      ...root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ]
    focaveis[0]?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || focaveis.length === 0) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [])

  return (
    <div
      className="parcerias-confirm-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="parcerias-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>
  )
}

function iniciaisAvatar(bg: string, fg: string) {
  return { background: bg, color: fg } as const
}

function exportarCsv(parceiros: Parceiro[]) {
  const header = [
    'Nome',
    'Tipo',
    'Detalhe',
    'Estágio',
    'Responsável',
    'Casos',
    'Excesso',
    'Último contato',
    'Próximo passo',
  ]
  const rows = parceiros.map((p) => [
    p.nome,
    TIPO_ROTULO[p.tipo],
    p.detalhe ?? '',
    ESTAGIO_META[p.estagio].rotulo,
    p.responsavel.nome,
    String(p.casosIndicados),
    String(p.excessoOriginado),
    p.estagio === 'encerrada'
      ? formatarEncerradaEm(p.encerradaEm)
      : formatarTempoRelativo(p.ultimoContatoEm),
    p.proximoPasso ?? '',
  ])
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`
  const csv = [header, ...rows].map((row) => row.map(escape).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'parcerias.csv'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function Parcerias() {
  const tituloExcluirId = useId()
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [resumo, setResumo] = useState<ParceriasResumo>(EMPTY_RESUMO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [estagioFiltro, setEstagioFiltro] = useState<EstagioFiltro>('todos')
  const [responsavelFiltro, setResponsavelFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Parceiro | null>(null)
  const [origemFoco, setOrigemFoco] = useState<HTMLElement | null>(null)
  const [destaqueId, setDestaqueId] = useState<string | null>(null)
  const [paraExcluir, setParaExcluir] = useState<Parceiro | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const cadastrarRef = useRef<HTMLButtonElement>(null)
  const destaqueTimer = useRef<number | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [lista, indicadores] = await Promise.all([
        listarParceiros(),
        obterResumoParcerias(),
      ])
      setParceiros(lista)
      setResumo(indicadores)
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
    return () => {
      if (destaqueTimer.current != null) window.clearTimeout(destaqueTimer.current)
    }
  }, [])

  const responsaveisFiltro = useMemo(() => {
    const map = new Map<string, { id: string; nome: string }>()
    for (const p of parceiros) {
      map.set(p.responsavel.id, { id: p.responsavel.id, nome: p.responsavel.nome })
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [parceiros])

  const filtrados = useMemo(() => {
    const q = normalizar(buscaDebounced.trim())
    return parceiros.filter((p) => {
      if (estagioFiltro !== 'todos' && p.estagio !== estagioFiltro) return false
      if (responsavelFiltro !== 'todos' && p.responsavel.id !== responsavelFiltro) {
        return false
      }
      if (!q) return true
      return (
        normalizar(p.nome).includes(q) ||
        normalizar(TIPO_ROTULO[p.tipo]).includes(q)
      )
    })
  }, [parceiros, estagioFiltro, responsavelFiltro, buscaDebounced])

  const filtroAtivo =
    estagioFiltro !== 'todos' ||
    responsavelFiltro !== 'todos' ||
    buscaDebounced.trim().length > 0

  const baseVazia = !loading && !error && parceiros.length === 0
  const semResultado =
    !loading && !error && parceiros.length > 0 && filtrados.length === 0

  const resumoExibido = baseVazia ? EMPTY_RESUMO : resumo

  function limparFiltros() {
    setEstagioFiltro('todos')
    setResponsavelFiltro('todos')
    setBusca('')
    setBuscaDebounced('')
  }

  function abrirCadastro(origem: HTMLElement | null) {
    setEditando(null)
    setOrigemFoco(origem)
    setModalAberto(true)
  }

  function abrirEdicao(parceiro: Parceiro, origem: HTMLElement | null) {
    setEditando(parceiro)
    setOrigemFoco(origem)
    setModalAberto(true)
  }

  function onCardKeyDown(event: ReactKeyboardEvent, parceiro: Parceiro) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      abrirEdicao(parceiro, event.currentTarget as HTMLElement)
    }
  }

  function pedirExclusao(parceiro: Parceiro, event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    setOrigemFoco(event.currentTarget)
    setParaExcluir(parceiro)
  }

  function cancelarExclusao() {
    if (excluindo) return
    setParaExcluir(null)
  }

  async function confirmarExclusao() {
    if (!paraExcluir || excluindo) return
    setExcluindo(true)
    try {
      await excluirParceiro(paraExcluir.id)
      setParceiros((atual) => atual.filter((item) => item.id !== paraExcluir.id))
      const indicadores = await obterResumoParcerias()
      setResumo(indicadores)
      if (editando?.id === paraExcluir.id) {
        setModalAberto(false)
        setEditando(null)
      }
      setParaExcluir(null)
    } catch {
      setParaExcluir(null)
    } finally {
      setExcluindo(false)
    }
  }

  async function onSaved(parceiro: Parceiro, criado: boolean) {
    const indicadores = await obterResumoParcerias()
    setResumo(indicadores)
    setParceiros((prev) => {
      if (criado) return [parceiro, ...prev.filter((p) => p.id !== parceiro.id)]
      return prev.map((p) => (p.id === parceiro.id ? parceiro : p))
    })
    if (criado) {
      setDestaqueId(parceiro.id)
      if (destaqueTimer.current != null) window.clearTimeout(destaqueTimer.current)
      destaqueTimer.current = window.setTimeout(() => {
        setDestaqueId(null)
      }, 1500)
    }
  }

  const kpis = [
    {
      label: 'PARCEIROS ATIVOS',
      value: String(resumoExibido.parceirosAtivos),
      azul: false,
      destaque: false,
    },
    {
      label: 'EM NEGOCIAÇÃO',
      value: String(resumoExibido.emNegociacao),
      azul: false,
      destaque: false,
    },
    {
      label: 'CASOS INDICADOS',
      value: String(resumoExibido.casosIndicados),
      azul: false,
      destaque: false,
    },
    {
      label: 'EXCESSO ORIGINADO',
      value: formatarMoeda(resumoExibido.excessoOriginado),
      azul: true,
      destaque: true,
    },
  ]

  const rodapeLista = filtroAtivo
    ? `Mostrando ${filtrados.length} de ${filtrados.length} parceiros filtrados`
    : `Mostrando ${filtrados.length} de ${parceiros.length} parceiros`

  return (
    <div className="parcerias-page">
      <header className="parcerias-header">
        <div>
          <h1>Parcerias</h1>
          <div className="parcerias-header-rule" aria-hidden="true" />
          <p className="parcerias-header-sub">
            Canais de originação e quem responde por cada um.
          </p>
        </div>
        <div className="parcerias-header-actions">
          <button
            type="button"
            className="parcerias-btn parcerias-btn--secondary"
            onClick={() => exportarCsv(filtrados)}
            disabled={loading || filtrados.length === 0}
          >
            <IconDownload />
            Exportar
          </button>
          <button
            ref={cadastrarRef}
            type="button"
            className="parcerias-btn parcerias-btn--primary parcerias-btn--cadastrar"
            onClick={(e) => abrirCadastro(e.currentTarget)}
          >
            <IconPlus />
            Cadastrar parceiro
          </button>
        </div>
      </header>

      <section className="parcerias-kpis" aria-label="Indicadores de parcerias">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className={`parcerias-kpi${i === 3 ? ' parcerias-kpi--destaque' : ''}`}
              >
                <div className="parcerias-skeleton" />
                <div className="parcerias-skeleton parcerias-skeleton--value" />
              </div>
            ))
          : kpis.map((kpi) => (
              <div
                key={kpi.label}
                className={`parcerias-kpi${kpi.destaque ? ' parcerias-kpi--destaque' : ''}`}
              >
                <span className="parcerias-kpi-label">{kpi.label}</span>
                <span
                  className={`parcerias-kpi-value${kpi.azul ? ' parcerias-kpi-value--azul' : ''}`}
                >
                  {kpi.value}
                </span>
              </div>
            ))}
      </section>

      {!baseVazia && !error ? (
        <div className="parcerias-filters">
          <div
            className="parcerias-chips"
            role="group"
            aria-label="Filtrar por estágio"
          >
            {CHIPS.map((chip) => {
              const active = estagioFiltro === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  className={`parcerias-chip${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => setEstagioFiltro(chip.id)}
                >
                  {chip.rotulo}
                </button>
              )
            })}
          </div>
          <div className="parcerias-filters-right">
            <div className="parcerias-select-wrap">
              <label htmlFor="parcerias-resp" className="parcerias-visually-hidden">
                Responsável
              </label>
              <select
                id="parcerias-resp"
                value={responsavelFiltro}
                onChange={(e) => setResponsavelFiltro(e.target.value)}
                aria-label="Responsável"
              >
                <option value="todos">Todos</option>
                {responsaveisFiltro.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
              <IconCaret />
            </div>
            <div className="parcerias-search">
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

      {loading ? (
        <div className="parcerias-grid" aria-busy="true" aria-label="Carregando parceiros">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="parcerias-card parcerias-card--skeleton">
              <div className="parcerias-skeleton parcerias-skeleton--avatar" />
              <div className="parcerias-skeleton" />
              <div className="parcerias-skeleton parcerias-skeleton--line" />
              <div className="parcerias-skeleton parcerias-skeleton--block" />
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="parcerias-empty">
          <p className="parcerias-empty-error">Não foi possível carregar os parceiros.</p>
          <button type="button" className="parcerias-btn parcerias-btn--text" onClick={() => void carregar()}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {baseVazia ? (
        <div className="parcerias-empty">
          <p>Nenhum parceiro cadastrado ainda.</p>
          <button
            type="button"
            className="parcerias-btn parcerias-btn--primary"
            onClick={(e) => abrirCadastro(e.currentTarget)}
          >
            <IconPlus />
            Cadastrar parceiro
          </button>
        </div>
      ) : null}

      {semResultado ? (
        <div className="parcerias-empty">
          <p>Nenhum parceiro encontrado com os filtros aplicados.</p>
          <button type="button" className="parcerias-btn parcerias-btn--text" onClick={limparFiltros}>
            Limpar filtros
          </button>
        </div>
      ) : null}

      {!loading && !error && !baseVazia && !semResultado ? (
        <>
          <div className="parcerias-grid">
            {filtrados.map((parceiro) => {
              const meta = ESTAGIO_META[parceiro.estagio]
              const encerrada = parceiro.estagio === 'encerrada'
              const mostraIndicadores =
                parceiro.estagio === 'ativa' || parceiro.estagio === 'encerrada'
              const iniciaisStyle =
                parceiro.estagio === 'ativa'
                  ? iniciaisAvatar('#EDF2FA', '#16346B')
                  : iniciaisAvatar(meta.bg, meta.fg)
              const isAtual = parceiro.responsavel.id === usuarioAtualId
              const detalheLinha = parceiro.detalhe
                ? `${TIPO_ROTULO[parceiro.tipo]} · ${parceiro.detalhe}`
                : TIPO_ROTULO[parceiro.tipo]
              const ariaLabel = `${parceiro.nome}, ${TIPO_ROTULO[parceiro.tipo]}, ${meta.rotulo}, responsável ${parceiro.responsavel.nome}`

              return (
                <article
                  key={parceiro.id}
                  className={[
                    'parcerias-card',
                    encerrada ? 'parcerias-card--encerrada' : '',
                    destaqueId === parceiro.id ? 'is-highlight' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  tabIndex={0}
                  role="button"
                  aria-label={ariaLabel}
                  onClick={(e) => abrirEdicao(parceiro, e.currentTarget)}
                  onKeyDown={(e) => onCardKeyDown(e, parceiro)}
                >
                  <div className="parcerias-card-top">
                    <div
                      className="parcerias-card-iniciais"
                      style={iniciaisStyle}
                      aria-hidden="true"
                    >
                      {parceiro.iniciais}
                    </div>
                    <div className="parcerias-card-head">
                      <div className="parcerias-card-nome">{parceiro.nome}</div>
                      <div className="parcerias-card-meta">{detalheLinha}</div>
                    </div>
                    <span
                      className="parcerias-badge"
                      style={{ background: meta.bg, color: meta.fg }}
                    >
                      {meta.rotulo}
                    </span>
                  </div>

                  <div className="parcerias-card-body">
                    {mostraIndicadores ? (
                      <div className="parcerias-card-stats">
                        <div>
                          <div className="parcerias-card-stat-label">CASOS</div>
                          <div className="parcerias-card-stat-value">
                            {parceiro.casosIndicados}
                          </div>
                        </div>
                        <div>
                          <div className="parcerias-card-stat-label">EXCESSO ORIGINADO</div>
                          <div className="parcerias-card-stat-value parcerias-card-stat-value--azul">
                            {formatarMoeda(parceiro.excessoOriginado)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="parcerias-card-next">
                        <IconNextStep color={meta.fg} />
                        <p
                          className={
                            parceiro.proximoPasso
                              ? 'parcerias-card-next-text'
                              : 'parcerias-card-next-text is-empty'
                          }
                        >
                          {parceiro.proximoPasso || 'Sem próximo passo definido.'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="parcerias-card-footer">
                    <div className="parcerias-card-owner">
                      <span
                        className={`parcerias-owner-avatar${isAtual ? ' is-current' : ''}`}
                        title={parceiro.responsavel.nome}
                        aria-label={parceiro.responsavel.nome}
                      >
                        {parceiro.responsavel.iniciais}
                      </span>
                      <span className="parcerias-owner-name">
                        {parceiro.responsavel.nome}
                      </span>
                    </div>
                    <div className="parcerias-card-footer-right">
                      <span className="parcerias-card-contact">
                        {encerrada
                          ? formatarEncerradaEm(parceiro.encerradaEm)
                          : `contato ${formatarTempoRelativo(parceiro.ultimoContatoEm)}`}
                      </span>
                      <button
                        type="button"
                        className="parcerias-delete"
                        aria-label={`Excluir ${parceiro.nome}`}
                        title="Excluir parceiro"
                        onClick={(event) => pedirExclusao(parceiro, event)}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          <p className="parcerias-list-footer">{rodapeLista}</p>
        </>
      ) : null}

      {modalAberto && !paraExcluir ? (
        <ParceiroFormModal
          parceiro={editando}
          returnFocusTo={origemFoco ?? cadastrarRef.current}
          onClose={() => setModalAberto(false)}
          onSaved={(p, criado) => {
            void onSaved(p, criado)
          }}
        />
      ) : null}

      {paraExcluir ? (
        <ConfirmDialog labelledBy={tituloExcluirId} onClose={cancelarExclusao}>
          <h2 className="parcerias-confirm-title" id={tituloExcluirId}>
            Excluir parceiro
          </h2>
          <p className="parcerias-confirm-text">
            Tem certeza de que deseja excluir {paraExcluir.nome}? Esta ação não pode ser desfeita.
          </p>
          <div className="parcerias-confirm-actions">
            <button
              type="button"
              className="parcerias-btn parcerias-btn--secondary parcerias-btn--dialog"
              onClick={cancelarExclusao}
              disabled={excluindo}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="parcerias-btn parcerias-btn--danger parcerias-btn--dialog"
              onClick={() => void confirmarExclusao()}
              disabled={excluindo}
            >
              {excluindo ? 'Excluindo…' : 'Excluir'}
            </button>
          </div>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
