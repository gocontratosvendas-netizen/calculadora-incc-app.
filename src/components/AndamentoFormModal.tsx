import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  editarAndamento,
  registrarAndamento,
  TIPO_ANDAMENTO_ROTULO,
  TIPOS_ANDAMENTO_MANUAIS,
  type Andamento,
  type TipoAndamento,
  type TipoAndamentoManual,
} from '../lib/casos'
import '../pages/CasoDetalhe.css'

const LIMITE_TITULO = 80
const LIMITE_DESC = 600
const LIMITE_ANEXO = 20 * 1024 * 1024

type FormState = {
  tipo: TipoAndamentoManual
  data: string
  titulo: string
  descricao: string
  anexoNome: string
  criarPrazo: boolean
  dataPrazo: string
}

type FieldKey = 'tipo' | 'data' | 'titulo' | 'dataPrazo' | 'anexo'

function hojeIsoLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function focaveisDe(raiz: HTMLElement) {
  return [
    ...raiz.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => el.tabIndex !== -1)
}

function emptyForm(): FormState {
  return {
    tipo: 'contato',
    data: hojeIsoLocal(),
    titulo: '',
    descricao: '',
    anexoNome: '',
    criarPrazo: false,
    dataPrazo: '',
  }
}

function formFromAndamento(andamento: Andamento): FormState {
  const tipo = TIPOS_ANDAMENTO_MANUAIS.includes(andamento.tipo as TipoAndamentoManual)
    ? (andamento.tipo as TipoAndamentoManual)
    : 'contato'
  return {
    tipo,
    data: andamento.data.slice(0, 10),
    titulo: andamento.titulo,
    descricao: andamento.descricao ?? '',
    anexoNome: andamento.anexo?.nome ?? '',
    criarPrazo: false,
    dataPrazo: '',
  }
}

export function IconTipoAndamento({ tipo }: { tipo: TipoAndamento }) {
  switch (tipo) {
    case 'contato':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3.1 2.6h2.3l.9 2.1-1.4 1.2a7.4 7.4 0 0 0 4.2 4.2l1.2-1.4 2.1.9v2.3A1.3 1.3 0 0 1 11.1 13 8.6 8.6 0 0 1 3 4.9 1.3 1.3 0 0 1 4.4 2.6Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'documento':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 2.3h5.1L12.2 5.4v8.3H4V2.3Z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M9 2.4v3.2h3.1" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6.1 9.1 7.3 10.3l2.6-2.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'calculo':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="3" y="2.4" width="10" height="11.2" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.2 5.1h5.6M5.2 8.2h1.2M7.4 8.2h1.2M9.6 8.2h1.2M5.2 10.8h1.2M7.4 10.8h1.2M9.6 10.8h1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
    case 'protocolo':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2.4v11.2M3.4 5.2 8 7.4l4.6-2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.4 5.2V11L8 13.2 12.6 11V5.2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      )
    case 'decisao':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8.5 2.3 12.8 6.6l-1.1 1.1-4.3-4.3L8.5 2.3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M7.6 5.5 2.9 10.2l2.3 2.3 4.7-4.7" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M2.4 13.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
    case 'prazo':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M5.2 2.6h5.6M8 2.6v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="8" cy="9.1" r="4.3" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 7.2v2.1l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'financeiro':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="5.3" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 5.1v5.8M6.3 6.3c.4-.7 1-.9 1.7-.9 1.1 0 1.8.6 1.8 1.4 0 .9-.8 1.3-2 1.6s-2 .8-2 1.7c0 .9.8 1.5 2 1.5.8 0 1.4-.3 1.8-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
    case 'status':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.2 6.2h9.2M9.6 3.5 12.4 6.2 9.6 8.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12.8 9.8H3.6M6.4 12.5 3.6 9.8 6.4 7.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="5.4" r="2.2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M3.8 12.6c.5-2.1 2.1-3.2 4.2-3.2s3.7 1.1 4.2 3.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M11.4 3.4v3.2M9.8 5h3.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
  }
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function Field({
  id,
  label,
  error,
  counter,
  children,
}: {
  id: string
  label: string
  error?: string
  counter?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="caso-field">
      <div className="caso-field-label-row">
        <label htmlFor={id} className="caso-field-label">
          {label}
        </label>
        {counter}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="caso-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function AndamentoFormModal({
  casoId,
  andamento,
  returnFocusTo,
  onClose,
  onSaved,
}: {
  casoId: string
  andamento?: Andamento | null
  returnFocusTo: HTMLElement | null
  onClose: () => void
  onSaved: (andamento: Andamento) => void
}) {
  const tituloId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const arquivoRef = useRef<File | null>(null)
  const tipoTocadoRef = useRef(Boolean(andamento))
  const salvandoRef = useRef(false)
  const editando = Boolean(andamento)

  const [form, setForm] = useState<FormState>(() =>
    andamento ? formFromAndamento(andamento) : emptyForm(),
  )
  const [baseline] = useState(() =>
    JSON.stringify(andamento ? formFromAndamento(andamento) : emptyForm()),
  )
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState(false)
  const [anexoNovo, setAnexoNovo] = useState(false)

  const dirty = JSON.stringify(form) !== baseline || anexoNovo

  const tentarFechar = useCallback(() => {
    if (salvandoRef.current) return
    if (dirty) {
      const ok = window.confirm('Há alterações não salvas. Deseja descartá-las?')
      if (!ok) return
    }
    onClose()
  }, [dirty, onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const primeiro = dialog.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
    )
    primeiro?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        tentarFechar()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const itens = focaveisDe(dialogRef.current)
      if (itens.length === 0) return
      const primeiroItem = itens[0]
      const ultimoItem = itens[itens.length - 1]
      if (event.shiftKey && document.activeElement === primeiroItem) {
        event.preventDefault()
        ultimoItem.focus()
      } else if (!event.shiftKey && document.activeElement === ultimoItem) {
        event.preventDefault()
        primeiroItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      returnFocusTo?.focus()
    }
  }, [returnFocusTo, tentarFechar])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key as FieldKey]) return prev
      const next = { ...prev }
      delete next[key as FieldKey]
      return next
    })
  }

  function validar(state: FormState): Partial<Record<FieldKey, string>> {
    const next: Partial<Record<FieldKey, string>> = {}
    const hoje = hojeIsoLocal()
    if (!state.tipo) next.tipo = 'Selecione o tipo.'
    if (!state.titulo.trim()) next.titulo = 'Informe o título.'
    if (state.data > hoje) next.data = 'A data não pode ser futura.'
    if (state.criarPrazo) {
      if (!state.dataPrazo) next.dataPrazo = 'Informe a data do prazo.'
      else if (state.dataPrazo <= hoje) next.dataPrazo = 'O prazo deve ser uma data futura.'
    }
    return next
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next = validar(form)
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setSalvando(true)
    salvandoRef.current = true
    setErroSalvar(false)
    const payload = {
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      data: form.data,
      anexo: arquivoRef.current,
      criarPrazo: form.criarPrazo,
      dataPrazo: form.criarPrazo ? form.dataPrazo : null,
    }
    try {
      const salvo = editando && andamento
        ? await editarAndamento(andamento.id, payload)
        : await registrarAndamento(casoId, payload)
      onSaved(salvo)
    } catch {
      setErroSalvar(true)
    } finally {
      setSalvando(false)
      salvandoRef.current = false
    }
  }

  return (
    <div
      className="caso-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) tentarFechar()
      }}
    >
      <div
        ref={dialogRef}
        className="caso-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <form onSubmit={(e) => void onSubmit(e)}>
          <div className="caso-dialog-header">
            <h2 id={tituloId}>{editando ? 'Editar andamento' : 'Registrar andamento'}</h2>
            <button type="button" className="caso-dialog-close" aria-label="Fechar" onClick={tentarFechar}>
              <IconClose />
            </button>
          </div>
          <div className="caso-dialog-body">
            {erroSalvar ? (
              <p className="caso-alert" role="alert">
                Não foi possível salvar o andamento.
              </p>
            ) : null}

            <div className="caso-field">
              <span className="caso-field-label" id={`${tituloId}-tipo`}>
                Tipo
              </span>
              <div className="caso-type-grid" role="group" aria-labelledby={`${tituloId}-tipo`}>
                {TIPOS_ANDAMENTO_MANUAIS.map((tipo) => {
                  const selected = form.tipo === tipo
                  return (
                    <button
                      key={tipo}
                      type="button"
                      className={`caso-type-btn${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => {
                        tipoTocadoRef.current = true
                        setField('tipo', tipo)
                      }}
                    >
                      <span className={`caso-type-icon caso-type-icon--${tipo}`}>
                        <IconTipoAndamento tipo={tipo} />
                      </span>
                      {TIPO_ANDAMENTO_ROTULO[tipo]}
                    </button>
                  )
                })}
              </div>
              {errors.tipo ? (
                <p className="caso-field-error" role="alert">
                  {errors.tipo}
                </p>
              ) : null}
            </div>

            <Field id="and-data" label="Data" error={errors.data}>
              <input
                id="and-data"
                type="date"
                className={`caso-input${errors.data ? ' is-invalid' : ''}`}
                value={form.data}
                max={hojeIsoLocal()}
                onChange={(e) => setField('data', e.target.value)}
                aria-invalid={errors.data ? true : undefined}
                aria-describedby={errors.data ? 'and-data-error' : undefined}
                disabled={salvando}
              />
            </Field>

            <Field
              id="and-titulo"
              label="Título"
              error={errors.titulo}
              counter={
                <span className="caso-counter" aria-live="polite">
                  {form.titulo.length}/{LIMITE_TITULO}
                </span>
              }
            >
              <input
                id="and-titulo"
                className={`caso-input${errors.titulo ? ' is-invalid' : ''}`}
                value={form.titulo}
                maxLength={LIMITE_TITULO}
                onChange={(e) => setField('titulo', e.target.value)}
                aria-invalid={errors.titulo ? true : undefined}
                aria-describedby={errors.titulo ? 'and-titulo-error' : undefined}
                disabled={salvando}
              />
            </Field>

            <Field
              id="and-desc"
              label="Descrição"
              counter={
                <span className="caso-counter" aria-live="polite">
                  {form.descricao.length}/{LIMITE_DESC}
                </span>
              }
            >
              <textarea
                id="and-desc"
                className="caso-textarea caso-textarea--3"
                rows={3}
                value={form.descricao}
                maxLength={LIMITE_DESC}
                onChange={(e) => setField('descricao', e.target.value)}
                disabled={salvando}
              />
            </Field>

            <div className="caso-field">
              <span className="caso-field-label">Anexo</span>
              <button
                type="button"
                className="caso-file-btn"
                onClick={() => fileRef.current?.click()}
                disabled={salvando}
              >
                {form.anexoNome || 'Selecionar arquivo'}
              </button>
              {errors.anexo ? (
                <p className="caso-field-error" role="alert">
                  {errors.anexo}
                </p>
              ) : null}
              <input
                ref={fileRef}
                className="caso-visually-hidden"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (!file) return
                  if (file.size > LIMITE_ANEXO) {
                    setErrors((prev) => ({ ...prev, anexo: 'O arquivo deve ter no máximo 20 MB.' }))
                    return
                  }
                  arquivoRef.current = file
                  setAnexoNovo(true)
                  setField('anexoNome', file.name)
                  if (!tipoTocadoRef.current) setField('tipo', 'documento')
                }}
              />
            </div>

            {!editando ? (
              <>
                <div className="caso-switch-row">
                  <button
                    type="button"
                    className="caso-switch"
                    role="switch"
                    aria-checked={form.criarPrazo}
                    aria-labelledby="and-prazo-label"
                    onClick={() => setField('criarPrazo', !form.criarPrazo)}
                    disabled={salvando}
                  >
                    <span className="caso-switch-knob" />
                  </button>
                  <span id="and-prazo-label">Criar prazo a partir deste andamento</span>
                </div>
                {form.criarPrazo ? (
                  <Field id="and-data-prazo" label="Data do prazo" error={errors.dataPrazo}>
                    <input
                      id="and-data-prazo"
                      type="date"
                      className={`caso-input${errors.dataPrazo ? ' is-invalid' : ''}`}
                      value={form.dataPrazo}
                      min={hojeIsoLocal()}
                      onChange={(e) => setField('dataPrazo', e.target.value)}
                      aria-invalid={errors.dataPrazo ? true : undefined}
                      aria-describedby={errors.dataPrazo ? 'and-data-prazo-error' : undefined}
                      disabled={salvando}
                    />
                  </Field>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="caso-dialog-footer">
            <button type="button" className="caso-btn caso-btn--secondary" onClick={tentarFechar} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="caso-btn caso-btn--primary" disabled={salvando}>
              {editando ? 'Salvar alterações' : 'Salvar andamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
