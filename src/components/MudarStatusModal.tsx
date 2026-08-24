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
  DESFECHO_ROTULO,
  mudarStatus,
  STATUS_CASO_ROTULO,
  type CasoDetalhe,
  type CasoStatus,
  type Desfecho,
} from '../lib/casos'
import { mensagemErroSupabase } from '../lib/supabase'
import '../pages/CasoDetalhe.css'

type FormState = {
  dataMudanca: string
  observacao: string
  numeroProcesso: string
  dataProtocolo: string
  valorCausa: string
  varaComarca: string
  desfecho: Desfecho | ''
  valorRecuperado: string
  dataDesfecho: string
}

type FieldKey =
  | 'dataMudanca'
  | 'numeroProcesso'
  | 'dataProtocolo'
  | 'valorCausa'
  | 'desfecho'
  | 'valorRecuperado'
  | 'dataDesfecho'

const DESFECHOS = Object.keys(DESFECHO_ROTULO) as Desfecho[]
const DESFECHO_COM_VALOR: Desfecho[] = ['procedente', 'parcialmente_procedente', 'acordo']

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

function soDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

function mascararCnj(valor: string) {
  const d = soDigitos(valor).slice(0, 20)
  if (d.length <= 7) return d
  if (d.length <= 9) return `${d.slice(0, 7)}-${d.slice(7)}`
  if (d.length <= 13) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9)}`
  if (d.length <= 14) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13)}`
  if (d.length <= 16) {
    return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14)}`
  }
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`
}

function mascararMoeda(valor: string) {
  const d = soDigitos(valor)
  if (!d) return ''
  return new Intl.NumberFormat('pt-BR').format(Number(d))
}

function parseMoeda(valor: string): number | null {
  const d = soDigitos(valor)
  if (!d) return null
  return Number(d)
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

export function MudarStatusModal({
  caso,
  novoStatus,
  returnFocusTo,
  onClose,
  onSaved,
}: {
  caso: CasoDetalhe
  novoStatus: CasoStatus
  returnFocusTo: HTMLElement | null
  onClose: () => void
  onSaved: (caso: CasoDetalhe) => void
}) {
  const tituloId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const salvandoRef = useRef(false)
  const [form, setForm] = useState<FormState>(() => ({
    dataMudanca: hojeIsoLocal(),
    observacao: '',
    numeroProcesso: caso.numeroProcesso ?? '',
    dataProtocolo: caso.dataProtocolo?.slice(0, 10) ?? '',
    valorCausa: caso.valorCausa != null ? mascararMoeda(String(caso.valorCausa)) : '',
    varaComarca: caso.varaComarca ?? '',
    desfecho: caso.desfecho ?? '',
    valorRecuperado: caso.valorRecuperado != null ? mascararMoeda(String(caso.valorRecuperado)) : '',
    dataDesfecho: hojeIsoLocal(),
  }))
  const [baseline] = useState(() => JSON.stringify(form))
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)

  const dirty = JSON.stringify(form) !== baseline
  const precisaValor = form.desfecho !== '' && DESFECHO_COM_VALOR.includes(form.desfecho)

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
    if (!state.dataMudanca) next.dataMudanca = 'Informe a data da mudança.'
    else if (state.dataMudanca > hoje) next.dataMudanca = 'A data não pode ser futura.'
    if (novoStatus === 'ajuizado') {
      if (soDigitos(state.numeroProcesso).length < 20) next.numeroProcesso = 'Informe o número do processo.'
      if (!state.dataProtocolo) next.dataProtocolo = 'Informe a data de protocolo.'
      if (parseMoeda(state.valorCausa) == null) next.valorCausa = 'Informe o valor da causa.'
    }
    if (novoStatus === 'encerrado') {
      if (!state.desfecho) next.desfecho = 'Selecione o desfecho.'
      if (state.desfecho && DESFECHO_COM_VALOR.includes(state.desfecho) && parseMoeda(state.valorRecuperado) == null) {
        next.valorRecuperado = 'Informe o valor recuperado.'
      }
      if (!state.dataDesfecho) next.dataDesfecho = 'Informe a data do desfecho.'
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
    setErroSalvar(null)
    try {
      const salvo = await mudarStatus(caso.id, {
        status: novoStatus,
        dataMudanca: form.dataMudanca,
        observacao: form.observacao.trim() || null,
        numeroProcesso: novoStatus === 'ajuizado' ? form.numeroProcesso : undefined,
        dataProtocolo: novoStatus === 'ajuizado' ? form.dataProtocolo : undefined,
        valorCausa: novoStatus === 'ajuizado' ? parseMoeda(form.valorCausa) : undefined,
        varaComarca: novoStatus === 'ajuizado' ? form.varaComarca.trim() || null : undefined,
        desfecho: novoStatus === 'encerrado' && form.desfecho ? form.desfecho : undefined,
        valorRecuperado:
          novoStatus === 'encerrado' && form.desfecho && DESFECHO_COM_VALOR.includes(form.desfecho)
            ? parseMoeda(form.valorRecuperado)
            : undefined,
        dataDesfecho: novoStatus === 'encerrado' ? form.dataDesfecho : undefined,
      })
      onSaved(salvo)
    } catch (error) {
      setErroSalvar(mensagemErroSupabase(error, 'Não foi possível alterar o status.'))
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
        className="caso-dialog caso-dialog--status"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <form onSubmit={(e) => void onSubmit(e)}>
          <div className="caso-dialog-header">
            <h2 id={tituloId}>Mudar status para {STATUS_CASO_ROTULO[novoStatus]}</h2>
            <button type="button" className="caso-dialog-close" aria-label="Fechar" onClick={tentarFechar}>
              <IconClose />
            </button>
          </div>
          <div className="caso-dialog-body">
            {erroSalvar ? (
              <p className="caso-alert" role="alert">
                {erroSalvar}
              </p>
            ) : null}

            <Field id="st-data" label="Data da mudança" error={errors.dataMudanca}>
              <input
                id="st-data"
                type="date"
                className={`caso-input${errors.dataMudanca ? ' is-invalid' : ''}`}
                value={form.dataMudanca}
                max={hojeIsoLocal()}
                onChange={(e) => setField('dataMudanca', e.target.value)}
                aria-invalid={errors.dataMudanca ? true : undefined}
                aria-describedby={errors.dataMudanca ? 'st-data-error' : undefined}
                disabled={salvando}
              />
            </Field>

            {novoStatus === 'ajuizado' ? (
              <>
                <Field id="st-cnj" label="Número do processo" error={errors.numeroProcesso}>
                  <input
                    id="st-cnj"
                    className={`caso-input${errors.numeroProcesso ? ' is-invalid' : ''}`}
                    value={form.numeroProcesso}
                    placeholder="0000000-00.0000.0.00.0000"
                    inputMode="numeric"
                    onChange={(e) => setField('numeroProcesso', mascararCnj(e.target.value))}
                    aria-invalid={errors.numeroProcesso ? true : undefined}
                    aria-describedby={errors.numeroProcesso ? 'st-cnj-error' : undefined}
                    disabled={salvando}
                  />
                </Field>
                <Field id="st-protocolo" label="Data de protocolo" error={errors.dataProtocolo}>
                  <input
                    id="st-protocolo"
                    type="date"
                    className={`caso-input${errors.dataProtocolo ? ' is-invalid' : ''}`}
                    value={form.dataProtocolo}
                    max={hojeIsoLocal()}
                    onChange={(e) => setField('dataProtocolo', e.target.value)}
                    aria-invalid={errors.dataProtocolo ? true : undefined}
                    aria-describedby={errors.dataProtocolo ? 'st-protocolo-error' : undefined}
                    disabled={salvando}
                  />
                </Field>
                <Field id="st-causa" label="Valor da causa" error={errors.valorCausa}>
                  <input
                    id="st-causa"
                    className={`caso-input${errors.valorCausa ? ' is-invalid' : ''}`}
                    value={form.valorCausa}
                    inputMode="numeric"
                    placeholder="0"
                    onChange={(e) => setField('valorCausa', mascararMoeda(e.target.value))}
                    aria-invalid={errors.valorCausa ? true : undefined}
                    aria-describedby={errors.valorCausa ? 'st-causa-error' : undefined}
                    disabled={salvando}
                  />
                </Field>
                <Field id="st-vara" label="Vara / comarca">
                  <input
                    id="st-vara"
                    className="caso-input"
                    value={form.varaComarca}
                    onChange={(e) => setField('varaComarca', e.target.value)}
                    disabled={salvando}
                  />
                </Field>
              </>
            ) : null}

            {novoStatus === 'encerrado' ? (
              <>
                <Field id="st-desfecho" label="Desfecho" error={errors.desfecho}>
                  <select
                    id="st-desfecho"
                    className={`caso-input${errors.desfecho ? ' is-invalid' : ''}`}
                    value={form.desfecho}
                    onChange={(e) => setField('desfecho', e.target.value as Desfecho | '')}
                    aria-invalid={errors.desfecho ? true : undefined}
                    aria-describedby={errors.desfecho ? 'st-desfecho-error' : undefined}
                    disabled={salvando}
                  >
                    <option value="">Selecione</option>
                    {DESFECHOS.map((item) => (
                      <option key={item} value={item}>
                        {DESFECHO_ROTULO[item]}
                      </option>
                    ))}
                  </select>
                </Field>
                {precisaValor ? (
                  <Field id="st-recuperado" label="Valor recuperado" error={errors.valorRecuperado}>
                    <input
                      id="st-recuperado"
                      className={`caso-input${errors.valorRecuperado ? ' is-invalid' : ''}`}
                      value={form.valorRecuperado}
                      inputMode="numeric"
                      placeholder="0"
                      onChange={(e) => setField('valorRecuperado', mascararMoeda(e.target.value))}
                      aria-invalid={errors.valorRecuperado ? true : undefined}
                      aria-describedby={errors.valorRecuperado ? 'st-recuperado-error' : undefined}
                      disabled={salvando}
                    />
                  </Field>
                ) : null}
                <Field id="st-desfecho-data" label="Data do desfecho" error={errors.dataDesfecho}>
                  <input
                    id="st-desfecho-data"
                    type="date"
                    className={`caso-input${errors.dataDesfecho ? ' is-invalid' : ''}`}
                    value={form.dataDesfecho}
                    max={hojeIsoLocal()}
                    onChange={(e) => setField('dataDesfecho', e.target.value)}
                    aria-invalid={errors.dataDesfecho ? true : undefined}
                    aria-describedby={errors.dataDesfecho ? 'st-desfecho-data-error' : undefined}
                    disabled={salvando}
                  />
                </Field>
              </>
            ) : null}

            <Field
              id="st-obs"
              label="Observação"
              counter={
                <span className="caso-counter" aria-live="polite">
                  {form.observacao.length}/200
                </span>
              }
            >
              <textarea
                id="st-obs"
                className="caso-textarea caso-textarea--2"
                rows={2}
                maxLength={200}
                value={form.observacao}
                onChange={(e) => setField('observacao', e.target.value)}
                disabled={salvando}
              />
            </Field>
          </div>
          <div className="caso-dialog-footer">
            <button type="button" className="caso-btn caso-btn--secondary" onClick={tentarFechar} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="caso-btn caso-btn--primary" disabled={salvando}>
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
