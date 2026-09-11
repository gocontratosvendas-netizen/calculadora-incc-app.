import { useEffect, useState } from 'react'
import {
  creditoCompradoDoCaso,
  honorariosExitoDoCaso,
  PERCENTUAIS_EXITO,
  type CasoDetalhe,
} from '../lib/casos'
import { obterProLaboreDoCaso, type ProLaboreDoCaso } from '../modules/financeiro/data/repositorio'

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type Props = {
  caso: Pick<CasoDetalhe, 'id' | 'valorCausa' | 'percentualExito' | 'creditoComprado'>
  salvandoPercentual: boolean
  salvandoCreditoComprado: boolean
  onPercentual: (percentual: number) => void
  onCreditoComprado: (creditoComprado: boolean) => void
}

export function HonorariosCaso({
  caso,
  salvandoPercentual,
  salvandoCreditoComprado,
  onPercentual,
  onCreditoComprado,
}: Props) {
  const [proLabore, setProLabore] = useState<ProLaboreDoCaso | null>(null)
  const esperado = honorariosExitoDoCaso(caso.valorCausa, caso.percentualExito)
  const diferencaCredito = creditoCompradoDoCaso(caso.valorCausa, caso.percentualExito)
  const valorCredito = caso.creditoComprado ? diferencaCredito : null

  useEffect(() => {
    let cancelado = false
    setProLabore(null)
    void obterProLaboreDoCaso(caso.id).then((dados) => {
      if (!cancelado) setProLabore(dados)
    })
    return () => {
      cancelado = true
    }
  }, [caso.id])

  const valorProLabore = proLabore
    ? proLabore.status === 'pago'
      ? proLabore.valorPago
      : proLabore.valorPago + proLabore.valorPendente
    : null
  const temLancamento = Boolean(proLabore && (proLabore.valorPago > 0 || proLabore.valorPendente > 0))

  return (
    <section className="caso-honorarios" aria-label="Honorários do caso">
      <div className="caso-honorarios-card">
        <div className="caso-honorarios-head">
          <span className="caso-kpi-label">Honorários de êxito</span>
          {esperado != null ? (
            <span className="caso-honorarios-badge">
              {caso.percentualExito}% sobre o valor da causa
            </span>
          ) : (
            <span className="caso-honorarios-badge is-muted">Sem valor da causa</span>
          )}
        </div>
        <span className={`caso-kpi-value caso-kpi-value--num${esperado == null ? ' is-empty' : ''}`}>
          {esperado == null ? '—' : moeda.format(esperado)}
        </span>
        <div className="caso-honorarios-pct" role="group" aria-label="Percentual de êxito">
          {PERCENTUAIS_EXITO.map((pct) => (
            <button
              key={pct}
              type="button"
              className={caso.percentualExito === pct ? 'is-active' : ''}
              aria-pressed={caso.percentualExito === pct}
              disabled={salvandoPercentual}
              onClick={() => {
                if (pct !== caso.percentualExito) onPercentual(pct)
              }}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      <div className="caso-honorarios-card">
        <div className="caso-honorarios-head">
          <span className="caso-kpi-label">Honorários pró-labore</span>
          {proLabore ? (
            <span
              className={`caso-honorarios-status ${
                proLabore.status === 'pago' ? 'is-pago' : 'is-nao-pago'
              }`}
            >
              {proLabore.status === 'pago' ? 'Pago' : 'Não pago'}
            </span>
          ) : (
            <span className="caso-honorarios-status is-loading">Consultando…</span>
          )}
        </div>
        <span
          className={`caso-kpi-value caso-kpi-value--num${
            !temLancamento ? ' is-empty' : ''
          }`}
        >
          {valorProLabore && temLancamento ? moeda.format(valorProLabore) : '—'}
        </span>
        <p className="caso-honorarios-hint">
          {proLabore == null
            ? 'Buscando lançamentos vinculados a este cliente.'
            : !temLancamento
              ? 'Nenhum recebimento de pró-labore vinculado a este cliente.'
              : proLabore.valorPago > 0 && proLabore.valorPendente > 0
                ? `${moeda.format(proLabore.valorPago)} pago · ${moeda.format(proLabore.valorPendente)} pendente`
                : proLabore.status === 'pago'
                  ? 'Recebimento liquidado na área financeira.'
                  : 'Lançado na área financeira, ainda sem data de pagamento.'}
        </p>
      </div>

      <div className="caso-honorarios-card">
        <div className="caso-honorarios-head">
          <span className="caso-kpi-label">Créditos comprados</span>
          <button
            type="button"
            className="caso-switch"
            role="switch"
            aria-checked={caso.creditoComprado}
            aria-label="Crédito comprado"
            disabled={salvandoCreditoComprado}
            onClick={() => onCreditoComprado(!caso.creditoComprado)}
          >
            <span className="caso-switch-knob" />
          </button>
        </div>
        <span
          className={`caso-kpi-value caso-kpi-value--num${valorCredito == null ? ' is-empty' : ''}`}
        >
          {valorCredito == null ? '—' : moeda.format(valorCredito)}
        </span>
        <p className="caso-honorarios-hint">
          {caso.creditoComprado
            ? diferencaCredito == null
              ? 'Informe o valor da causa para calcular a diferença além dos honorários.'
              : 'Diferença do valor da causa, além dos honorários de êxito.'
            : 'Marque se o crédito deste caso foi comprado.'}
        </p>
      </div>
    </section>
  )
}
