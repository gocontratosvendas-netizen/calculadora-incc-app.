import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { listarCasos, STATUS_CASO_ROTULO, type Caso } from '../lib/casos'
import {
  comentar,
  curtirPost,
  equipe,
  excluirComentario,
  excluirPost,
  listarItensAtencao,
  listarMarcacoesNaoLidas,
  listarPosts,
  marcarMencoesComoLidas,
  primeiroNome,
  publicarPost,
  rotuloMencao,
  rotuloPapel,
  usuarioAtual,
  usuarioPorId,
  type AnexoPost,
  type CasoVinculado,
  type Comentario,
  type ItemAtencao,
  type Marcacao,
  type Mencao,
  type Post,
  type Usuario,
} from '../lib/mural'
import { Link } from '../lib/router'
import './mural.css'

type FiltroFeed = 'tudo' | 'marcacoes' | 'atualizacoes'

type PostUI = Post & { falhaPublicacao?: boolean }

type OpcaoMencao = { id: string | 'todos'; nome: string; iniciais: string }

type ConfirmacaoExclusao =
  | { tipo: 'post'; postId: string }
  | { tipo: 'comentario'; postId: string; comentarioId: string }

type PublicarEstado = {
  texto: string
  mencoes: Mencao[]
  casoVinculado: CasoVinculado | null
  anexo: AnexoPost | null
  restritoASocios: boolean
}

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function saudacaoPorHora(hora: number) {
  if (hora >= 18) return 'Boa noite'
  if (hora >= 12) return 'Boa tarde'
  return 'Bom dia'
}

function formatarDataExtenso(data: Date) {
  const formatado = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(data)
  return formatado.charAt(0).toUpperCase() + formatado.slice(1)
}

function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatarTempoRelativo(iso: string, agora = new Date()) {
  const data = new Date(iso)
  const diffMs = agora.getTime() - data.getTime()
  const minutos = Math.max(0, Math.round(diffMs / 60_000))
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `${minutos}min`
  const ontem = new Date(agora)
  ontem.setDate(ontem.getDate() - 1)
  if (mesmoDia(data, ontem)) return 'ontem'
  if (mesmoDia(data, agora)) {
    const horas = Math.max(1, Math.round(minutos / 60))
    return `${horas}h`
  }
  const dias = Math.round(diffMs / 86_400_000)
  if (dias < 7) return `${Math.max(2, dias)}d`
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(data)
}

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  return `${Math.round(bytes / 1024)} KB`
}

function casoParaVinculo(caso: Caso): CasoVinculado {
  return {
    id: caso.id,
    cliente: caso.cliente,
    empreendimento: caso.empreendimento,
    status: STATUS_CASO_ROTULO[caso.status],
    excesso: caso.excessoApurado,
  }
}

function anexoDeArquivo(file: File): AnexoPost {
  const ponto = file.name.lastIndexOf('.')
  const nome = ponto > 0 ? file.name.slice(0, ponto) : file.name
  const formato = ponto > 0 ? file.name.slice(ponto + 1).toUpperCase() : 'ARQ'
  return {
    id: `anexo-${crypto.randomUUID()}`,
    nome,
    formato,
    tamanhoBytes: file.size,
    url: URL.createObjectURL(file),
  }
}

function queryMencao(texto: string, cursor: number): { start: number; query: string } | null {
  const antes = texto.slice(0, cursor)
  const at = antes.lastIndexOf('@')
  if (at < 0) return null
  const trecho = antes.slice(at + 1)
  if (trecho.length > 0 && /\s/.test(trecho)) return null
  return { start: at, query: trecho }
}

function postMenciona(post: Post, usuarioId: string) {
  return post.mencoes.some((item) => item.usuarioId === usuarioId || item.usuarioId === 'todos')
}

function podeExcluirPost(post: Post) {
  if (usuarioAtual.papel === 'socio') return true
  return post.autor?.id === usuarioAtual.id
}

function podeExcluirComentario(comentario: Comentario) {
  if (usuarioAtual.papel === 'socio') return true
  return comentario.autor.id === usuarioAtual.id
}

function nomeDaMencao(usuarioId: string | 'todos') {
  if (usuarioId === 'todos') return 'Todos'
  return usuarioPorId(usuarioId)?.nome ?? 'Colega'
}

function IconAt() {
  return (
    <svg viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M9.7 7.5v1.15c0 .9.55 1.55 1.45 1.55 1.35 0 2.15-1.15 2.15-3.2C13.3 4.2 10.7 2.2 7.5 2.2 4.3 2.2 1.7 4.55 1.7 7.5c0 2.95 2.6 5.3 5.8 5.3 1.35 0 2.6-.35 3.55-.95"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconMaleta() {
  return (
    <svg viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1.75" y="5.25" width="11.5" height="8" rx="1.1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.2 5.25V3.9A1.1 1.1 0 0 1 6.3 2.8h2.4A1.1 1.1 0 0 1 9.8 3.9v1.35" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function IconClipe() {
  return (
    <svg viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M8.4 4.1 4.05 8.45a2.35 2.35 0 1 0 3.32 3.32l5.05-5.05a3.2 3.2 0 0 0-4.53-4.53L3.05 7.98"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconDocumento() {
  return (
    <svg viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M4 2.25h4.4L11.75 5.6V12.75H4V2.25Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8.35 2.35v3.35h3.3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function IconCurtir() {
  return (
    <svg viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M4.1 6.6h1.7v6.1H4.1z" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M5.8 12.7h5.15c.55 0 1.02-.4 1.12-.94l.7-3.85c.12-.66-.38-1.26-1.05-1.26H8.35V4.55C8.35 3.55 7.5 3.15 6.95 4.05L5.8 6.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconComentar() {
  return (
    <svg viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M3.1 3.1h8.8a1.1 1.1 0 0 1 1.1 1.1v5.2a1.1 1.1 0 0 1-1.1 1.1H6.4L3.1 12.7V4.2A1.1 1.1 0 0 1 4.2 3.1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconMartelo() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8.6 2.2 13 6.6l-1.15 1.15-4.4-4.4L8.6 2.2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M7.7 5.5 2.8 10.4 5.2 12.8l4.9-4.9" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M2.2 13.7h6.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconRelogio() {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.15" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 4.2V7l2 1.35" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconAlerta() {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 1.8 12.6 12.1H1.4L7 1.8Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M7 5.6v2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="7" cy="10.15" r="0.55" fill="currentColor" />
    </svg>
  )
}

function IconDocAlerta() {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3.4 1.75h4.1L10.6 4.9v7.35H3.4V1.75Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.4 1.85v3.15h3.1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 6.4v2.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="7" cy="10.35" r="0.5" fill="currentColor" />
    </svg>
  )
}

function IconExcluir() {
  return (
    <svg viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M3.2 4.1h8.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5.15 4.1V3.15A1.05 1.05 0 0 1 6.2 2.1h2.6a1.05 1.05 0 0 1 1.05 1.05V4.1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.35 4.1h6.3v7.55a1.1 1.1 0 0 1-1.1 1.1H5.45a1.1 1.1 0 0 1-1.1-1.1V4.1Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.35 6.2v4.1M8.65 6.2v4.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function Avatar({
  usuario,
  size,
  variant,
}: {
  usuario: Usuario
  size: 22 | 24 | 26 | 30
  variant: 'self' | 'neutral'
}) {
  return (
    <span
      className={`mural-avatar mural-avatar--${size} mural-avatar--${variant}`}
      title={usuario.nome}
      aria-label={usuario.nome}
    >
      {usuario.iniciais}
    </span>
  )
}

function ContadorNaoLidas({ quantidade }: { quantidade: number }) {
  if (quantidade <= 0) return null
  return (
    <span className="mural-unread" aria-live="polite">
      {quantidade}
    </span>
  )
}

function TextoComMencoes({
  texto,
  mencoes,
  className,
}: {
  texto: string
  mencoes: Mencao[]
  className?: string
}) {
  const ordenadas = [...mencoes].sort((a, b) => a.offset - b.offset)
  const nos: ReactNode[] = []
  let cursor = 0
  for (const mencao of ordenadas) {
    const inicio = Math.max(cursor, mencao.offset)
    const fim = mencao.offset + mencao.length
    if (mencao.offset > cursor) nos.push(texto.slice(cursor, mencao.offset))
    if (fim > inicio) {
      nos.push(
        <span key={`${mencao.usuarioId}-${mencao.offset}`} className="mural-mention" aria-label={nomeDaMencao(mencao.usuarioId)}>
          {texto.slice(mencao.offset, fim)}
        </span>,
      )
    }
    cursor = Math.max(cursor, fim)
  }
  if (cursor < texto.length) nos.push(texto.slice(cursor))
  return <p className={className}>{nos}</p>
}

function TextoAtualizacao({ post }: { post: Post }) {
  const favoravel = /favorável/i.test(post.texto)
  const nomeCaso = post.casoVinculado
    ? `${post.casoVinculado.cliente} · ${post.casoVinculado.empreendimento}`
    : null
  const nos: ReactNode[] = []
  let resto = post.texto
  let chave = 0
  while (resto.length > 0) {
    const idxCaso = nomeCaso ? resto.indexOf(nomeCaso) : -1
    const matchValor = /R\$\s*[\d.]+/.exec(resto)
    const idxValor = matchValor ? matchValor.index : -1
    const candidatos = [
      idxCaso >= 0 ? { idx: idxCaso, tipo: 'caso' as const, len: nomeCaso!.length } : null,
      idxValor >= 0 ? { idx: idxValor, tipo: 'valor' as const, len: matchValor![0].length } : null,
    ].filter((item) => item != null)
    if (candidatos.length === 0) {
      nos.push(resto)
      break
    }
    candidatos.sort((a, b) => a.idx - b.idx)
    const proximo = candidatos[0]
    if (!proximo) {
      nos.push(resto)
      break
    }
    if (proximo.idx > 0) nos.push(resto.slice(0, proximo.idx))
    const trecho = resto.slice(proximo.idx, proximo.idx + proximo.len)
    nos.push(
      <span
        key={chave}
        className={proximo.tipo === 'valor' && favoravel ? 'mural-emph mural-emph--valor' : 'mural-emph'}
      >
        {trecho}
      </span>,
    )
    chave += 1
    resto = resto.slice(proximo.idx + proximo.len)
  }
  return <p className="mural-post-text mural-post-text--auto">{nos}</p>
}

function ChipCaso({ caso, onRemove }: { caso: CasoVinculado; onRemove?: () => void }) {
  return (
    <span className="mural-attach-wrap">
      <Link className="mural-attach" to={`/casos/${caso.id}`}>
        <IconMaleta />
        <span>
          <span className="mural-attach-title">
            {caso.cliente} · {caso.empreendimento}
          </span>
          <span className="mural-attach-meta">
            {caso.status} · excesso {caso.excesso == null ? '—' : moeda.format(caso.excesso)}
          </span>
        </span>
      </Link>
      {onRemove ? (
        <button type="button" className="mural-attach-remove" aria-label="Remover caso" onClick={onRemove}>
          ×
        </button>
      ) : null}
    </span>
  )
}

function ChipAnexo({ anexo, onRemove }: { anexo: AnexoPost; onRemove?: () => void }) {
  const meta = [anexo.formato, formatarTamanho(anexo.tamanhoBytes), anexo.versao].filter(Boolean).join(' · ')
  return (
    <span className="mural-attach-wrap">
      <a className="mural-attach" href={anexo.url} download={`${anexo.nome}.${anexo.formato.toLowerCase()}`}>
        <IconDocumento />
        <span>
          <span className="mural-attach-title">{anexo.nome}</span>
          <span className="mural-attach-meta">{meta}</span>
        </span>
      </a>
      {onRemove ? (
        <button type="button" className="mural-attach-remove" aria-label="Remover anexo" onClick={onRemove}>
          ×
        </button>
      ) : null}
    </span>
  )
}

function PostEsqueleto() {
  return (
    <li className="mural-post mural-post--skel" aria-hidden="true">
      <div className="mural-skel mural-skel-avatar" />
      <div className="mural-skel-body">
        <div className="mural-skel mural-skel-line" style={{ width: '38%' }} />
        <div className="mural-skel mural-skel-line" style={{ width: '72%' }} />
        <div className="mural-skel mural-skel-bar" />
      </div>
    </li>
  )
}

function CartaoAtencao({ itens }: { itens: ItemAtencao[] }) {
  if (itens.length === 0) return null
  return (
    <section className="mural-card" aria-labelledby="mural-atencao-label">
      <div className="mural-card-label" id="mural-atencao-label">
        Precisa de atenção
      </div>
      {itens.map((item) => {
        if (item.tipo === 'revisao') {
          return (
            <Link key={item.id} className="mural-attention mural-attention--revisao" to={item.href}>
              <IconRelogio />
              <span>
                <strong>{item.quantidade}</strong> casos aguardando sua revisão
              </span>
            </Link>
          )
        }
        if (item.tipo === 'prescricao') {
          return (
            <Link key={item.id} className="mural-attention mural-attention--prescricao" to={item.href}>
              <IconAlerta />
              <span>
                {item.cliente} · prescrição em <strong>{item.meses}</strong> meses
              </span>
            </Link>
          )
        }
        return (
          <Link key={item.id} className="mural-attention mural-attention--memorial" to={item.href}>
            <IconDocAlerta />
            <span>
              <strong>{item.quantidade}</strong> casos sem memorial anexado
            </span>
          </Link>
        )
      })}
    </section>
  )
}

export default function Home() {
  const mentionListId = useId()
  const casoListId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const nextCursorRef = useRef<string | null>(null)
  const loadingMoreRef = useRef(false)

  const [posts, setPosts] = useState<PostUI[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [feedStatus, setFeedStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [filtro, setFiltro] = useState<FiltroFeed>('tudo')
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([])
  const [atencao, setAtencao] = useState<ItemAtencao[]>([])
  const [casos, setCasos] = useState<Caso[]>([])

  const [texto, setTexto] = useState('')
  const [mencoes, setMencoes] = useState<Mencao[]>([])
  const [casoVinculado, setCasoVinculado] = useState<CasoVinculado | null>(null)
  const [anexo, setAnexo] = useState<AnexoPost | null>(null)
  const [restrito, setRestrito] = useState(false)
  const [mentionAberto, setMentionAberto] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(0)
  const [mentionAtivo, setMentionAtivo] = useState(0)
  const [casoAberto, setCasoAberto] = useState(false)
  const [casoBusca, setCasoBusca] = useState('')
  const [casoAtivo, setCasoAtivo] = useState(0)
  const [comentando, setComentando] = useState<string | null>(null)
  const [comentarioTexto, setComentarioTexto] = useState('')
  const [comentariosAbertos, setComentariosAbertos] = useState<Record<string, boolean>>({})
  const [rascunhoFalha, setRascunhoFalha] = useState<PublicarEstado | null>(null)
  const [confirmando, setConfirmando] = useState<ConfirmacaoExclusao | null>(null)
  const [falhaExclusao, setFalhaExclusao] = useState<string | null>(null)
  const [scrollAlvo, setScrollAlvo] = useState<string | null>(null)

  const naoLidas = marcacoes.filter((item) => !item.lida)
  const agora = new Date()
  const saudacao = `${saudacaoPorHora(agora.getHours())}, ${primeiroNome(usuarioAtual)}`
  const dataLabel = formatarDataExtenso(agora)
  const contexto =
    naoLidas.length === 0
      ? dataLabel
      : naoLidas.length === 1
        ? `${dataLabel} · 1 marcação nova para você`
        : `${dataLabel} · ${naoLidas.length} marcações novas para você`

  const opcoesMencao = useMemo<OpcaoMencao[]>(() => {
    const lista: OpcaoMencao[] = [{ id: 'todos', nome: 'todos', iniciais: 'Td' }, ...equipe]
    const q = normalizar(mentionQuery)
    if (!q) return lista
    return lista.filter((item) => normalizar(item.nome).includes(q) || normalizar(rotuloMencao(item)).includes(q))
  }, [mentionQuery])

  const casosFiltrados = useMemo(() => {
    const q = normalizar(casoBusca)
    if (!q) return casos
    return casos.filter(
      (caso) =>
        normalizar(caso.cliente).includes(q) ||
        normalizar(caso.empreendimento).includes(q) ||
        normalizar(caso.incorporadora).includes(q),
    )
  }, [casoBusca, casos])

  const postsFiltrados = useMemo(() => {
    if (filtro === 'marcacoes') return posts.filter((post) => postMenciona(post, usuarioAtual.id))
    if (filtro === 'atualizacoes') return posts.filter((post) => post.tipo === 'atualizacao')
    return posts
  }, [filtro, posts])

  const ajustarAltura = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const max = 12.5 * 1.55 * 6
    const proxima = Math.min(el.scrollHeight, max)
    el.style.height = `${proxima}px`
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden'
  }, [])

  useEffect(() => {
    ajustarAltura()
  }, [texto, ajustarAltura])

  const carregarFeed = useCallback(async () => {
    setFeedStatus('loading')
    try {
      const resultado = await listarPosts()
      setPosts(resultado.posts)
      nextCursorRef.current = resultado.nextCursor
      setHasMore(Boolean(resultado.nextCursor))
      setFeedStatus('ready')
    } catch {
      setPosts([])
      nextCursorRef.current = null
      setHasMore(false)
      setFeedStatus('error')
    }
  }, [])

  useEffect(() => {
    void carregarFeed()
    listarMarcacoesNaoLidas()
      .then(setMarcacoes)
      .catch(() => setMarcacoes([]))
    listarItensAtencao()
      .then(setAtencao)
      .catch(() => setAtencao([]))
    listarCasos()
      .then(setCasos)
      .catch(() => setCasos([]))
  }, [carregarFeed])

  const carregarMais = useCallback(async () => {
    const cursor = nextCursorRef.current
    if (!cursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    try {
      const resultado = await listarPosts(cursor)
      setPosts((atual) => {
        const ids = new Set(atual.map((item) => item.id))
        return [...atual, ...resultado.posts.filter((item) => !ids.has(item.id))]
      })
      nextCursorRef.current = resultado.nextCursor
      setHasMore(Boolean(resultado.nextCursor))
    } finally {
      loadingMoreRef.current = false
    }
  }, [])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || feedStatus !== 'ready') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void carregarMais()
      },
      { rootMargin: '160px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [carregarMais, feedStatus, hasMore, postsFiltrados.length])

  function sincronizarMencoes(proximo: string, atuais: Mencao[]) {
    const usadas = new Set<number>()
    const atualizadas: Mencao[] = []
    for (const mencao of atuais) {
      const rotulo =
        mencao.usuarioId === 'todos'
          ? '@todos'
          : `@${rotuloMencao(usuarioPorId(mencao.usuarioId) ?? usuarioAtual)}`
      let from = 0
      let idx = -1
      while (from <= proximo.length) {
        idx = proximo.indexOf(rotulo, from)
        if (idx < 0 || !usadas.has(idx)) break
        from = idx + 1
      }
      if (idx >= 0 && !usadas.has(idx)) {
        usadas.add(idx)
        atualizadas.push({ usuarioId: mencao.usuarioId, offset: idx, length: rotulo.length })
      }
    }
    return atualizadas
  }

  function atualizarTexto(proximo: string, cursor: number) {
    setTexto(proximo)
    setMencoes((atuais) => sincronizarMencoes(proximo, atuais))
    const query = queryMencao(proximo, cursor)
    if (query) {
      setMentionAberto(true)
      setMentionQuery(query.query)
      setMentionStart(query.start)
      setMentionAtivo(0)
      setCasoAberto(false)
    } else {
      setMentionAberto(false)
      setMentionQuery('')
    }
  }

  function confirmarMencao(opcao: OpcaoMencao) {
    const label = rotuloMencao(opcao)
    const insercao = `@${label} `
    const el = textareaRef.current
    const cursor = el?.selectionStart ?? texto.length
    const proximo = `${texto.slice(0, mentionStart)}${insercao}${texto.slice(cursor)}`
    const mencao: Mencao = {
      usuarioId: opcao.id,
      offset: mentionStart,
      length: label.length + 1,
    }
    setTexto(proximo)
    setMencoes((atuais) => sincronizarMencoes(proximo, [...atuais, mencao]))
    setMentionAberto(false)
    setMentionQuery('')
    requestAnimationFrame(() => {
      const campo = textareaRef.current
      if (!campo) return
      const pos = mentionStart + insercao.length
      campo.focus()
      campo.setSelectionRange(pos, pos)
    })
  }

  function iniciarMencao() {
    const el = textareaRef.current
    const cursor = el?.selectionStart ?? texto.length
    const ja = queryMencao(texto, cursor)
    if (ja) {
      setMentionAberto(true)
      setMentionQuery(ja.query)
      setMentionStart(ja.start)
      el?.focus()
      return
    }
    const proximo = `${texto.slice(0, cursor)}@${texto.slice(cursor)}`
    setTexto(proximo)
    setMentionAberto(true)
    setMentionQuery('')
    setMentionStart(cursor)
    setMentionAtivo(0)
    setCasoAberto(false)
    requestAnimationFrame(() => {
      const campo = textareaRef.current
      if (!campo) return
      campo.focus()
      campo.setSelectionRange(cursor + 1, cursor + 1)
    })
  }

  function marcarPessoa(usuario: Usuario) {
    const label = rotuloMencao(usuario)
    const prefixo = texto && !texto.endsWith(' ') && !texto.endsWith('\n') ? ' ' : ''
    const insercao = `${prefixo}@${label} `
    const offset = texto.length + prefixo.length
    const proximo = `${texto}${insercao}`
    setTexto(proximo)
    setMencoes((atuais) => [
      ...sincronizarMencoes(proximo, atuais),
      { usuarioId: usuario.id, offset, length: label.length + 1 },
    ])
    setMentionAberto(false)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  function onComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (mentionAberto && opcoesMencao.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setMentionAtivo((atual) => (atual + 1) % opcoesMencao.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setMentionAtivo((atual) => (atual - 1 + opcoesMencao.length) % opcoesMencao.length)
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const opcao = opcoesMencao[mentionAtivo] ?? opcoesMencao[0]
        if (opcao) confirmarMencao(opcao)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setMentionAberto(false)
        return
      }
    }
    if (event.key === 'Escape') setCasoAberto(false)
  }

  async function enviarPublicacao(input: PublicarEstado, substituirId?: string) {
    const otimista: PostUI = {
      id: substituirId ?? `temp-${crypto.randomUUID()}`,
      tipo: 'usuario',
      autor: usuarioAtual,
      texto: input.texto,
      mencoes: input.mencoes,
      casoVinculado: input.casoVinculado,
      anexo: input.anexo,
      restritoASocios: input.restritoASocios,
      curtidas: 0,
      curtidoPorMim: false,
      comentarios: [],
      totalComentarios: 0,
      criadoEm: new Date().toISOString(),
    }
    if (!substituirId) setPosts((atual) => [otimista, ...atual])
    else {
      setPosts((atual) => atual.map((item) => (item.id === substituirId ? { ...otimista, falhaPublicacao: false } : item)))
    }
    try {
      const salvo = await publicarPost(input)
      setPosts((atual) => atual.map((item) => (item.id === otimista.id ? salvo : item)))
      setRascunhoFalha(null)
      if (!substituirId) {
        setTexto('')
        setMencoes([])
        setCasoVinculado(null)
        setAnexo(null)
        setRestrito(false)
      }
    } catch {
      setPosts((atual) => atual.map((item) => (item.id === otimista.id ? { ...item, falhaPublicacao: true } : item)))
      setRascunhoFalha(input)
      setTexto(input.texto)
      setMencoes(input.mencoes)
      setCasoVinculado(input.casoVinculado)
      setAnexo(input.anexo)
      setRestrito(input.restritoASocios)
    }
  }

  function publicar() {
    if (!texto.trim()) return
    void enviarPublicacao({
      texto,
      mencoes,
      casoVinculado,
      anexo,
      restritoASocios: restrito,
    })
  }

  async function alternarCurtida(post: PostUI) {
    const anterior = { curtidas: post.curtidas, curtidoPorMim: post.curtidoPorMim }
    const proximo = {
      curtidoPorMim: !post.curtidoPorMim,
      curtidas: post.curtidas + (post.curtidoPorMim ? -1 : 1),
    }
    setPosts((atual) => atual.map((item) => (item.id === post.id ? { ...item, ...proximo } : item)))
    try {
      await curtirPost(post.id)
    } catch {
      setPosts((atual) => atual.map((item) => (item.id === post.id ? { ...item, ...anterior } : item)))
    }
  }

  async function enviarComentario(post: PostUI, event: FormEvent) {
    event.preventDefault()
    const valor = comentarioTexto.trim()
    if (!valor) return
    const temp: Post['comentarios'][number] = {
      id: `c-temp-${crypto.randomUUID()}`,
      autor: usuarioAtual,
      texto: valor,
      criadoEm: new Date().toISOString(),
    }
    setPosts((atual) =>
      atual.map((item) =>
        item.id === post.id
          ? {
              ...item,
              comentarios: [temp, ...item.comentarios],
              totalComentarios: item.totalComentarios + 1,
            }
          : item,
      ),
    )
    setComentarioTexto('')
    try {
      const salvo = await comentar(post.id, valor)
      setPosts((atual) =>
        atual.map((item) =>
          item.id === post.id
            ? {
                ...item,
                comentarios: item.comentarios.map((c) => (c.id === temp.id ? salvo : c)),
              }
            : item,
        ),
      )
    } catch {
      setPosts((atual) =>
        atual.map((item) =>
          item.id === post.id
            ? {
                ...item,
                comentarios: item.comentarios.filter((c) => c.id !== temp.id),
                totalComentarios: Math.max(0, item.totalComentarios - 1),
              }
            : item,
        ),
      )
      setComentarioTexto(valor)
    }
  }

  async function confirmarExclusao() {
    if (!confirmando) return
    const alvo = confirmando
    setFalhaExclusao(null)
    if (alvo.tipo === 'post') {
      const indice = posts.findIndex((item) => item.id === alvo.postId)
      const removido = indice >= 0 ? posts[indice] : undefined
      if (!removido) return
      setPosts((atual) => atual.filter((item) => item.id !== alvo.postId))
      setConfirmando(null)
      try {
        await excluirPost(alvo.postId)
        listarMarcacoesNaoLidas()
          .then(setMarcacoes)
          .catch(() => setMarcacoes([]))
      } catch {
        setPosts((atual) => {
          if (atual.some((item) => item.id === removido.id)) return atual
          const copia = [...atual]
          copia.splice(Math.min(indice, copia.length), 0, removido)
          return copia
        })
        setFalhaExclusao(alvo.postId)
      }
      return
    }
    const post = posts.find((item) => item.id === alvo.postId)
    const comentario = post?.comentarios.find((item) => item.id === alvo.comentarioId)
    if (!post || !comentario) return
    setPosts((atual) =>
      atual.map((item) =>
        item.id === alvo.postId
          ? {
              ...item,
              comentarios: item.comentarios.filter((c) => c.id !== alvo.comentarioId),
              totalComentarios: Math.max(0, item.totalComentarios - 1),
            }
          : item,
      ),
    )
    setConfirmando(null)
    try {
      await excluirComentario(alvo.postId, alvo.comentarioId)
    } catch {
      setPosts((atual) =>
        atual.map((item) =>
          item.id === alvo.postId
            ? {
                ...item,
                comentarios: [comentario, ...item.comentarios.filter((c) => c.id !== comentario.id)],
                totalComentarios: item.totalComentarios + 1,
              }
            : item,
        ),
      )
      setFalhaExclusao(alvo.comentarioId)
    }
  }

  async function irParaMarcacao(marcacao: Marcacao) {
    setFiltro('tudo')
    setScrollAlvo(marcacao.postId)
    await marcarMencoesComoLidas(marcacao.postId)
    const restantes = await listarMarcacoesNaoLidas()
    setMarcacoes(restantes)
  }

  useEffect(() => {
    if (!scrollAlvo || feedStatus !== 'ready') return
    document.getElementById(`mural-post-${scrollAlvo}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setScrollAlvo(null)
  }, [feedStatus, filtro, postsFiltrados, scrollAlvo])

  const mentionAtivoId = mentionAberto ? `${mentionListId}-opt-${mentionAtivo}` : undefined
  const socioVisiveis = equipe.slice(0, 4)
  const sociosRestantes = Math.max(0, equipe.length - socioVisiveis.length)
  const podeRestringir = usuarioAtual.papel === 'socio'

  return (
    <div className="mural-page">
      <header className="mural-header">
        <h1>{saudacao}</h1>
        <div className="mural-header-rule" />
        <p className="mural-header-sub">{contexto}</p>
      </header>

      <div className="mural-layout">
        <div className="mural-col-main">
          <section className="mural-composer" aria-label="Nova publicação">
            <div className="mural-composer-row">
              <Avatar usuario={usuarioAtual} size={30} variant="self" />
              <div className="mural-composer-field">
                <div className="mural-composer-highlight" ref={highlightRef} aria-hidden="true">
                  <TextoComMencoes texto={texto} mencoes={mencoes} />
                </div>
                <textarea
                  ref={textareaRef}
                  className="mural-composer-input"
                  rows={1}
                  placeholder="Compartilhe algo com os sócios…"
                  value={texto}
                  role="combobox"
                  aria-expanded={mentionAberto}
                  aria-controls={mentionListId}
                  aria-activedescendant={mentionAtivoId}
                  aria-autocomplete="list"
                  aria-label="Texto da publicação"
                  onChange={(event) => atualizarTexto(event.target.value, event.target.selectionStart)}
                  onKeyDown={onComposerKeyDown}
                  onScroll={(event) => {
                    if (highlightRef.current) highlightRef.current.scrollTop = event.currentTarget.scrollTop
                  }}
                />
                {mentionAberto ? (
                  <ul className="mural-picker" id={mentionListId} role="listbox" aria-label="Marcar pessoa">
                    {opcoesMencao.length === 0 ? (
                      <li className="mural-picker-empty">Nenhuma pessoa encontrada.</li>
                    ) : (
                      opcoesMencao.map((opcao, index) => {
                        const pessoa = opcao.id === 'todos' ? null : usuarioPorId(opcao.id)
                        return (
                          <li key={String(opcao.id)} role="presentation">
                            <button
                              type="button"
                              className="mural-picker-option"
                              id={`${mentionListId}-opt-${index}`}
                              role="option"
                              aria-selected={index === mentionAtivo}
                              onMouseEnter={() => setMentionAtivo(index)}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => confirmarMencao(opcao)}
                            >
                              {pessoa ? (
                                <Avatar usuario={pessoa} size={22} variant="neutral" />
                              ) : (
                                <span className="mural-avatar mural-avatar--22 mural-avatar--neutral" aria-hidden="true">
                                  @
                                </span>
                              )}
                              @{rotuloMencao(opcao)}
                            </button>
                          </li>
                        )
                      })
                    )}
                  </ul>
                ) : null}
              </div>
            </div>

            {(casoVinculado || anexo) && (
              <div className="mural-composer-chips">
                {casoVinculado ? <ChipCaso caso={casoVinculado} onRemove={() => setCasoVinculado(null)} /> : null}
                {anexo ? <ChipAnexo anexo={anexo} onRemove={() => setAnexo(null)} /> : null}
              </div>
            )}

            <div className="mural-composer-actions">
              <div className="mural-composer-tools">
                <button type="button" className="mural-tool" onClick={iniciarMencao}>
                  <IconAt />
                  Marcar
                </button>
                <button
                  type="button"
                  className="mural-tool"
                  aria-expanded={casoAberto}
                  onClick={() => {
                    setCasoAberto((aberto) => !aberto)
                    setMentionAberto(false)
                    setCasoAtivo(0)
                  }}
                >
                  <IconMaleta />
                  Vincular caso
                </button>
                <button type="button" className="mural-tool" onClick={() => fileInputRef.current?.click()}>
                  <IconClipe />
                  Anexar
                </button>
                {podeRestringir ? (
                  <div className="mural-restrict">
                    <button
                      type="button"
                      className="mural-switch"
                      role="switch"
                      aria-checked={restrito}
                      aria-labelledby="mural-restrict-label"
                      onClick={() => setRestrito((atual) => !atual)}
                    >
                      <span className="mural-switch-knob" />
                    </button>
                    <span id="mural-restrict-label">Restrito a sócios</span>
                  </div>
                ) : null}
              </div>
              <button type="button" className="mural-publish" disabled={!texto.trim()} onClick={publicar}>
                Publicar
              </button>
            </div>

            <input
              ref={fileInputRef}
              className="mural-file-input"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) setAnexo(anexoDeArquivo(file))
                event.target.value = ''
              }}
            />

            {casoAberto ? (
              <div className="mural-picker mural-picker--casos">
                <input
                  className="mural-picker-search"
                  value={casoBusca}
                  placeholder="Buscar caso…"
                  aria-label="Buscar caso"
                  onChange={(event) => {
                    setCasoBusca(event.target.value)
                    setCasoAtivo(0)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      setCasoAtivo((atual) => (casosFiltrados.length === 0 ? 0 : (atual + 1) % casosFiltrados.length))
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      setCasoAtivo((atual) =>
                        casosFiltrados.length === 0 ? 0 : (atual - 1 + casosFiltrados.length) % casosFiltrados.length,
                      )
                    } else if (event.key === 'Enter') {
                      event.preventDefault()
                      const escolhido = casosFiltrados[casoAtivo]
                      if (escolhido) {
                        setCasoVinculado(casoParaVinculo(escolhido))
                        setCasoAberto(false)
                      }
                    } else if (event.key === 'Escape') {
                      setCasoAberto(false)
                    }
                  }}
                />
                <ul id={casoListId} role="listbox" aria-label="Casos">
                  {casosFiltrados.length === 0 ? (
                    <li className="mural-picker-empty">Nenhum caso encontrado.</li>
                  ) : (
                    casosFiltrados.map((caso, index) => (
                      <li key={caso.id} role="presentation">
                        <button
                          type="button"
                          className="mural-picker-option"
                          role="option"
                          aria-selected={index === casoAtivo}
                          onMouseEnter={() => setCasoAtivo(index)}
                          onClick={() => {
                            setCasoVinculado(casoParaVinculo(caso))
                            setCasoAberto(false)
                          }}
                        >
                          <span>
                            {caso.cliente} · {caso.empreendimento}
                            <span className="mural-picker-option-meta"> {STATUS_CASO_ROTULO[caso.status]}</span>
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
          </section>

          <div className="mural-filters" role="group" aria-label="Filtrar publicações">
            <button
              type="button"
              className="mural-chip-filter"
              aria-pressed={filtro === 'tudo'}
              onClick={() => setFiltro('tudo')}
            >
              Tudo
            </button>
            <button
              type="button"
              className="mural-chip-filter"
              aria-pressed={filtro === 'marcacoes'}
              onClick={() => setFiltro('marcacoes')}
            >
              Marcações
              <ContadorNaoLidas quantidade={naoLidas.length} />
            </button>
            <button
              type="button"
              className="mural-chip-filter"
              aria-pressed={filtro === 'atualizacoes'}
              onClick={() => setFiltro('atualizacoes')}
            >
              Atualizações
            </button>
          </div>

          <main>
            {feedStatus === 'loading' ? (
              <ul className="mural-feed">
                <PostEsqueleto />
                <PostEsqueleto />
                <PostEsqueleto />
              </ul>
            ) : feedStatus === 'error' ? (
              <div className="mural-feed-msg mural-feed-msg--error">
                Não foi possível carregar o mural.
                <button type="button" className="mural-text-btn" onClick={() => void carregarFeed()}>
                  Tentar novamente
                </button>
              </div>
            ) : posts.length === 0 ? (
              <div className="mural-feed-msg">Ainda não há publicações. Comece a conversa.</div>
            ) : postsFiltrados.length === 0 ? (
              <div className="mural-feed-msg">
                Nenhuma publicação neste filtro.
                <button type="button" className="mural-text-btn" onClick={() => setFiltro('tudo')}>
                  Ver tudo
                </button>
              </div>
            ) : (
              <ul className="mural-feed">
                {postsFiltrados.map((post) => {
                  const autorId = `mural-author-${post.id}`
                  const preview = comentariosAbertos[post.id] ? post.comentarios : post.comentarios.slice(0, 2)
                  const mostraVerTodos = !comentariosAbertos[post.id] && post.totalComentarios > preview.length
                  return (
                    <li key={post.id} id={`mural-post-${post.id}`}>
                      <article
                        className={`mural-post${post.tipo === 'atualizacao' ? ' mural-post--auto' : ''}${post.falhaPublicacao ? ' mural-post--failed' : ''}`}
                        aria-labelledby={autorId}
                      >
                        <div className="mural-post-row">
                          {post.tipo === 'atualizacao' ? (
                            <span className="mural-auto-icon" aria-hidden="true">
                              <IconMartelo />
                            </span>
                          ) : (
                            <Avatar usuario={post.autor ?? usuarioAtual} size={30} variant="neutral" />
                          )}
                          <div className="mural-post-body">
                            <div className="mural-post-head">
                              {post.tipo === 'atualizacao' ? (
                                <span className="mural-auto-label" id={autorId}>
                                  Atualização automática
                                </span>
                              ) : (
                                <span className="mural-post-name" id={autorId}>
                                  {post.autor?.nome}
                                </span>
                              )}
                              <span className="mural-post-meta">
                                {post.tipo === 'usuario' && post.autor
                                  ? `${rotuloPapel(post.autor)} · ${formatarTempoRelativo(post.criadoEm)}`
                                  : formatarTempoRelativo(post.criadoEm)}
                              </span>
                            </div>

                            {post.tipo === 'atualizacao' ? (
                              <TextoAtualizacao post={post} />
                            ) : (
                              <TextoComMencoes className="mural-post-text" texto={post.texto} mencoes={post.mencoes} />
                            )}

                            {post.tipo === 'usuario' && post.casoVinculado ? <ChipCaso caso={post.casoVinculado} /> : null}
                            {post.anexo ? <ChipAnexo anexo={post.anexo} /> : null}

                            <div className="mural-bar">
                              <button
                                type="button"
                                className="mural-bar-btn"
                                aria-pressed={post.curtidoPorMim}
                                aria-label="Curtir"
                                onClick={() => void alternarCurtida(post)}
                              >
                                <IconCurtir />
                                {post.curtidas}
                              </button>
                              <button
                                type="button"
                                className="mural-bar-btn"
                                onClick={() => {
                                  setComentando(post.id)
                                  setComentarioTexto('')
                                }}
                              >
                                <IconComentar />
                                {post.totalComentarios === 0
                                  ? 'Comentar'
                                  : post.totalComentarios === 1
                                    ? '1 comentário'
                                    : `${post.totalComentarios} comentários`}
                              </button>
                              {post.tipo === 'atualizacao' && post.casoVinculado ? (
                                <Link className="mural-bar-link" to={`/casos/${post.casoVinculado.id}`}>
                                  Abrir caso
                                </Link>
                              ) : null}
                              {podeExcluirPost(post) ? (
                                <button
                                  type="button"
                                  className="mural-bar-btn mural-bar-btn--danger"
                                  aria-label="Excluir para todos"
                                  onClick={() => {
                                    setFalhaExclusao(null)
                                    setConfirmando({ tipo: 'post', postId: post.id })
                                  }}
                                >
                                  <IconExcluir />
                                  Excluir para todos
                                </button>
                              ) : null}
                            </div>

                            {confirmando?.tipo === 'post' && confirmando.postId === post.id ? (
                              <div className="mural-confirm">
                                <p>Excluir para todos? A publicação some para toda a equipe.</p>
                                <div className="mural-confirm-actions">
                                  <button type="button" className="mural-text-btn" onClick={() => setConfirmando(null)}>
                                    Cancelar
                                  </button>
                                  <button type="button" className="mural-confirm-danger" onClick={() => void confirmarExclusao()}>
                                    Excluir para todos
                                  </button>
                                </div>
                              </div>
                            ) : null}

                            {falhaExclusao === post.id ? (
                              <p className="mural-fail">Não foi possível excluir.</p>
                            ) : null}

                            {post.falhaPublicacao ? (
                              <p className="mural-fail">
                                Não foi possível publicar.{' '}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const input = rascunhoFalha ?? {
                                      texto: post.texto,
                                      mencoes: post.mencoes,
                                      casoVinculado: post.casoVinculado,
                                      anexo: post.anexo,
                                      restritoASocios: post.restritoASocios,
                                    }
                                    void enviarPublicacao(input, post.id)
                                  }}
                                >
                                  Tentar novamente
                                </button>
                              </p>
                            ) : null}

                            {preview.length > 0 ? (
                              <div className="mural-comments">
                                {preview.map((comentario) => (
                                  <div className="mural-comment" key={comentario.id}>
                                    <Avatar usuario={comentario.autor} size={24} variant="neutral" />
                                    <div className="mural-comment-body">
                                      <p className="mural-comment-text">
                                        <span className="mural-comment-author">{comentario.autor.nome} </span>
                                        {comentario.texto}
                                      </p>
                                      {podeExcluirComentario(comentario) ? (
                                        confirmando?.tipo === 'comentario' &&
                                        confirmando.comentarioId === comentario.id ? (
                                          <div className="mural-confirm mural-confirm--comment">
                                            <p>Excluir para todos? O comentário some para toda a equipe.</p>
                                            <div className="mural-confirm-actions">
                                              <button type="button" className="mural-text-btn" onClick={() => setConfirmando(null)}>
                                                Cancelar
                                              </button>
                                              <button
                                                type="button"
                                                className="mural-confirm-danger"
                                                onClick={() => void confirmarExclusao()}
                                              >
                                                Excluir para todos
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            className="mural-comment-delete"
                                            aria-label="Excluir para todos"
                                            onClick={() => {
                                              setFalhaExclusao(null)
                                              setConfirmando({
                                                tipo: 'comentario',
                                                postId: post.id,
                                                comentarioId: comentario.id,
                                              })
                                            }}
                                          >
                                            Excluir para todos
                                          </button>
                                        )
                                      ) : null}
                                      {falhaExclusao === comentario.id ? (
                                        <p className="mural-fail">Não foi possível excluir.</p>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                                {mostraVerTodos ? (
                                  <button
                                    type="button"
                                    className="mural-more-comments"
                                    onClick={() => setComentariosAbertos((atual) => ({ ...atual, [post.id]: true }))}
                                  >
                                    Ver todos os {post.totalComentarios} comentários
                                  </button>
                                ) : null}
                              </div>
                            ) : null}

                            {comentando === post.id ? (
                              <form className="mural-comment-form" onSubmit={(event) => void enviarComentario(post, event)}>
                                <input
                                  className="mural-comment-input"
                                  value={comentarioTexto}
                                  placeholder="Escreva um comentário…"
                                  aria-label="Escreva um comentário"
                                  autoFocus
                                  onChange={(event) => setComentarioTexto(event.target.value)}
                                />
                              </form>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            )}
            {hasMore ? <div ref={sentinelRef} /> : null}
          </main>
        </div>

        <aside className="mural-col-side" aria-label="Painel do mural">
          <section className="mural-card" aria-labelledby="mural-marcacoes-label">
            <div className="mural-card-label" id="mural-marcacoes-label">
              <span>Marcações para você</span>
              <ContadorNaoLidas quantidade={naoLidas.length} />
            </div>
            {naoLidas.length === 0 ? (
              <p className="mural-empty-side">Nenhuma marcação nova.</p>
            ) : (
              naoLidas.slice(0, 3).map((item) => (
                <button key={item.id} type="button" className="mural-mark" onClick={() => void irParaMarcacao(item)}>
                  <Avatar usuario={item.autor} size={22} variant="neutral" />
                  <p className="mural-mark-text">
                    {primeiroNome(item.autor)} {item.resumo}
                  </p>
                </button>
              ))
            )}
          </section>

          <CartaoAtencao itens={atencao} />

          <section className="mural-card" aria-labelledby="mural-socios-label">
            <div className="mural-card-label" id="mural-socios-label">
              Sócios
            </div>
            <div className="mural-socios">
              {socioVisiveis.map((pessoa) => (
                <button
                  key={pessoa.id}
                  type="button"
                  className="mural-socio-btn"
                  title={pessoa.nome}
                  aria-label={pessoa.nome}
                  onClick={() => marcarPessoa(pessoa)}
                >
                  <Avatar usuario={pessoa} size={26} variant={pessoa.id === usuarioAtual.id ? 'self' : 'neutral'} />
                </button>
              ))}
              {sociosRestantes > 0 ? <span className="mural-socio-more">+{sociosRestantes}</span> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
