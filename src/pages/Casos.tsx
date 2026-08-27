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
import { createPortal } from 'react-dom'
import {
  atualizarResponsaveis,
  calcularResumoCarteira,
  calcularResumoFinanceiro,
  excluirCaso,
  honorariosExitoDoCaso,
  listarCasos,
  pessoasDoCaso,
  rotuloResponsaveis,
  type Caso,
  type CasoStatus,
  type PessoaCaso,
} from '../lib/casos'
import { exportarCarteiraCasos } from '../lib/exportarCasos'
import {
  obterHonorariosDaCarteira,
  obterTotalProLaboreRecebido,
  type HonorariosDoCaso,
} from '../modules/financeiro/data/repositorio'
import {
  rotuloSituacaoHonorario,
  situacaoHonorario,
  valorHonorarioExibido,
  valorHonorarioRecebido,
  type HonorarioDoCaso,
} from '../modules/financeiro/engine/honorariosCarteira'
import { useRouter } from '../lib/router-context'
import { listProfiles, mensagemErroSupabase } from '../lib/supabase'
import './Casos.css'

type StatusFiltro = 'todos' | CasoStatus
type SortKey = 'valorContrato' | 'excessoApurado' | 'valorCausa' | 'anoAjuizamento'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 20

const STATUS_CHIPS: { id: StatusFiltro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'stand_by', rotulo: 'Stand-by' },
  { id: 'processo_de_venda', rotulo: 'Processo de venda' },
  { id: 'confeccao_de_peticao_inicial', rotulo: 'Confecção de Petição Inicial' },
  { id: 'ajuizado', rotulo: 'Ajuizado' },
  { id: 'encerrado', rotulo: 'Encerrado' },
]

const STATUS_META: Record<
  CasoStatus,
  { rotulo: string; rotuloTabela: string; className: string }
> = {
  stand_by: { rotulo: 'Stand-by', rotuloTabela: 'Stand-by', className: 'casos-badge--standby' },
  processo_de_venda: {
    rotulo: 'Processo de venda',
    rotuloTabela: 'Em venda',
    className: 'casos-badge--venda',
  },
  confeccao_de_peticao_inicial: {
    rotulo: 'Confecção de Petição Inicial',
    rotuloTabela: 'Petição inicial',
    className: 'casos-badge--peticao',
  },
  ajuizado: { rotulo: 'Ajuizado', rotuloTabela: 'Ajuizado', className: 'casos-badge--ajuizado' },
  encerrado: { rotulo: 'Encerrado', rotuloTabela: 'Encerrado', className: 'casos-badge--encerrado' },
}

const EMPTY_RESUMO = {
  casosCadastrados: 0,
  emAndamento: 0,
  valorTotalCausa: 0,
  excessoTotalCarteira: 0,
  recuperado: 0,
}

const EMPTY_FINANCEIRO = {
  proLaboreRecebido: 0,
  honorariosExitoEsperados: 0,
}

const moneyDecimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const moneyFull = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function MoneyAmount({
  value,
  className,
}: {
  value: number | null
  className?: string
}) {
  if (value == null) return <span className="casos-empty-dash">—</span>
  return (
    <span className={`casos-money${className ? ` ${className}` : ''}`}>
      <span className="casos-money-sym">R$</span>
      {moneyDecimal.format(value)}
    </span>
  )
}

function HonorarioCell({
  resumo,
  fallback = null,
  mostrarEsperado = false,
}: {
  resumo: HonorarioDoCaso | undefined
  fallback?: number | null
  mostrarEsperado?: boolean
}) {
  const situacao = situacaoHonorario(resumo)
  const valor = valorHonorarioExibido(resumo, mostrarEsperado ? fallback : null)
  const usandoFallback =
    mostrarEsperado &&
    situacao === 'nao_recebido' &&
    (!resumo || (resumo.valorPago === 0 && resumo.valorPendente === 0)) &&
    fallback != null

  return (
    <span className={`casos-fee casos-fee--${situacao}`}>
      <span className="casos-fee-status">{rotuloSituacaoHonorario(situacao)}</span>
      {valor != null ? (
        <span className={`casos-fee-value${usandoFallback ? ' is-esperado' : ''}`}>
          <span className="casos-money-sym">R$</span>
          {moneyDecimal.format(valor)}
        </span>
      ) : (
        <span className="casos-empty-dash">—</span>
      )}
    </span>
  )
}

const RESP_MENU_LARGURA = 232
const RESP_AVATARES_VISIVEIS = 2

function IconCheck() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 5.2 4.1 7.2 8 2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ResponsavelCell({
  caso,
  equipe,
  aberto,
  onAbertoChange,
  onSalvar,
}: {
  caso: Caso
  equipe: PessoaCaso[]
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  onSalvar: (pessoas: PessoaCaso[]) => Promise<void>
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const selecionados = pessoasDoCaso(caso)
  const rotulo = rotuloResponsaveis(selecionados)

  const opcoes = useMemo(() => {
    const map = new Map<string, PessoaCaso>()
    for (const p of equipe) map.set(p.id, p)
    for (const p of selecionados) {
      if (!map.has(p.id)) map.set(p.id, p)
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [equipe, selecionados])

  const posicionar = useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect()
    if (!rect) return
    const alturaMenu = Math.min(8 + opcoes.length * 34, 280)
    let top = rect.bottom + 4
    let left = rect.right - RESP_MENU_LARGURA
    if (left < 8) left = 8
    if (left + RESP_MENU_LARGURA > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - RESP_MENU_LARGURA - 8)
    }
    if (top + alturaMenu > window.innerHeight - 8) {
      top = Math.max(8, rect.top - alturaMenu - 4)
    }
    setPosicao({ top, left })
  }, [opcoes.length])

  function abrir(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    event.preventDefault()
    if (opcoes.length === 0) return
    posicionar()
    setErro(null)
    onAbertoChange(true)
  }

  useEffect(() => {
    if (!aberto) return
    posicionar()

    function onPointerDown(event: PointerEvent) {
      const alvo = event.target as Node
      if (btnRef.current?.contains(alvo) || menuRef.current?.contains(alvo)) return
      onAbertoChange(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onAbertoChange(false)
        btnRef.current?.focus()
      }
    }
    function onReposition() {
      posicionar()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [aberto, onAbertoChange, posicionar])

  async function alternar(pessoa: PessoaCaso) {
    if (salvando) return
    const jaEsta = selecionados.some((p) => p.id === pessoa.id)
    const proximo = jaEsta
      ? selecionados.filter((p) => p.id !== pessoa.id)
      : [...selecionados, pessoa]
    if (proximo.length === 0) return
    setSalvando(true)
    setErro(null)
    try {
      await onSalvar(proximo)
    } catch (error) {
      setErro(mensagemErroSupabase(error, 'Não foi possível atualizar os responsáveis.'))
    } finally {
      setSalvando(false)
    }
  }

  const visiveis = selecionados.slice(0, RESP_AVATARES_VISIVEIS)
  const extras = Math.max(0, selecionados.length - visiveis.length)
  const aria = erro
    ? `${rotulo}. ${erro}`
    : `Responsáveis: ${rotulo}. Clique para alterar.`

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`casos-resp${aberto ? ' is-open' : ''}${salvando ? ' is-busy' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label={aria}
        title={erro ?? rotulo}
        disabled={opcoes.length === 0}
        onClick={abrir}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <span className="casos-resp-stack">
          {visiveis.length === 0 ? (
            <span className="casos-avatar casos-avatar--empty">?</span>
          ) : (
            visiveis.map((pessoa) => (
              <span key={pessoa.id} className="casos-avatar" title={pessoa.nome}>
                {pessoa.iniciais}
              </span>
            ))
          )}
        </span>
        {extras > 0 ? <span className="casos-resp-more">+{extras}</span> : null}
      </button>
      {aberto && posicao
        ? createPortal(
            <div
              ref={menuRef}
              className="casos-resp-menu"
              role="listbox"
              aria-multiselectable="true"
              aria-label={`Escolher responsáveis de ${caso.cliente}`}
              style={{ top: posicao.top, left: posicao.left, width: RESP_MENU_LARGURA }}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <p className="casos-resp-menu-hint">Um ou mais responsáveis</p>
              {opcoes.map((pessoa) => {
                const marcado = selecionados.some((p) => p.id === pessoa.id)
                return (
                  <button
                    key={pessoa.id}
                    type="button"
                    role="option"
                    aria-selected={marcado}
                    className={`casos-resp-option${marcado ? ' is-selected' : ''}`}
                    disabled={salvando || (marcado && selecionados.length === 1)}
                    onClick={() => void alternar(pessoa)}
                  >
                    <span className={`casos-resp-check${marcado ? ' is-on' : ''}`}>
                      {marcado ? <IconCheck /> : null}
                    </span>
                    <span className="casos-avatar">{pessoa.iniciais}</span>
                    <span className="casos-resp-option-nome">{pessoa.nome}</span>
                  </button>
                )
              })}
              {erro ? <p className="casos-resp-erro">{erro}</p> : null}
            </div>,
            document.body,
          )
        : null}
    </>
  )
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
      className="casos-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="casos-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>
  )
}

function exportarRelatorio(
  casos: Caso[],
  honorarios: Record<string, HonorariosDoCaso>,
  filtrado: boolean,
) {
  exportarCarteiraCasos(casos, honorarios, STATUS_META, { filtrado })
}

export default function Casos() {
  const { navigate } = useRouter()
  const tituloExcluirId = useId()
  const [casos, setCasos] = useState<Caso[]>([])
  const [proLaboreRecebido, setProLaboreRecebido] = useState(0)
  const [honorarios, setHonorarios] = useState<Record<string, HonorariosDoCaso>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos')
  const [anoFiltro, setAnoFiltro] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('excessoApurado')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [paraExcluir, setParaExcluir] = useState<Caso | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [equipe, setEquipe] = useState<PessoaCaso[]>([])
  const [pickerCasoId, setPickerCasoId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [lista, proLabore, honorariosCarteira, profiles] = await Promise.all([
        listarCasos(),
        obterTotalProLaboreRecebido(),
        obterHonorariosDaCarteira(),
        listProfiles().catch(() => []),
      ])
      setCasos(lista)
      setProLaboreRecebido(proLabore)
      setHonorarios(honorariosCarteira)
      setEquipe(profiles.map((p) => ({ id: p.id, nome: p.nome, iniciais: p.iniciais })))
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
        normalizar(c.incorporadora).includes(q) ||
        pessoasDoCaso(c).some((p) => normalizar(p.nome).includes(q))
      )
    })
  }, [casos, statusFiltro, anoFiltro, buscaDebounced])

  const resumo = useMemo(() => calcularResumoCarteira(filtrados), [filtrados])
  const financeiro = useMemo(
    () => calcularResumoFinanceiro(casos, proLaboreRecebido),
    [casos, proLaboreRecebido],
  )

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
      (acc, c) => {
        const hon = honorarios[c.id]
        return {
          contrato: acc.contrato + c.valorContrato,
          excesso: acc.excesso + (c.excessoApurado ?? 0),
          causa: acc.causa + (c.valorCausa ?? 0),
          proLabore: acc.proLabore + valorHonorarioRecebido(hon?.proLabore),
          exito: acc.exito + valorHonorarioRecebido(hon?.exito),
        }
      },
      { contrato: 0, excesso: 0, causa: 0, proLabore: 0, exito: 0 },
    )
  }, [pageItems, honorarios])

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

  function pedirExclusao(caso: Caso, event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    setPickerCasoId(null)
    setParaExcluir(caso)
  }

  async function salvarResponsaveis(casoId: string, pessoas: PessoaCaso[]) {
    const anterior = casos.find((item) => item.id === casoId)
    setCasos((atual) =>
      atual.map((item) =>
        item.id === casoId
          ? {
              ...item,
              responsavel: pessoas[0] ?? item.responsavel,
              responsaveis: pessoas,
              atualizadoEm: new Date().toISOString(),
            }
          : item,
      ),
    )
    try {
      const gravadas = await atualizarResponsaveis(
        casoId,
        pessoas.map((p) => p.id),
      )
      setCasos((atual) =>
        atual.map((item) =>
          item.id === casoId
            ? {
                ...item,
                responsavel: gravadas[0] ?? item.responsavel,
                responsaveis: gravadas,
              }
            : item,
        ),
      )
    } catch (error) {
      if (anterior) {
        setCasos((atual) => atual.map((item) => (item.id === casoId ? anterior : item)))
      }
      throw error
    }
  }

  function cancelarExclusao() {
    if (excluindo) return
    setParaExcluir(null)
  }

  async function confirmarExclusao() {
    if (!paraExcluir) return
    setExcluindo(true)
    try {
      await excluirCaso(paraExcluir.id)
      setCasos((atual) => atual.filter((item) => item.id !== paraExcluir.id))
      setParaExcluir(null)
    } finally {
      setExcluindo(false)
    }
  }

  const resumoExibido = carteiraVazia ? EMPTY_RESUMO : resumo
  const financeiroExibido = {
    proLaboreRecebido: financeiro.proLaboreRecebido,
    honorariosExitoEsperados: carteiraVazia
      ? EMPTY_FINANCEIRO.honorariosExitoEsperados
      : financeiro.honorariosExitoEsperados,
  }

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

  const kpisFinanceiros = [
    {
      label: 'PRÓ-LABORE RECEBIDO',
      value: formatMoneyCard(financeiroExibido.proLaboreRecebido),
      className: 'casos-kpi-value--verde',
      destaque: false,
    },
    {
      label: 'HONORÁRIOS DE ÊXITO ESPERADOS',
      value: formatMoneyCard(financeiroExibido.honorariosExitoEsperados),
      className: 'casos-kpi-value--azul',
      destaque: true,
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
            onClick={() => exportarRelatorio(ordenados, honorarios, filtroAtivo)}
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

      <section className="casos-kpis casos-kpis--financeiro" aria-label="Indicadores financeiros">
        {loading
          ? Array.from({ length: 2 }, (_, i) => (
              <div key={i} className={`casos-kpi${i === 1 ? ' casos-kpi--destaque' : ''}`}>
                <div className="casos-skeleton" />
                <div className="casos-skeleton casos-skeleton--value" />
              </div>
            ))
          : kpisFinanceiros.map((kpi) => (
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
                  Valor da causa
                </th>
                <th scope="col" role="columnheader" className="is-right">
                  Pró-labore
                </th>
                <th scope="col" role="columnheader" className="is-right">
                  Honorários de êxito
                </th>
                <th scope="col" role="columnheader" className="is-center" title="Responsáveis">
                  Resp.
                </th>
                <th scope="col" role="columnheader" className="is-right">
                  Status
                </th>
                <th scope="col" role="columnheader">
                  <span className="casos-visually-hidden">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, i) => (
                <tr key={i} className="casos-skel-row" role="row">
                  {Array.from({ length: 11 }, (_, j) => (
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
                    Valor da causa
                    {sortKey === 'valorCausa' ? <IconSortArrow dir={sortDir} /> : null}
                  </button>
                </th>
                <th scope="col" role="columnheader" className="is-right">
                  Pró-labore
                </th>
                <th scope="col" role="columnheader" className="is-right">
                  Honorários
                  <br />
                  de êxito
                </th>
                <th scope="col" role="columnheader" className="is-center" title="Responsáveis">
                  Resp.
                </th>
                <th scope="col" role="columnheader" className="is-right">
                  Status
                </th>
                <th scope="col" role="columnheader">
                  <span className="casos-visually-hidden">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((caso) => {
                const status = STATUS_META[caso.status]
                const hon = honorarios[caso.id]
                const esperado = honorariosExitoDoCaso(caso.valorCausa, caso.percentualExito)
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
                    <td role="cell" className="casos-incorporadora">
                      {caso.incorporadora}
                    </td>
                    <td role="cell" className="is-center">
                      {caso.anoAjuizamento != null ? (
                        caso.anoAjuizamento
                      ) : (
                        <span className="casos-empty-dash">—</span>
                      )}
                    </td>
                    <td role="cell" className="is-num">
                      <MoneyAmount value={caso.valorContrato} />
                    </td>
                    <td role="cell" className="is-num">
                      <MoneyAmount value={caso.excessoApurado} className="casos-excesso" />
                    </td>
                    <td role="cell" className="is-num">
                      <MoneyAmount value={caso.valorCausa} className="casos-causa" />
                    </td>
                    <td role="cell" className="is-num">
                      <HonorarioCell resumo={hon?.proLabore} />
                    </td>
                    <td role="cell" className="is-num">
                      <HonorarioCell resumo={hon?.exito} fallback={esperado} mostrarEsperado />
                    </td>
                    <td
                      role="cell"
                      className="is-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ResponsavelCell
                        caso={caso}
                        equipe={equipe}
                        aberto={pickerCasoId === caso.id}
                        onAbertoChange={(aberto) => setPickerCasoId(aberto ? caso.id : null)}
                        onSalvar={(pessoas) => salvarResponsaveis(caso.id, pessoas)}
                      />
                    </td>
                    <td role="cell" className="is-right">
                      <span className={`casos-badge ${status.className}`}>{status.rotuloTabela}</span>
                    </td>
                    <td role="cell" className="is-center">
                      <button
                        type="button"
                        className="casos-delete"
                        aria-label={`Excluir caso de ${caso.cliente}`}
                        title="Excluir caso"
                        onClick={(event) => pedirExclusao(caso, event)}
                      >
                        <IconTrash />
                      </button>
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
                  <MoneyAmount value={pageTotals.contrato} className="casos-total-contrato" />
                </td>
                <td role="cell" className="is-num">
                  <MoneyAmount value={pageTotals.excesso} className="casos-total-excesso" />
                </td>
                <td role="cell" className="is-num">
                  <MoneyAmount value={pageTotals.causa} className="casos-total-causa" />
                </td>
                <td role="cell" className="is-num">
                  <MoneyAmount value={pageTotals.proLabore} className="casos-total-fee" />
                </td>
                <td role="cell" className="is-num">
                  <MoneyAmount value={pageTotals.exito} className="casos-total-fee" />
                </td>
                <td role="cell" />
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

      {paraExcluir ? (
        <ConfirmDialog labelledBy={tituloExcluirId} onClose={cancelarExclusao}>
          <h2 className="casos-dialog-title" id={tituloExcluirId}>
            Excluir caso
          </h2>
          <p className="casos-dialog-text">
            Tem certeza de que deseja excluir o caso de {paraExcluir.cliente}? Esta ação não pode ser
            desfeita.
          </p>
          <div className="casos-dialog-actions">
            <button
              type="button"
              className="casos-btn casos-btn--secondary"
              onClick={cancelarExclusao}
              disabled={excluindo}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="casos-btn casos-btn--danger"
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
