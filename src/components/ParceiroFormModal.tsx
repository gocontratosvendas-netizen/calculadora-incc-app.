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
import {
  atualizarParceiro,
  carregarSociosParceria,
  criarParceiro,
  dataInputParaIso,
  formatarDataInput,
  formatarMoeda,
  hojeIsoLocal,
  mascararDocumento,
  mascararTelefone,
  MODELO_COMISSAO_ROTULO,
  soDigitos,
  TIPO_ROTULO,
  usuarioAtualId,
  validarCnpj,
  validarCpf,
  validarEmail,
  type EstagioParceria,
  type ModeloComissao,
  type Parceiro,
  type ParceiroInput,
  type SocioParceria,
  type TipoParceiro,
} from '../lib/parcerias'

type FormState = {
  nome: string
  tipo: TipoParceiro | ''
  detalhe: string
  documento: string
  pessoa: string
  cargo: string
  email: string
  telefone: string
  estagio: EstagioParceria
  responsavelId: string
  proximoPasso: string
  ultimoContatoEm: string
  encerradaEm: string
  observacoes: string
  modelo: ModeloComissao
  percentual: string
  valorPorCaso: string
}

type FieldKey =
  | 'nome'
  | 'tipo'
  | 'documento'
  | 'pessoa'
  | 'email'
  | 'telefone'
  | 'contato'
  | 'responsavelId'
  | 'proximoPasso'
  | 'ultimoContatoEm'
  | 'encerradaEm'

const ESTAGIOS: EstagioParceria[] = [
  'prospeccao',
  'em_negociacao',
  'ativa',
  'encerrada',
]

const ESTAGIO_ROTULO: Record<EstagioParceria, string> = {
  prospeccao: 'Prospecção',
  em_negociacao: 'Em negociação',
  ativa: 'Ativa',
  encerrada: 'Encerrada',
}

const TIPOS = Object.keys(TIPO_ROTULO) as TipoParceiro[]
const MODELOS = Object.keys(MODELO_COMISSAO_ROTULO) as ModeloComissao[]

function focaveisDe(raiz: HTMLElement) {
  return [
    ...raiz.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => el.tabIndex !== -1)
}

function emptyForm(): FormState {
  return {
    nome: '',
    tipo: '',
    detalhe: '',
    documento: '',
    pessoa: '',
    cargo: '',
    email: '',
    telefone: '',
    estagio: 'prospeccao',
    responsavelId: usuarioAtualId,
    proximoPasso: '',
    ultimoContatoEm: hojeIsoLocal(),
    encerradaEm: '',
    observacoes: '',
    modelo: 'a_definir',
    percentual: '',
    valorPorCaso: '',
  }
}

function formFromParceiro(parceiro: Parceiro): FormState {
  return {
    nome: parceiro.nome,
    tipo: parceiro.tipo,
    detalhe: parceiro.detalhe ?? '',
    documento: parceiro.documento ? mascararDocumento(parceiro.documento) : '',
    pessoa: parceiro.contato.pessoa,
    cargo: parceiro.contato.cargo ?? '',
    email: parceiro.contato.email ?? '',
    telefone: parceiro.contato.telefone
      ? mascararTelefone(parceiro.contato.telefone)
      : '',
    estagio: parceiro.estagio,
    responsavelId: parceiro.responsavel.id,
    proximoPasso: parceiro.proximoPasso ?? '',
    ultimoContatoEm: formatarDataInput(parceiro.ultimoContatoEm) || hojeIsoLocal(),
    encerradaEm: formatarDataInput(parceiro.encerradaEm),
    observacoes: parceiro.observacoes ?? '',
    modelo: parceiro.comissionamento.modelo,
    percentual:
      parceiro.comissionamento.percentual != null
        ? String(parceiro.comissionamento.percentual)
        : '',
    valorPorCaso:
      parceiro.comissionamento.valorPorCaso != null
        ? String(parceiro.comissionamento.valorPorCaso)
        : '',
  }
}

function serializeForm(form: FormState): string {
  return JSON.stringify(form)
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconSpinner() {
  return (
    <svg className="parcerias-spinner" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle
        cx="7"
        cy="7"
        r="5.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="24"
        strokeDashoffset="8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Field({
  id,
  label,
  error,
  hint,
  counter,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  counter?: ReactNode
  children: ReactNode
}) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  return (
    <div className="parcerias-field">
      <div className="parcerias-field-label-row">
        <label htmlFor={id} className="parcerias-field-label">
          {label}
        </label>
        {counter}
      </div>
      {children}
      {hint ? (
        <p id={hintId} className="parcerias-field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="parcerias-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function ParceiroFormModal({
  parceiro,
  returnFocusTo,
  onClose,
  onSaved,
}: {
  parceiro: Parceiro | null
  returnFocusTo: HTMLElement | null
  onClose: () => void
  onSaved: (parceiro: Parceiro, criado: boolean) => void
}) {
  const tituloId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const initial = useMemo(
    () => (parceiro ? formFromParceiro(parceiro) : emptyForm()),
    [parceiro],
  )
  const [form, setForm] = useState<FormState>(initial)
  const [baseline] = useState(() => serializeForm(initial))
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [comissaoAberto, setComissaoAberto] = useState(
    () =>
      Boolean(
        parceiro &&
          (parceiro.comissionamento.modelo !== 'a_definir' ||
            parceiro.comissionamento.percentual != null ||
            parceiro.comissionamento.valorPorCaso != null),
      ),
  )
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState(false)
  const [socios, setSocios] = useState<SocioParceria[]>([])

  useEffect(() => {
    void carregarSociosParceria().then((lista) => {
      setSocios(lista)
      setForm((atual) =>
        atual.responsavelId
          ? atual
          : { ...atual, responsavelId: usuarioAtualId || lista[0]?.id || '' },
      )
    })
  }, [])
  const salvandoRef = useRef(false)

  const dirty = serializeForm(form) !== baseline
  const editando = parceiro != null

  const validarCampo = useCallback(
    (key: FieldKey, state: FormState = form): string | undefined => {
      switch (key) {
        case 'nome':
          return state.nome.trim().length >= 2
            ? undefined
            : 'Informe o nome do parceiro.'
        case 'tipo':
          return state.tipo ? undefined : 'Selecione o tipo.'
        case 'pessoa':
          return state.pessoa.trim()
            ? undefined
            : 'Informe a pessoa de contato.'
        case 'contato':
          return state.email.trim() || state.telefone.trim()
            ? undefined
            : 'Informe ao menos um e-mail ou telefone.'
        case 'email':
          if (!state.email.trim()) return undefined
          return validarEmail(state.email.trim()) ? undefined : 'E-mail inválido.'
        case 'telefone':
          return undefined
        case 'documento': {
          const digitos = soDigitos(state.documento)
          if (!digitos) return undefined
          if (digitos.length <= 11) {
            return digitos.length === 11 && validarCpf(digitos)
              ? undefined
              : 'CPF inválido.'
          }
          return digitos.length === 14 && validarCnpj(digitos)
            ? undefined
            : 'CNPJ inválido.'
        }
        case 'responsavelId':
          return state.responsavelId
            ? undefined
            : 'Selecione o sócio responsável.'
        case 'proximoPasso':
          if (
            state.estagio === 'prospeccao' ||
            state.estagio === 'em_negociacao'
          ) {
            return state.proximoPasso.trim()
              ? undefined
              : 'Descreva o próximo passo.'
          }
          return undefined
        case 'encerradaEm':
          if (state.estagio === 'encerrada') {
            return state.encerradaEm
              ? undefined
              : 'Informe a data de encerramento.'
          }
          return undefined
        case 'ultimoContatoEm': {
          if (!state.ultimoContatoEm) return undefined
          const hoje = hojeIsoLocal()
          return state.ultimoContatoEm > hoje
            ? 'A data não pode ser futura.'
            : undefined
        }
        default:
          return undefined
      }
    },
    [form],
  )

  const validarTudo = useCallback(
    (state: FormState = form) => {
      const keys: FieldKey[] = [
        'nome',
        'tipo',
        'documento',
        'pessoa',
        'email',
        'contato',
        'responsavelId',
        'proximoPasso',
        'ultimoContatoEm',
        'encerradaEm',
      ]
      const next: Partial<Record<FieldKey, string>> = {}
      for (const key of keys) {
        const msg = validarCampo(key, state)
        if (msg) next[key] = msg
      }
      return next
    },
    [form, validarCampo],
  )

  const tentarFechar = useCallback(() => {
    if (salvandoRef.current) return
    if (dirty) {
      const ok = window.confirm(
        'Há alterações não salvas. Deseja descartá-las?',
      )
      if (!ok) return
    }
    onClose()
  }, [dirty, onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const primeiro = dialog.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
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
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      setErrors((errs) => {
        const updated = { ...errs }
        const related: FieldKey[] = []
        if (key === 'nome') related.push('nome')
        if (key === 'tipo') related.push('tipo')
        if (key === 'pessoa') related.push('pessoa')
        if (key === 'email' || key === 'telefone') related.push('email', 'contato')
        if (key === 'documento') related.push('documento')
        if (key === 'responsavelId') related.push('responsavelId')
        if (key === 'proximoPasso' || key === 'estagio') related.push('proximoPasso', 'encerradaEm')
        if (key === 'ultimoContatoEm') related.push('ultimoContatoEm')
        if (key === 'encerradaEm') related.push('encerradaEm')
        for (const field of related) {
          if (touched[field] || errs[field]) {
            const msg = validarCampo(field, next)
            if (msg) updated[field] = msg
            else delete updated[field]
          }
        }
        return updated
      })
      return next
    })
  }

  function onBlurField(key: FieldKey) {
    setTouched((prev) => ({ ...prev, [key]: true }))
    const msg = validarCampo(key)
    setErrors((prev) => {
      const next = { ...prev }
      if (msg) next[key] = msg
      else delete next[key]
      return next
    })
  }

  function onEstagioKeyDown(event: ReactKeyboardEvent, atual: EstagioParceria) {
    const idx = ESTAGIOS.indexOf(atual)
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      const next = ESTAGIOS[(idx + 1) % ESTAGIOS.length]
      setField('estagio', next)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = ESTAGIOS[(idx - 1 + ESTAGIOS.length) % ESTAGIOS.length]
      setField('estagio', next)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (salvandoRef.current) return
    const nextErrors = validarTudo()
    setErrors(nextErrors)
    setTouched({
      nome: true,
      tipo: true,
      documento: true,
      pessoa: true,
      email: true,
      contato: true,
      responsavelId: true,
      proximoPasso: true,
      ultimoContatoEm: true,
      encerradaEm: true,
    })
    const order: FieldKey[] = [
      'nome',
      'tipo',
      'documento',
      'pessoa',
      'email',
      'contato',
      'responsavelId',
      'proximoPasso',
      'ultimoContatoEm',
      'encerradaEm',
    ]
    const primeiro = order.find((k) => nextErrors[k])
    if (primeiro) {
      const mapId: Record<FieldKey, string> = {
        nome: 'par-nome',
        tipo: 'par-tipo',
        documento: 'par-documento',
        pessoa: 'par-pessoa',
        email: 'par-email',
        telefone: 'par-telefone',
        contato: form.email.trim() ? 'par-email' : 'par-telefone',
        responsavelId: 'par-responsavel',
        proximoPasso: 'par-proximo',
        ultimoContatoEm: 'par-ultimo',
        encerradaEm: 'par-encerrada',
      }
      const el = dialogRef.current?.querySelector<HTMLElement>(`#${mapId[primeiro]}`)
      el?.focus()
      el?.scrollIntoView({ block: 'center' })
      return
    }

    const percentualNum =
      form.percentual.trim() === '' ? null : Number(form.percentual.replace(',', '.'))
    const valorNum =
      form.valorPorCaso.trim() === ''
        ? null
        : Number(form.valorPorCaso.replace(/\./g, '').replace(',', '.'))

    const input: ParceiroInput = {
      nome: form.nome,
      tipo: form.tipo as TipoParceiro,
      detalhe: form.detalhe.trim() || null,
      documento: form.documento.trim() || null,
      contato: {
        pessoa: form.pessoa,
        cargo: form.cargo.trim() || null,
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
      },
      estagio: form.estagio,
      responsavelId: form.responsavelId,
      proximoPasso:
        form.estagio === 'prospeccao' || form.estagio === 'em_negociacao'
          ? form.proximoPasso
          : null,
      ultimoContatoEm: dataInputParaIso(form.ultimoContatoEm),
      encerradaEm:
        form.estagio === 'encerrada' ? dataInputParaIso(form.encerradaEm) : null,
      observacoes: form.observacoes.trim() || null,
      comissionamento: {
        modelo: form.modelo,
        percentual:
          form.modelo === 'percentual_exito' || form.modelo === 'misto'
            ? percentualNum
            : null,
        valorPorCaso:
          form.modelo === 'valor_fixo' || form.modelo === 'misto' ? valorNum : null,
      },
    }

    salvandoRef.current = true
    setSalvando(true)
    setErroSalvar(false)
    try {
      const salvo = editando
        ? await atualizarParceiro(parceiro.id, input)
        : await criarParceiro(input)
      onSaved(salvo, !editando)
      onClose()
    } catch {
      setErroSalvar(true)
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }

  const mostraProximo =
    form.estagio === 'prospeccao' || form.estagio === 'em_negociacao'
  const mostraEncerrada = form.estagio === 'encerrada'
  const mostraPercentual =
    form.modelo === 'percentual_exito' || form.modelo === 'misto'
  const mostraValor = form.modelo === 'valor_fixo' || form.modelo === 'misto'

  const contatoError = errors.contato

  return (
    <div
      className="parcerias-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) tentarFechar()
      }}
    >
      <div
        ref={dialogRef}
        className="parcerias-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <div className="parcerias-dialog-header">
          <h2 id={tituloId}>
            {editando ? 'Editar parceiro' : 'Cadastrar parceiro'}
          </h2>
          <button
            type="button"
            className="parcerias-dialog-close"
            aria-label="Fechar"
            onClick={tentarFechar}
            disabled={salvando}
          >
            <IconClose />
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="parcerias-dialog-body">
            {erroSalvar ? (
              <div className="parcerias-alert" role="alert">
                Não foi possível salvar o parceiro.
              </div>
            ) : null}

            {editando && parceiro ? (
              <div className="parcerias-readonly">
                <div>
                  <span className="parcerias-readonly-label">Casos indicados</span>
                  <span className="parcerias-readonly-value">
                    {parceiro.casosIndicados}
                  </span>
                </div>
                <div>
                  <span className="parcerias-readonly-label">Excesso originado</span>
                  <span className="parcerias-readonly-value parcerias-readonly-value--azul">
                    {formatarMoeda(parceiro.excessoOriginado)}
                  </span>
                </div>
              </div>
            ) : null}

            <p className="parcerias-block-title">Identificação</p>

            <Field id="par-nome" label="Nome do parceiro" error={errors.nome}>
              <input
                id="par-nome"
                className={`parcerias-input${errors.nome ? ' is-invalid' : ''}`}
                value={form.nome}
                onChange={(e) => setField('nome', e.target.value)}
                onBlur={() => onBlurField('nome')}
                disabled={salvando}
                aria-invalid={errors.nome ? true : undefined}
                aria-describedby={errors.nome ? 'par-nome-error' : undefined}
              />
            </Field>

            <Field id="par-tipo" label="Tipo" error={errors.tipo}>
              <select
                id="par-tipo"
                className={`parcerias-input${errors.tipo ? ' is-invalid' : ''}`}
                value={form.tipo}
                onChange={(e) => setField('tipo', e.target.value as TipoParceiro | '')}
                onBlur={() => onBlurField('tipo')}
                disabled={salvando}
                aria-invalid={errors.tipo ? true : undefined}
                aria-describedby={errors.tipo ? 'par-tipo-error' : undefined}
              >
                <option value="">Selecione</option>
                {TIPOS.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPO_ROTULO[tipo]}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id="par-detalhe"
              label="Detalhe"
              hint="Cidade, número de condomínios, perfil da carteira."
              counter={
                <span className="parcerias-counter" aria-live="polite">
                  {form.detalhe.length}/60
                </span>
              }
            >
              <input
                id="par-detalhe"
                className="parcerias-input"
                value={form.detalhe}
                maxLength={60}
                onChange={(e) => setField('detalhe', e.target.value)}
                disabled={salvando}
              />
            </Field>

            <Field id="par-documento" label="CNPJ ou CPF" error={errors.documento}>
              <input
                id="par-documento"
                className={`parcerias-input${errors.documento ? ' is-invalid' : ''}`}
                value={form.documento}
                onChange={(e) => setField('documento', mascararDocumento(e.target.value))}
                onBlur={() => onBlurField('documento')}
                disabled={salvando}
                inputMode="numeric"
                aria-invalid={errors.documento ? true : undefined}
                aria-describedby={errors.documento ? 'par-documento-error' : undefined}
              />
            </Field>

            <p className="parcerias-block-title">Contato</p>
            <div className="parcerias-grid-2">
              <Field id="par-pessoa" label="Pessoa de contato" error={errors.pessoa}>
                <input
                  id="par-pessoa"
                  className={`parcerias-input${errors.pessoa ? ' is-invalid' : ''}`}
                  value={form.pessoa}
                  onChange={(e) => setField('pessoa', e.target.value)}
                  onBlur={() => onBlurField('pessoa')}
                  disabled={salvando}
                  aria-invalid={errors.pessoa ? true : undefined}
                  aria-describedby={errors.pessoa ? 'par-pessoa-error' : undefined}
                />
              </Field>
              <Field id="par-cargo" label="Cargo">
                <input
                  id="par-cargo"
                  className="parcerias-input"
                  value={form.cargo}
                  onChange={(e) => setField('cargo', e.target.value)}
                  disabled={salvando}
                />
              </Field>
              <Field id="par-email" label="E-mail" error={errors.email}>
                <input
                  id="par-email"
                  type="email"
                  className={`parcerias-input${errors.email || contatoError ? ' is-invalid' : ''}`}
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  onBlur={() => {
                    onBlurField('email')
                    onBlurField('contato')
                  }}
                  disabled={salvando}
                  aria-invalid={errors.email || contatoError ? true : undefined}
                  aria-describedby={
                    [
                      errors.email ? 'par-email-error' : null,
                      contatoError ? 'par-telefone-error' : null,
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                />
              </Field>
              <Field
                id="par-telefone"
                label="Telefone"
                error={contatoError}
              >
                <input
                  id="par-telefone"
                  className={`parcerias-input${contatoError ? ' is-invalid' : ''}`}
                  value={form.telefone}
                  onChange={(e) => setField('telefone', mascararTelefone(e.target.value))}
                  onBlur={() => onBlurField('contato')}
                  disabled={salvando}
                  inputMode="tel"
                  aria-invalid={contatoError ? true : undefined}
                  aria-describedby={contatoError ? 'par-telefone-error' : undefined}
                />
              </Field>
            </div>

            <p className="parcerias-block-title">Relacionamento</p>

            <div className="parcerias-field">
              <span className="parcerias-field-label" id="par-estagio-label">
                Estágio
              </span>
              <div
                className="parcerias-radio-group"
                role="radiogroup"
                aria-labelledby="par-estagio-label"
              >
                {ESTAGIOS.map((estagio) => {
                  const selected = form.estagio === estagio
                  return (
                    <button
                      key={estagio}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`parcerias-radio-chip${selected ? ' is-active' : ''}`}
                      tabIndex={selected ? 0 : -1}
                      disabled={salvando}
                      onClick={() => setField('estagio', estagio)}
                      onKeyDown={(e) => onEstagioKeyDown(e, form.estagio)}
                    >
                      {ESTAGIO_ROTULO[estagio]}
                    </button>
                  )
                })}
              </div>
            </div>

            <Field id="par-responsavel" label="Sócio responsável" error={errors.responsavelId}>
              <select
                id="par-responsavel"
                className={`parcerias-input${errors.responsavelId ? ' is-invalid' : ''}`}
                value={form.responsavelId}
                onChange={(e) => setField('responsavelId', e.target.value)}
                onBlur={() => onBlurField('responsavelId')}
                disabled={salvando}
                aria-invalid={errors.responsavelId ? true : undefined}
                aria-describedby={
                  errors.responsavelId ? 'par-responsavel-error' : undefined
                }
              >
                {socios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </Field>

            {mostraProximo ? (
              <Field
                id="par-proximo"
                label="Próximo passo"
                error={errors.proximoPasso}
                hint="O que precisa acontecer para avançar."
                counter={
                  <span className="parcerias-counter" aria-live="polite">
                    {form.proximoPasso.length}/140
                  </span>
                }
              >
                <textarea
                  id="par-proximo"
                  className={`parcerias-textarea parcerias-textarea--2${errors.proximoPasso ? ' is-invalid' : ''}`}
                  value={form.proximoPasso}
                  maxLength={140}
                  rows={2}
                  onChange={(e) => setField('proximoPasso', e.target.value)}
                  onBlur={() => onBlurField('proximoPasso')}
                  disabled={salvando}
                  aria-invalid={errors.proximoPasso ? true : undefined}
                  aria-describedby={
                    errors.proximoPasso ? 'par-proximo-error' : undefined
                  }
                />
              </Field>
            ) : null}

            <Field
              id="par-ultimo"
              label="Data do último contato"
              error={errors.ultimoContatoEm}
            >
              <input
                id="par-ultimo"
                type="date"
                className={`parcerias-input${errors.ultimoContatoEm ? ' is-invalid' : ''}`}
                value={form.ultimoContatoEm}
                max={hojeIsoLocal()}
                onChange={(e) => setField('ultimoContatoEm', e.target.value)}
                onBlur={() => onBlurField('ultimoContatoEm')}
                disabled={salvando}
                aria-invalid={errors.ultimoContatoEm ? true : undefined}
                aria-describedby={
                  errors.ultimoContatoEm ? 'par-ultimo-error' : undefined
                }
              />
            </Field>

            {mostraEncerrada ? (
              <Field
                id="par-encerrada"
                label="Data de encerramento"
                error={errors.encerradaEm}
              >
                <input
                  id="par-encerrada"
                  type="date"
                  className={`parcerias-input${errors.encerradaEm ? ' is-invalid' : ''}`}
                  value={form.encerradaEm}
                  onChange={(e) => setField('encerradaEm', e.target.value)}
                  onBlur={() => onBlurField('encerradaEm')}
                  disabled={salvando}
                  aria-invalid={errors.encerradaEm ? true : undefined}
                  aria-describedby={
                    errors.encerradaEm ? 'par-encerrada-error' : undefined
                  }
                />
              </Field>
            ) : null}

            <Field
              id="par-obs"
              label="Observações"
              counter={
                <span className="parcerias-counter" aria-live="polite">
                  {form.observacoes.length}/400
                </span>
              }
            >
              <textarea
                id="par-obs"
                className="parcerias-textarea parcerias-textarea--3"
                value={form.observacoes}
                maxLength={400}
                rows={3}
                onChange={(e) => setField('observacoes', e.target.value)}
                disabled={salvando}
              />
            </Field>

            <div className="parcerias-comissao">
              {!comissaoAberto ? (
                <button
                  type="button"
                  className="parcerias-btn parcerias-btn--text"
                  onClick={() => setComissaoAberto(true)}
                  disabled={salvando}
                >
                  Definir comissionamento
                </button>
              ) : (
                <>
                  <p className="parcerias-block-title">Comissionamento</p>
                  <Field id="par-modelo" label="Modelo">
                    <select
                      id="par-modelo"
                      className="parcerias-input"
                      value={form.modelo}
                      onChange={(e) =>
                        setField('modelo', e.target.value as ModeloComissao)
                      }
                      disabled={salvando}
                    >
                      {MODELOS.map((modelo) => (
                        <option key={modelo} value={modelo}>
                          {MODELO_COMISSAO_ROTULO[modelo]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {mostraPercentual ? (
                    <Field id="par-percentual" label="Percentual">
                      <input
                        id="par-percentual"
                        className="parcerias-input"
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={form.percentual}
                        onChange={(e) => setField('percentual', e.target.value)}
                        disabled={salvando}
                      />
                    </Field>
                  ) : null}
                  {mostraValor ? (
                    <Field id="par-valor" label="Valor por caso">
                      <input
                        id="par-valor"
                        className="parcerias-input"
                        inputMode="decimal"
                        value={form.valorPorCaso}
                        onChange={(e) => setField('valorPorCaso', e.target.value)}
                        disabled={salvando}
                        placeholder="R$"
                      />
                    </Field>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="parcerias-dialog-footer">
            <button
              type="button"
              className="parcerias-btn parcerias-btn--secondary parcerias-btn--dialog"
              onClick={tentarFechar}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="parcerias-btn parcerias-btn--primary parcerias-btn--dialog"
              disabled={salvando}
            >
              {salvando ? (
                <>
                  <IconSpinner />
                  Salvando…
                </>
              ) : (
                'Salvar parceiro'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
