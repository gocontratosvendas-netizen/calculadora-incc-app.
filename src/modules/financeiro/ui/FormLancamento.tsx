import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { parseMoedaParaCentavos } from '../data/moeda'
import { formInicial, type FormLancamentoValues } from '../formState'
import { ORDEM_CAMPOS, validarLancamentoInput, type ErrosLancamento } from '../data/schemas'
import type { Classificacao, LancamentoInput, Movimentacao } from '../types'

function montarInput(values: FormLancamentoValues): LancamentoInput | { errors: ErrosLancamento } {
  const valor = parseMoedaParaCentavos(values.valorTexto)
  const extra: ErrosLancamento = {}
  if (!values.valorTexto.trim() || valor === null || valor <= 0) {
    extra.valor = 'Informe um valor maior que zero.'
  }
  const rascunho: LancamentoInput = {
    dataEmissao: values.dataEmissao,
    movimentacao: values.movimentacao,
    historico: values.historico.trim(),
    classificacaoId: values.classificacaoId,
    valor: valor && valor > 0 ? valor : 1,
    vencimento: values.vencimento,
    dataPagamento: values.dataPagamento.trim() ? values.dataPagamento : null,
  }
  const parsed = validarLancamentoInput(rascunho)
  if (!parsed.ok || extra.valor) {
    return { errors: { ...(parsed.ok ? {} : parsed.errors), ...extra } }
  }
  return parsed.data
}

type Props = {
  classificacoes: Classificacao[]
  salvando: boolean
  initial: FormLancamentoValues
  erroBanner: string | null
  onSubmit: (input: LancamentoInput, snapshot: FormLancamentoValues) => void
  onRetry: () => void
}

export function FormLancamento({
  classificacoes,
  salvando,
  initial,
  erroBanner,
  onSubmit,
  onRetry,
}: Props) {
  const [values, setValues] = useState<FormLancamentoValues>(initial)
  const [errors, setErrors] = useState<ErrosLancamento>({})
  const historicoRef = useRef<HTMLInputElement>(null)
  const campoRefs = useRef<Partial<Record<string, HTMLElement | null>>>({})

  const classificacoesFiltradas = classificacoes.filter(
    (c) => c.ativa && c.movimentacao === values.movimentacao,
  )

  function patch<K extends keyof FormLancamentoValues>(campo: K, valor: FormLancamentoValues[K]) {
    setValues((atual) => {
      const next = { ...atual, [campo]: valor }
      if (campo === 'movimentacao' && valor !== atual.movimentacao) next.classificacaoId = ''
      return next
    })
    const mapa: Record<string, keyof ErrosLancamento> = {
      dataEmissao: 'dataEmissao',
      movimentacao: 'movimentacao',
      historico: 'historico',
      classificacaoId: 'classificacaoId',
      valorTexto: 'valor',
      vencimento: 'vencimento',
      dataPagamento: 'dataPagamento',
    }
    const erroKey = mapa[campo]
    if (erroKey) setErrors((e) => ({ ...e, [erroKey]: undefined }))
  }

  function sujo(v: FormLancamentoValues): boolean {
    return (
      v.historico !== '' ||
      v.valorTexto !== '' ||
      v.dataPagamento !== '' ||
      v.classificacaoId !== '' ||
      v.vencimento !== v.dataEmissao
    )
  }

  function resetTotal() {
    setValues(formInicial())
    setErrors({})
  }

  function enviar() {
    if (salvando) return
    const resultado = montarInput(values)
    if ('errors' in resultado) {
      setErrors(resultado.errors)
      const primeiro = ORDEM_CAMPOS.find((c) => resultado.errors[c])
      campoRefs.current[primeiro ?? '']?.focus()
      return
    }
    onSubmit(resultado, values)
  }

  function onFormSubmit(event: FormEvent) {
    event.preventDefault()
    enviar()
  }

  function onKeyDown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      enviar()
    }
    if (event.key === 'Escape' && sujo(values)) {
      if (window.confirm('Limpar o formulário? Os dados digitados serão perdidos.')) resetTotal()
    }
  }

  function bindRef(nome: string) {
    return (el: HTMLInputElement | HTMLSelectElement | null) => {
      campoRefs.current[nome] = el
    }
  }

  return (
    <>
      {erroBanner ? (
        <div className="fin-banner">
          <span>{erroBanner}</span>
          <button type="button" className="fin-btn fin-btn--ghost" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      ) : null}
      <form className="fin-form" onSubmit={onFormSubmit} onKeyDown={onKeyDown} noValidate>
        <div className="fin-field">
          <label htmlFor="fin-emissao">Data de emissão</label>
          <input
            id="fin-emissao"
            ref={bindRef('dataEmissao')}
            type="date"
            className="fin-input"
            value={values.dataEmissao}
            onChange={(e) => patch('dataEmissao', e.target.value)}
          />
          {errors.dataEmissao ? <span className="fin-field-erro">{errors.dataEmissao}</span> : null}
        </div>

        <div className="fin-field">
          <label htmlFor="fin-mov">Movimentação</label>
          <select
            id="fin-mov"
            ref={bindRef('movimentacao')}
            className="fin-select"
            value={values.movimentacao}
            onChange={(e) => patch('movimentacao', e.target.value as Movimentacao)}
          >
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
          {errors.movimentacao ? <span className="fin-field-erro">{errors.movimentacao}</span> : null}
        </div>

        <div className="fin-field">
          <label htmlFor="fin-hist">Histórico</label>
          <input
            id="fin-hist"
            ref={(el) => {
              historicoRef.current = el
              campoRefs.current.historico = el
            }}
            className="fin-input"
            autoFocus
            value={values.historico}
            maxLength={120}
            onChange={(e) => patch('historico', e.target.value)}
          />
          {errors.historico ? <span className="fin-field-erro">{errors.historico}</span> : null}
        </div>

        <div className="fin-field">
          <label htmlFor="fin-cls">Classificação</label>
          <select
            id="fin-cls"
            ref={bindRef('classificacaoId')}
            className="fin-select"
            value={values.classificacaoId}
            onChange={(e) => patch('classificacaoId', e.target.value)}
          >
            <option value="">Selecionar</option>
            {classificacoesFiltradas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} — {c.nome}
              </option>
            ))}
          </select>
          {errors.classificacaoId ? <span className="fin-field-erro">{errors.classificacaoId}</span> : null}
        </div>

        <div className="fin-field">
          <label htmlFor="fin-valor">Valor</label>
          <input
            id="fin-valor"
            ref={bindRef('valor')}
            className="fin-input"
            inputMode="decimal"
            placeholder="0,00"
            value={values.valorTexto}
            onChange={(e) => patch('valorTexto', e.target.value)}
          />
          {errors.valor ? <span className="fin-field-erro">{errors.valor}</span> : null}
        </div>

        <div className="fin-field">
          <label htmlFor="fin-venc">Vencimento</label>
          <input
            id="fin-venc"
            ref={bindRef('vencimento')}
            type="date"
            className="fin-input"
            value={values.vencimento}
            onFocus={() => {
              if (!values.vencimento) patch('vencimento', values.dataEmissao)
            }}
            onChange={(e) => patch('vencimento', e.target.value)}
          />
          {errors.vencimento ? <span className="fin-field-erro">{errors.vencimento}</span> : null}
        </div>

        <div className="fin-field">
          <label htmlFor="fin-pagto">Data de pagamento</label>
          <input
            id="fin-pagto"
            ref={bindRef('dataPagamento')}
            type="date"
            className="fin-input"
            value={values.dataPagamento}
            onChange={(e) => patch('dataPagamento', e.target.value)}
          />
          {errors.dataPagamento ? <span className="fin-field-erro">{errors.dataPagamento}</span> : null}
        </div>

        <div className="fin-field fin-form-actions">
          <label htmlFor="fin-add">&nbsp;</label>
          <button id="fin-add" type="submit" className="fin-btn fin-btn--primary" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </form>
    </>
  )
}
