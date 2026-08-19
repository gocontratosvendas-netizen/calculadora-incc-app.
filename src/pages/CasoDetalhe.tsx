import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AndamentoFormModal, IconTipoAndamento } from '../components/AndamentoFormModal'
import { MudarStatusModal } from '../components/MudarStatusModal'
import {
  anexarDocumento,
  concluirPrazo,
  obterCaso,
  STATUS_CASO_ROTULO,
  type Andamento,
  type CasoDetalhe as CasoDetalheTipo,
  type CasoStatus,
  type DocumentoChave,
  type Prazo,
} from '../lib/casos'
import { Link } from '../lib/router'
import { useRouter } from '../lib/router-context'
import './CasoDetalhe.css'

const USUARIO_ATUAL_ID = 'usr-vitor'
const STATUS_LISTA: CasoStatus[] = ['processo_de_venda', 'ajuizado', 'encerrado']

const TIPO_MARKER: Record<
  Andamento['tipo'],
  { fundo: string; cor: string }
> = {
  contato: { fundo: '#FAEEDA', cor: '#854F0B' },
  documento: { fundo: '#E1F5EE', cor: '#0F6E56' },
  calculo: { fundo: '#EDF2FA', cor: '#16346B' },
  protocolo: { fundo: '#E6F1FB', cor: '#185FA5' },
  decisao: { fundo: '#E1F5EE', cor: '#0F6E56' },
  prazo: { fundo: '#FDF6F6', cor: '#A32D2D' },
  financeiro: { fundo: '#E1F5EE', cor: '#0F6E56' },
  status: { fundo: '#F0F2F6', cor: '#5B6474' },
  sistema: { fundo: '#F0F2F6', cor: '#5B6474' },
}

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const dataCurta = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
})

const dataLonga = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const mesAno = new Intl.DateTimeFormat('pt-BR', {
  month: '2-digit',
  year: 'numeric',
})

function parseLocal(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function hojeIsoLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatarTamanho(bytes: number) {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024)
    return `${mb.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function prescricaoUrgente(iso: string | null) {
  if (!iso) return false
  const limite = parseLocal(iso)
  const daqui6 = new Date()
  daqui6.setHours(0, 0, 0, 0)
  daqui6.setMonth(daqui6.getMonth() + 6)
  return limite.getTime() <= daqui6.getTime()
}

function podeEditarAndamento(andamento: Andamento) {
  if (andamento.tipo === 'status' || andamento.tipo === 'sistema') return false
  if (andamento.autor.id !== USUARIO_ATUAL_ID) return false
  return Date.now() - new Date(andamento.criadoEm).getTime() < 24 * 60 * 60 * 1000
}

function TextoDescricao({ texto }: { texto: string }) {
  const partes = texto.split(/(R\$\s*[\d.]+(?:,\d+)?)/g)
  return (
    <p className="caso-tl-desc">
      {partes.map((parte, index) =>
        /^R\$/.test(parte) ? (
          <span key={index} className="caso-tl-money">
            {parte}
          </span>
        ) : (
          <span key={index}>{parte}</span>
        ),
      )}
    </p>
  )
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.25v9.5M2.25 7h9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function IconCalc() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="2.4" width="10" height="11.2" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.2 5.1h5.6M5.2 8.2h1.2M7.4 8.2h1.2M9.6 8.2h1.2M5.2 10.8h1.2M7.4 10.8h1.2M9.6 10.8h1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.2 3.4 12.6 6.8M3.2 12.8l1.1-4.1L11.4 1.6l3 3L7.2 11.8l-4 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

function IconAlarm() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5.2 2.6h5.6M8 2.6v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="8" cy="9.1" r="4.3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7.2v2.1l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconCaret() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M3.2 4.8 6.5 8.1 9.8 4.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 6h7M6.5 3.2 9.5 6 6.5 8.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconFile() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 2.3h5.1L12.2 5.4v8.3H4V2.3Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 2.4v3.2h3.1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function IconDocCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 2.3h5.1L12.2 5.4v8.3H4V2.3Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 2.4v3.2h3.1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.1 9.1 7.3 10.3l2.6-2.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.4" y="3.6" width="11.2" height="8.8" rx="1.1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3 4.4 8 8.2 13 4.4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.1 2.6h2.3l.9 2.1-1.4 1.2a7.4 7.4 0 0 0 4.2 4.2l1.2-1.4 2.1.9v2.3A1.3 1.3 0 0 1 11.1 13 8.6 8.6 0 0 1 3 4.9 1.3 1.3 0 0 1 4.4 2.6Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.4 6.2 4.8 8.6 9.6 3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function StatusChip({
  status,
  onPick,
}: {
  status: CasoStatus
  onPick: (status: CasoStatus, origin: HTMLElement) => void
}) {
  const [aberto, setAberto] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!aberto) return
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setAberto(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [aberto])

  return (
    <div className="caso-status-wrap" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={`caso-status-chip caso-status-chip--${status}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={menuId}
        onClick={() => setAberto((v) => !v)}
      >
        <span className="caso-status-dot" aria-hidden="true" />
        {STATUS_CASO_ROTULO[status]}
        <IconCaret />
      </button>
      {aberto ? (
        <div className="caso-status-menu" id={menuId} role="menu">
          {STATUS_LISTA.map((item) => {
            const atual = item === status
            return (
              <button
                key={item}
                type="button"
                role="menuitemradio"
                aria-checked={atual}
                aria-disabled={atual || undefined}
                className={`caso-status-option${atual ? ' is-current' : ''}`}
                tabIndex={atual ? -1 : 0}
                onClick={() => {
                  if (atual) return
                  setAberto(false)
                  onPick(item, btnRef.current ?? document.body)
                }}
              >
                {STATUS_CASO_ROTULO[item]}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function podeAnexarDocumentoManualmente(chave: DocumentoChave) {
  return chave !== 'memoria_revisao_incc'
}

function Esqueleto() {
  return (
    <div className="caso-page" aria-busy="true" aria-live="polite">
      <div className="caso-skel caso-skel--crumb" />
      <div className="caso-skel caso-skel--title" />
      <div className="caso-skel caso-skel--sub" />
      <div className="caso-kpis">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="caso-kpi">
            <div className="caso-skel caso-skel--kpi-label" />
            <div className="caso-skel caso-skel--kpi-value" />
          </div>
        ))}
      </div>
      <div className="caso-card">
        <div className="caso-card-bar">
          <div className="caso-skel caso-skel--bar" />
        </div>
        <div className="caso-tl caso-tl--skel">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="caso-tl-skel-row">
              <div className="caso-skel caso-skel--avatar" />
              <div className="caso-tl-skel-body">
                <div className="caso-skel caso-skel--line" />
                <div className="caso-skel caso-skel--line-long" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CasoDetalhe({ id }: { id: string }) {
  const { navigate } = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const chaveAnexoRef = useRef<DocumentoChave | null>(null)

  const [caso, setCaso] = useState<CasoDetalheTipo | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading')
  const [carregadoId, setCarregadoId] = useState(id)
  const [modalAndamento, setModalAndamento] = useState<Andamento | null | 'novo'>(null)
  const [modalStatus, setModalStatus] = useState<CasoStatus | null>(null)
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null)
  const [destaqueId, setDestaqueId] = useState<string | null>(null)
  const [criteriosAbertos, setCriteriosAbertos] = useState(false)

  if (id !== carregadoId) {
    setCarregadoId(id)
    setStatus('loading')
    setCaso(null)
    setCriteriosAbertos(false)
  }

  const carregar = useCallback(async () => {
    setStatus('loading')
    try {
      const dados = await obterCaso(id)
      setCaso(dados)
      setStatus('ready')
      setCarregadoId(id)
    } catch (error) {
      setCaso(null)
      if (error instanceof Error && error.message === 'Caso não encontrado') setStatus('notfound')
      else setStatus('error')
      setCarregadoId(id)
    }
  }, [id])

  useEffect(() => {
    let cancelado = false
    void obterCaso(id)
      .then((dados) => {
        if (cancelado) return
        setCaso(dados)
        setStatus('ready')
        setCarregadoId(id)
      })
      .catch((error: unknown) => {
        if (cancelado) return
        setCaso(null)
        if (error instanceof Error && error.message === 'Caso não encontrado') setStatus('notfound')
        else setStatus('error')
        setCarregadoId(id)
      })
    return () => {
      cancelado = true
    }
  }, [id])

  useEffect(() => {
    if (!destaqueId) return
    const timer = window.setTimeout(() => setDestaqueId(null), 1500)
    return () => window.clearTimeout(timer)
  }, [destaqueId])

  if (status === 'loading') return <Esqueleto />

  if (status === 'notfound') {
    return (
      <div className="caso-page caso-page--msg">
        <p className="caso-msg">Caso não encontrado.</p>
        <button type="button" className="caso-btn caso-btn--text" onClick={() => navigate('/casos')}>
          Voltar para casos
        </button>
      </div>
    )
  }

  if (status === 'error' || !caso) {
    return (
      <div className="caso-page caso-page--msg">
        <p className="caso-msg caso-msg--error">Não foi possível carregar o caso.</p>
        <button type="button" className="caso-btn caso-btn--text" onClick={() => void carregar()}>
          Tentar novamente
        </button>
      </div>
    )
  }

  const prazosAbertos = caso.prazos.filter((prazo) => !prazo.concluido)
  const hoje = hojeIsoLocal()
  const enq = caso.enquadramento
  const veredito =
    enq.criteriosAtendidos >= 5
      ? { rotulo: 'Caso forte', classe: 'forte' }
      : enq.criteriosAtendidos >= 3
        ? { rotulo: 'Caso médio', classe: 'medio' }
        : { rotulo: 'Fora do perfil', classe: 'fraco' }

  async function onConcluirPrazo(prazo: Prazo) {
    try {
      await concluirPrazo(prazo.id)
      const atualizado = await obterCaso(id)
      setCaso(atualizado)
      const novo = atualizado.andamentos[0]
      if (novo) setDestaqueId(novo.id)
    } catch {
      /* keep state */
    }
  }

  async function onAnexar(chave: DocumentoChave, arquivo: File) {
    if (!podeAnexarDocumentoManualmente(chave)) return
    try {
      await anexarDocumento(id, chave, arquivo)
      setCaso(await obterCaso(id))
    } catch {
      /* keep state */
    }
  }

  return (
    <div className="caso-page">
      <nav className="caso-crumb" aria-label="Migalha">
        <Link to="/casos">Casos</Link>
        <span aria-hidden="true"> · </span>
        <span>{caso.cliente.nome}</span>
      </nav>

      <header className="caso-header">
        <div className="caso-header-left">
          <div className="caso-title-row">
            <h1>{caso.cliente.nome}</h1>
            <StatusChip
              status={caso.status}
              onPick={(novo, origin) => {
                setReturnFocusTo(origin)
                setModalStatus(novo)
              }}
            />
          </div>
          <div className="caso-header-rule" aria-hidden="true" />
          <p className="caso-header-sub">
            {caso.empreendimento} · {caso.incorporadora} · contrato de{' '}
            {dataLonga.format(parseLocal(caso.dataAssinatura))}
          </p>
        </div>
        <div className="caso-header-actions">
          <button type="button" className="caso-btn caso-btn--secondary" onClick={() => navigate('/calculadora')}>
            <IconCalc />
            Calculadora
          </button>
          <button
            type="button"
            className="caso-btn caso-btn--secondary"
            onClick={() => navigate(`/casos/novo?id=${caso.id}`)}
          >
            <IconPencil />
            Editar
          </button>
        </div>
      </header>

      <section className="caso-kpis" aria-label="Indicadores do caso">
        <div className="caso-kpi">
          <span className="caso-kpi-label">Valor do contrato</span>
          <span className="caso-kpi-value caso-kpi-value--num">{moeda.format(caso.valorContrato)}</span>
        </div>
        <div className="caso-kpi caso-kpi--excesso">
          <span className="caso-kpi-label">Excesso apurado</span>
          <span className={`caso-kpi-value caso-kpi-value--num${caso.excessoApurado == null ? ' is-empty' : ' is-excesso'}`}>
            {caso.excessoApurado == null ? '—' : moeda.format(caso.excessoApurado)}
          </span>
        </div>
        <div className="caso-kpi">
          <span className="caso-kpi-label">Valor da causa</span>
          <span className={`caso-kpi-value caso-kpi-value--num${caso.valorCausa == null ? ' is-empty' : ''}`}>
            {caso.valorCausa == null ? '—' : moeda.format(caso.valorCausa)}
          </span>
        </div>
        <div className="caso-kpi">
          <span className="caso-kpi-label">Prescrição</span>
          <span
            className={`caso-kpi-value${caso.prescricaoEm == null ? ' is-empty' : ''}${
              prescricaoUrgente(caso.prescricaoEm) ? ' is-urgente' : ''
            }`}
          >
            {caso.prescricaoEm == null ? '—' : `${mesAno.format(parseLocal(caso.prescricaoEm))} limite`}
          </span>
        </div>
      </section>

      <div className="caso-layout">
        <div className="caso-main">
          <section className="caso-card">
            <div className="caso-card-bar">
              <h2>Andamentos</h2>
              <button
                type="button"
                className="caso-btn caso-btn--primary caso-btn--sm"
                onClick={(event) => {
                  setReturnFocusTo(event.currentTarget)
                  setModalAndamento('novo')
                }}
              >
                <IconPlus />
                Registrar
              </button>
            </div>

            {prazosAbertos.map((prazo) => {
              const vencido = prazo.venceEm < hoje
              return (
                <div
                  key={prazo.id}
                  className="caso-prazo"
                  role={vencido ? 'alert' : 'status'}
                >
                  <IconAlarm />
                  <div className="caso-prazo-body">
                    <p className="caso-prazo-title">
                      {vencido ? 'Prazo vencido' : 'Prazo aberto'} · {dataLonga.format(parseLocal(prazo.venceEm))}
                    </p>
                    {prazo.descricao ? <p className="caso-prazo-desc">{prazo.descricao}</p> : null}
                  </div>
                  <button type="button" className="caso-prazo-concluir" onClick={() => void onConcluirPrazo(prazo)}>
                    Concluir
                  </button>
                </div>
              )
            })}

            {caso.andamentos.length === 0 ? (
              <div className="caso-empty">
                <p>Nenhum andamento registrado.</p>
                <button
                  type="button"
                  className="caso-btn caso-btn--primary caso-btn--sm"
                  onClick={(event) => {
                    setReturnFocusTo(event.currentTarget)
                    setModalAndamento('novo')
                  }}
                >
                  <IconPlus />
                  Registrar
                </button>
              </div>
            ) : (
              <ol className="caso-tl">
                {caso.andamentos.map((andamento, index) => {
                  const marker = TIPO_MARKER[andamento.tipo]
                  const ultimo = index === caso.andamentos.length - 1
                  const editavel = podeEditarAndamento(andamento)
                  return (
                    <li
                      key={andamento.id}
                      className={`caso-tl-item${destaqueId === andamento.id ? ' is-new' : ''}`}
                    >
                      <div className="caso-tl-marker" aria-hidden="true">
                        <span className="caso-tl-circle" style={{ background: marker.fundo, color: marker.cor }}>
                          <IconTipoAndamento tipo={andamento.tipo} />
                        </span>
                        {!ultimo ? <span className="caso-tl-line" /> : null}
                      </div>
                      <div className="caso-tl-content">
                        <div className="caso-tl-head">
                          <span className="caso-tl-title">{andamento.titulo}</span>
                          <span className="caso-tl-meta">
                            <time dateTime={andamento.data.slice(0, 10)}>
                              {dataCurta.format(parseLocal(andamento.data))}
                            </time>
                            {' · '}
                            {andamento.autor.nome}
                          </span>
                          {editavel ? (
                            <button
                              type="button"
                              className="caso-tl-edit"
                              aria-label="Editar andamento"
                              onClick={(event) => {
                                setReturnFocusTo(event.currentTarget)
                                setModalAndamento(andamento)
                              }}
                            >
                              <IconPencil />
                            </button>
                          ) : null}
                        </div>
                        {andamento.descricao ? <TextoDescricao texto={andamento.descricao} /> : null}
                        {andamento.anexo ? (
                          <a className="caso-tl-anexo" href={andamento.anexo.url} download={andamento.anexo.nome}>
                            <IconFile />
                            {andamento.anexo.nome}
                          </a>
                        ) : null}
                        {andamento.acao ? (
                          <Link className="caso-tl-acao" to={andamento.acao.destino}>
                            {andamento.acao.rotulo}
                            <IconArrow />
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          <section className="caso-card">
            <div className="caso-card-bar">
              <h2>Documentos</h2>
              <button
                type="button"
                className="caso-link-btn"
                onClick={() => {
                  const pendente = caso.documentos.find(
                    (doc) => doc.arquivo == null && podeAnexarDocumentoManualmente(doc.chave),
                  )
                  chaveAnexoRef.current = pendente?.chave ?? 'comprovantes'
                  fileRef.current?.click()
                }}
              >
                Anexar
              </button>
            </div>
            <ul className="caso-docs">
              {caso.documentos.map((doc, index) => {
                const presente = doc.arquivo != null
                const ultimo = index === caso.documentos.length - 1
                const geradoPelaCalculadora = doc.chave === 'memoria_revisao_incc'
                const iconColor =
                  !presente ? '#AEB5C0' : geradoPelaCalculadora || doc.chave === 'memorial' ? '#0F6E56' : '#5B6474'
                const conteudo: ReactNode = (
                  <>
                    <span className="caso-doc-icon" style={{ color: iconColor }}>
                      {presente && (geradoPelaCalculadora || doc.chave === 'memorial') ? (
                        <IconDocCheck />
                      ) : (
                        <IconFile />
                      )}
                    </span>
                    <span className={`caso-doc-nome${presente ? '' : ' is-pendente'}`}>
                      {doc.rotulo}
                      {presente && doc.arquivo ? (
                        <span className="caso-doc-size"> · {formatarTamanho(doc.arquivo.tamanhoBytes)}</span>
                      ) : null}
                    </span>
                    {presente && geradoPelaCalculadora ? (
                      <span className="caso-doc-badge caso-doc-badge--ok">Gerada</span>
                    ) : null}
                    {presente && doc.chave === 'memorial' ? (
                      <span className="caso-doc-badge caso-doc-badge--ok">Obrigatório</span>
                    ) : null}
                    {!presente && geradoPelaCalculadora ? (
                      <span className="caso-doc-badge caso-doc-badge--pend">Não gerada</span>
                    ) : null}
                    {!presente && !geradoPelaCalculadora ? (
                      <span className="caso-doc-badge caso-doc-badge--pend">Pendente</span>
                    ) : null}
                  </>
                )
                return (
                  <li key={doc.chave} className={`caso-doc${ultimo ? ' is-last' : ''}`}>
                    {presente && doc.arquivo ? (
                      <a className="caso-doc-row" href={doc.arquivo.url} download={doc.arquivo.nome}>
                        {conteudo}
                      </a>
                    ) : geradoPelaCalculadora ? (
                      <div className="caso-doc-row caso-doc-row--static">{conteudo}</div>
                    ) : (
                      <button
                        type="button"
                        className="caso-doc-row"
                        onClick={() => {
                          chaveAnexoRef.current = doc.chave
                          fileRef.current?.click()
                        }}
                      >
                        {conteudo}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
            <input
              ref={fileRef}
              className="caso-visually-hidden"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                const chave = chaveAnexoRef.current
                event.target.value = ''
                if (file && chave) void onAnexar(chave, file)
              }}
            />
          </section>
        </div>

        <aside className="caso-side">
          <section className="caso-side-card">
            <h2 className="caso-side-label">Contrato</h2>
            <div className="caso-side-row">
              <span>Assinatura</span>
              <span>{dataLonga.format(parseLocal(caso.dataAssinatura))}</span>
            </div>
            <div className="caso-side-row">
              <span>Parcelas reais</span>
              <span>
                {caso.parcelasContrato > 0 ? (
                  <>
                    {caso.parcelasReais}{' '}
                    <span className="caso-side-muted">de {caso.parcelasContrato}</span>
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>
            <div className="caso-side-row">
              <span>Parcela residual</span>
              <span>{caso.parcelaResidual == null ? '—' : moeda.format(caso.parcelaResidual)}</span>
            </div>
            <div className="caso-side-row">
              <span>Obra</span>
              <span>{caso.situacaoObra === 'entregue' ? 'Entregue' : 'Em andamento'}</span>
            </div>
            <div className="caso-side-row is-last">
              <span>Chaves</span>
              <span>{caso.dataChaves ? dataLonga.format(parseLocal(caso.dataChaves)) : '—'}</span>
            </div>
          </section>

          <section className="caso-side-card">
            <h2 className="caso-side-label">Cliente</h2>
            {caso.cliente.email ? (
              <a className="caso-side-contact caso-side-contact--link" href={`mailto:${caso.cliente.email}`}>
                <IconMail />
                <span>{caso.cliente.email}</span>
              </a>
            ) : (
              <p className="caso-side-contact is-empty">—</p>
            )}
            {caso.cliente.telefone ? (
              <p className="caso-side-contact">
                <IconPhone />
                <span>{caso.cliente.telefone}</span>
              </p>
            ) : null}
          </section>

          <section className="caso-side-card">
            <h2 className="caso-side-label">Origem e responsável</h2>
            {caso.parceiro ? (
              <Link className="caso-person" to="/parcerias">
                <span className="caso-person-sq">{caso.parceiro.iniciais}</span>
                <span>
                  <span className="caso-person-name">{caso.parceiro.nome}</span>
                  <span className="caso-person-role">parceiro</span>
                </span>
              </Link>
            ) : (
              <div className="caso-person caso-person--static">
                <span className="caso-person-sq">—</span>
                <span>
                  <span className="caso-person-name">{caso.canalOrigem}</span>
                  <span className="caso-person-role">origem</span>
                </span>
              </div>
            )}
            <div className="caso-person caso-person--static">
              <span
                className={`caso-person-av${caso.responsavel.id === USUARIO_ATUAL_ID ? ' is-self' : ''}`}
              >
                {caso.responsavel.iniciais}
              </span>
              <span>
                <span className="caso-person-name">{caso.responsavel.nome}</span>
                <span className="caso-person-role">responsável</span>
              </span>
            </div>
          </section>

          <section className={`caso-enq caso-enq--${veredito.classe}`}>
            <div className="caso-enq-head">
              <span className="caso-enq-label">Enquadramento</span>
              <span className="caso-enq-veredito">{veredito.rotulo}</span>
            </div>
            <div className="caso-enq-body">
              <p className="caso-enq-count">
                {enq.criteriosAtendidos} de 5 critérios atendidos
              </p>
              <div
                className="caso-enq-bars"
                role="img"
                aria-label={`${enq.criteriosAtendidos} de 5 critérios atendidos`}
              >
                {enq.criterios.map((criterio, index) => (
                  <span
                    key={index}
                    className={`caso-enq-bar${criterio.atendido ? ' is-on' : ''}`}
                  />
                ))}
              </div>
              <button
                type="button"
                className="caso-link-btn"
                aria-expanded={criteriosAbertos}
                onClick={() => setCriteriosAbertos((v) => !v)}
              >
                Ver critérios
              </button>
              {criteriosAbertos ? (
                <ul className="caso-enq-list">
                  {enq.criterios.map((criterio) => (
                    <li key={criterio.rotulo} className={criterio.atendido ? 'is-on' : 'is-off'}>
                      {criterio.atendido ? <IconCheck /> : <IconX />}
                      {criterio.rotulo}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      {modalAndamento != null ? (
        <AndamentoFormModal
          casoId={caso.id}
          andamento={modalAndamento === 'novo' ? null : modalAndamento}
          returnFocusTo={returnFocusTo}
          onClose={() => setModalAndamento(null)}
          onSaved={async (andamento) => {
            setModalAndamento(null)
            setCaso(await obterCaso(id))
            setDestaqueId(andamento.id)
          }}
        />
      ) : null}

      {modalStatus != null ? (
        <MudarStatusModal
          caso={caso}
          novoStatus={modalStatus}
          returnFocusTo={returnFocusTo}
          onClose={() => setModalStatus(null)}
          onSaved={(atualizado) => {
            setModalStatus(null)
            setCaso(atualizado)
            const novo = atualizado.andamentos[0]
            if (novo) setDestaqueId(novo.id)
          }}
        />
      ) : null}
    </div>
  )
}
