import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { DocThumb } from '../components/DocThumb'
import {
  arquivoExcedeLimite,
  CATEGORIA_ROTULO,
  criarMaterial,
  excluirMaterial,
  formatarData,
  formatarTamanho,
  formatoDeArquivo,
  listarMateriais,
  nomeArquivo,
  THUMB_VARIANTES,
  type Categoria,
  type Material,
  type ThumbVariant,
} from '../lib/materiais'
import './Materiais.css'

type FiltroCategoria = 'todos' | Categoria

const CHIPS: { id: FiltroCategoria; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'comercial', rotulo: 'Comercial' },
  { id: 'juridico', rotulo: 'Jurídico' },
  { id: 'operacional', rotulo: 'Operacional' },
]

const THUMB_ROTULO: Record<ThumbVariant, string> = {
  carta: 'Carta',
  'carta-bloco': 'Carta com bloco',
  tabela: 'Tabela',
  checklist: 'Checklist',
  memorando: 'Memorando',
  relatorio: 'Relatório',
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function baixarMaterial(material: Material) {
  const link = document.createElement('a')
  link.href = material.url
  link.download = nomeArquivo(material)
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
}

function focaveisDe(raiz: HTMLElement) {
  return [...raiz.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el.tabIndex !== -1)
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
    <svg className="materiais-search-icon" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.6 9.6L12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
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

function Modal({
  labelledBy,
  onClose,
  returnFocusTo,
  children,
}: {
  labelledBy: string
  onClose: () => void
  returnFocusTo: HTMLElement | null
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const itens = focaveisDe(dialog)
    itens[0]?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const itensFoco = focaveisDe(dialogRef.current)
      if (itensFoco.length === 0) return
      const primeiro = itensFoco[0]
      const ultimo = itensFoco[itensFoco.length - 1]
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
      returnFocusTo?.focus()
    }
  }, [returnFocusTo])

  return (
    <div
      className="materiais-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="materiais-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>
  )
}

export default function Materiais() {
  const tituloPreviewId = useId()
  const tituloAddId = useId()
  const tituloExcluirId = useId()
  const [itens, setItens] = useState<Material[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [filtro, setFiltro] = useState<FiltroCategoria>('todos')
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [preview, setPreview] = useState<Material | null>(null)
  const [addAberto, setAddAberto] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<Material | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [origemFoco, setOrigemFoco] = useState<HTMLElement | null>(null)

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro(false)
    listarMateriais()
      .then((dados) => setItens(dados))
      .catch(() => {
        setErro(true)
        setItens([])
      })
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    let cancelado = false
    listarMateriais()
      .then((dados) => {
        if (!cancelado) setItens(dados)
      })
      .catch(() => {
        if (!cancelado) {
          setErro(true)
          setItens([])
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setBuscaDebounced(busca), 200)
    return () => window.clearTimeout(timer)
  }, [busca])

  const filtrados = useMemo(() => {
    const termo = normalizar(buscaDebounced.trim())
    return itens.filter((item) => {
      if (filtro !== 'todos' && item.categoria !== filtro) return false
      if (!termo) return true
      return normalizar(item.nome).includes(termo) || normalizar(item.descricao).includes(termo)
    })
  }, [itens, filtro, buscaDebounced])

  function abrirPreview(material: Material, origem: HTMLElement) {
    setOrigemFoco(origem)
    setPreview(material)
  }

  function abrirAdd(origem: HTMLElement) {
    setOrigemFoco(origem)
    setAddAberto(true)
  }

  function pedirExclusao(material: Material, origem: HTMLElement) {
    setOrigemFoco(origem)
    setParaExcluir(material)
  }

  function cancelarExclusao() {
    if (excluindo) return
    setParaExcluir(null)
  }

  async function confirmarExclusao() {
    if (!paraExcluir) return
    setExcluindo(true)
    try {
      await excluirMaterial(paraExcluir.id)
      setItens((atual) => atual.filter((item) => item.id !== paraExcluir.id))
      setPreview((atual) => (atual?.id === paraExcluir.id ? null : atual))
      setParaExcluir(null)
    } finally {
      setExcluindo(false)
    }
  }

  function handleCardKeyDown(event: ReactKeyboardEvent<HTMLElement>, material: Material) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      abrirPreview(material, event.currentTarget)
    }
  }

  return (
    <div className="materiais-page">
      <header className="materiais-header">
        <div>
          <h1 className="materiais-title">Materiais</h1>
          <p className="materiais-subtitle">
            Documentos de trabalho para uso dos sócios e da equipe jurídica.
          </p>
        </div>
        <button type="button" className="materiais-add" onClick={(event) => abrirAdd(event.currentTarget)}>
          <IconPlus />
          Adicionar documento
        </button>
      </header>

      <div className="materiais-filters">
        <div className="materiais-chips" role="group" aria-label="Filtrar por categoria">
          {CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={filtro === chip.id ? 'materiais-chip is-active' : 'materiais-chip'}
              aria-pressed={filtro === chip.id}
              onClick={() => setFiltro(chip.id)}
            >
              {chip.rotulo}
            </button>
          ))}
        </div>
        <label className="materiais-search-wrap">
          <IconSearch />
          <input
            className="materiais-search"
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar"
            aria-label="Buscar"
          />
        </label>
      </div>

      {carregando ? (
        <div className="materiais-grid" aria-busy="true" aria-label="Carregando materiais">
          {Array.from({ length: 12 }, (_, index) => (
            <div className="materiais-skeleton" key={index} aria-hidden="true" />
          ))}
        </div>
      ) : erro ? (
        <div className="materiais-error">
          <p className="materiais-error-text">Não foi possível carregar os materiais.</p>
          <button type="button" className="materiais-text-btn" onClick={carregar}>
            Tentar novamente
          </button>
        </div>
      ) : itens.length === 0 ? (
        <div className="materiais-empty">
          <p className="materiais-empty-text">Nenhum material cadastrado ainda.</p>
          <button type="button" className="materiais-add" onClick={(event) => abrirAdd(event.currentTarget)}>
            <IconPlus />
            Adicionar documento
          </button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="materiais-empty">
          <p className="materiais-empty-text">
            Nenhum documento encontrado para "{buscaDebounced.trim()}".
          </p>
          <button type="button" className="materiais-text-btn" onClick={() => setBusca('')}>
            Limpar busca
          </button>
        </div>
      ) : (
        <div className="materiais-grid">
          {filtrados.map((item) => (
            <article
              key={item.id}
              className="materiais-card"
              tabIndex={0}
              aria-label={`${item.nome}, ${CATEGORIA_ROTULO[item.categoria]}`}
              onClick={(event) => abrirPreview(item, event.currentTarget)}
              onKeyDown={(event) => handleCardKeyDown(event, item)}
            >
              <div className="materiais-card-thumb">
                <DocThumb variant={item.thumb} />
                <span className={`materiais-badge materiais-badge--${item.formato}`}>
                  {item.formato.toUpperCase()}
                </span>
              </div>
              <div className="materiais-card-body">
                <h2 className="materiais-card-name">{item.nome}</h2>
                <p className="materiais-card-desc">{item.descricao}</p>
                <div className="materiais-card-footer">
                  <span className="materiais-card-meta">
                    {CATEGORIA_ROTULO[item.categoria]} · {formatarTamanho(item.tamanhoBytes)}
                  </span>
                  <div className="materiais-card-actions">
                    <button
                      type="button"
                      className="materiais-icon-btn"
                      aria-label={`Baixar ${item.nome}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        baixarMaterial(item)
                      }}
                    >
                      <IconDownload />
                    </button>
                    <button
                      type="button"
                      className="materiais-icon-btn materiais-icon-btn--danger"
                      aria-label={`Excluir ${item.nome}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        pedirExclusao(item, event.currentTarget)
                      }}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {preview && !paraExcluir ? (
        <Modal
          labelledBy={tituloPreviewId}
          onClose={() => setPreview(null)}
          returnFocusTo={origemFoco}
        >
          <div className="materiais-preview-top">
            <div className="materiais-preview-thumb">
              <DocThumb variant={preview.thumb} />
            </div>
            <div className="materiais-preview-copy">
              <h2 className="materiais-preview-name" id={tituloPreviewId}>
                {preview.nome}
              </h2>
              <div className="materiais-preview-badges">
                <span className="materiais-badge materiais-badge--static materiais-badge--categoria">
                  {CATEGORIA_ROTULO[preview.categoria]}
                </span>
                <span className={`materiais-badge materiais-badge--static materiais-badge--${preview.formato}`}>
                  {preview.formato.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <p className="materiais-preview-desc">{preview.descricao}</p>
          <p className="materiais-preview-date">Atualizado em {formatarData(preview.atualizadoEm)}</p>
          <div className="materiais-dialog-actions materiais-dialog-actions--split">
            <button
              type="button"
              className="materiais-danger-ghost"
              onClick={(event) => pedirExclusao(preview, event.currentTarget)}
            >
              Excluir
            </button>
            <div className="materiais-dialog-actions-right">
              <button type="button" className="materiais-secondary" onClick={() => setPreview(null)}>
                Fechar
              </button>
              <button type="button" className="materiais-add" onClick={() => baixarMaterial(preview)}>
                Baixar
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {paraExcluir ? (
        <Modal
          labelledBy={tituloExcluirId}
          onClose={cancelarExclusao}
          returnFocusTo={preview ? null : origemFoco}
        >
          <h2 className="materiais-dialog-title" id={tituloExcluirId}>
            Excluir documento
          </h2>
          <p className="materiais-confirm-text">
            Tem certeza de que deseja excluir "{paraExcluir.nome}"? Esta ação não pode ser desfeita.
          </p>
          <div className="materiais-dialog-actions">
            <button
              type="button"
              className="materiais-secondary"
              onClick={cancelarExclusao}
              disabled={excluindo}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="materiais-danger"
              onClick={() => void confirmarExclusao()}
              disabled={excluindo}
            >
              {excluindo ? 'Excluindo…' : 'Excluir'}
            </button>
          </div>
        </Modal>
      ) : null}

      {addAberto ? (
        <AddModal
          tituloId={tituloAddId}
          onClose={() => setAddAberto(false)}
          returnFocusTo={origemFoco}
          onCriado={(material) => {
            setItens((atual) => [material, ...atual])
            setAddAberto(false)
          }}
        />
      ) : null}
    </div>
  )
}

function AddModal({
  tituloId,
  onClose,
  returnFocusTo,
  onCriado,
}: {
  tituloId: string
  onClose: () => void
  returnFocusTo: HTMLElement | null
  onCriado: (material: Material) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<Categoria | ''>('')
  const [thumb, setThumb] = useState<ThumbVariant | ''>('')
  const [arrastando, setArrastando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})

  function aplicarArquivo(file: File | undefined) {
    if (!file) return
    const proximo: Record<string, string> = {}
    if (!formatoDeArquivo(file)) {
      proximo.arquivo = 'Envie um arquivo PDF, DOCX ou XLSX.'
    } else if (arquivoExcedeLimite(file)) {
      proximo.arquivo = 'O arquivo excede o limite de 20 MB.'
    }
    setErros((atual) => ({ ...atual, arquivo: proximo.arquivo ?? '' }))
    if (proximo.arquivo) {
      setArquivo(null)
      return
    }
    setArquivo(file)
    setNome((atual) => atual || file.name.replace(/\.(pdf|docx|xlsx)$/i, ''))
  }

  function validar() {
    const proximo: Record<string, string> = {}
    if (!arquivo) proximo.arquivo = 'Selecione um arquivo.'
    else if (!formatoDeArquivo(arquivo)) proximo.arquivo = 'Envie um arquivo PDF, DOCX ou XLSX.'
    else if (arquivoExcedeLimite(arquivo)) proximo.arquivo = 'O arquivo excede o limite de 20 MB.'
    if (!nome.trim()) proximo.nome = 'Informe o nome.'
    if (!descricao.trim()) proximo.descricao = 'Diga quando este documento deve ser usado.'
    if (!categoria) proximo.categoria = 'Selecione a categoria.'
    if (!thumb) proximo.thumb = 'Selecione a miniatura.'
    setErros(proximo)
    return Object.keys(proximo).length === 0
  }

  async function salvar() {
    if (!validar() || !arquivo || !categoria || !thumb) return
    setSalvando(true)
    try {
      const criado = await criarMaterial({
        arquivo,
        nome,
        descricao,
        categoria,
        thumb,
      })
      onCriado(criado)
    } catch {
      setErros((atual) => ({ ...atual, arquivo: 'Não foi possível salvar o documento.' }))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal labelledBy={tituloId} onClose={onClose} returnFocusTo={returnFocusTo}>
      <h2 className="materiais-dialog-title" id={tituloId}>
        Adicionar documento
      </h2>
      <div className="materiais-field">
        <span className="materiais-label" id={`${tituloId}-arquivo`}>
          Arquivo
        </span>
        <button
          type="button"
          className={arrastando ? 'materiais-drop is-dragging' : 'materiais-drop'}
          aria-labelledby={`${tituloId}-arquivo`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setArrastando(true)
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(event) => {
            event.preventDefault()
            setArrastando(false)
            aplicarArquivo(event.dataTransfer.files[0])
          }}
        >
          Arraste o arquivo ou clique para selecionar.
          <br />
          PDF, DOCX ou XLSX. Até 20 MB.
          {arquivo ? <div className="materiais-file-name">{arquivo.name}</div> : null}
        </button>
        <input
          ref={fileRef}
          className="materiais-file-input"
          type="file"
          tabIndex={-1}
          accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            aplicarArquivo(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        {erros.arquivo ? <p className="materiais-error-inline">{erros.arquivo}</p> : null}
      </div>
      <div className="materiais-field">
        <label className="materiais-label" htmlFor={`${tituloId}-nome`}>
          Nome
        </label>
        <input
          id={`${tituloId}-nome`}
          className="materiais-input"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
        />
        {erros.nome ? <p className="materiais-error-inline">{erros.nome}</p> : null}
      </div>
      <div className="materiais-field">
        <label className="materiais-label" htmlFor={`${tituloId}-desc`}>
          Descrição
        </label>
        <textarea
          id={`${tituloId}-desc`}
          className="materiais-textarea"
          maxLength={220}
          value={descricao}
          onChange={(event) => setDescricao(event.target.value)}
        />
        <p className="materiais-help">Diga quando este documento deve ser usado.</p>
        <p className="materiais-counter">{descricao.length}/220</p>
        {erros.descricao ? <p className="materiais-error-inline">{erros.descricao}</p> : null}
      </div>
      <div className="materiais-field">
        <label className="materiais-label" htmlFor={`${tituloId}-cat`}>
          Categoria
        </label>
        <select
          id={`${tituloId}-cat`}
          className="materiais-select"
          value={categoria}
          onChange={(event) => setCategoria(event.target.value as Categoria | '')}
        >
          <option value="">Selecione</option>
          <option value="comercial">Comercial</option>
          <option value="juridico">Jurídico</option>
          <option value="operacional">Operacional</option>
        </select>
        {erros.categoria ? <p className="materiais-error-inline">{erros.categoria}</p> : null}
      </div>
      <div className="materiais-field">
        <span className="materiais-label" id={`${tituloId}-thumb`}>
          Miniatura
        </span>
        <div className="materiais-thumb-picker" role="group" aria-labelledby={`${tituloId}-thumb`}>
          {THUMB_VARIANTES.map((variante) => (
            <button
              key={variante}
              type="button"
              className={thumb === variante ? 'materiais-thumb-option is-selected' : 'materiais-thumb-option'}
              aria-pressed={thumb === variante}
              aria-label={THUMB_ROTULO[variante]}
              onClick={() => setThumb(variante)}
            >
              <DocThumb variant={variante} />
            </button>
          ))}
        </div>
        {erros.thumb ? <p className="materiais-error-inline">{erros.thumb}</p> : null}
      </div>
      <div className="materiais-dialog-actions">
        <button type="button" className="materiais-secondary" onClick={onClose} disabled={salvando}>
          Cancelar
        </button>
        <button type="button" className="materiais-add" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </Modal>
  )
}
