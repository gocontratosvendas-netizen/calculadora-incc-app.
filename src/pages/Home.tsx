import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react'
import {
  getDashboardSummary,
  getRecentCases,
  type CaseStatus,
  type DashboardSummary,
  type RecentCase,
} from '../lib/dashboard'
import { Link } from '../lib/router'
import { useRouter } from '../lib/router-context'
import { currentUser } from '../lib/session'
import { theme } from '../theme'
import './home.css'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const STATUS_LABEL: Record<CaseStatus, string> = {
  memorial_pronto: 'Memorial pronto',
  em_analise: 'Em análise',
  aguardando_docs: 'Aguardando docs',
  encerrado: 'Encerrado',
}

const EMPTY_SUMMARY: DashboardSummary = {
  excessoTotalCarteira: 0,
  contratosApurados: 0,
  casosAtivos: 0,
  casosEmCalculo: 0,
  valoresRecuperados: 0,
  casosLiquidados: 0,
  casosAguardandoRevisao: 0,
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function formatExcessoTotal(value: number) {
  if (value >= 1_000_000) {
    const abbreviated = (value / 1_000_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `R$ ${abbreviated} mi`
  }
  return formatCurrency(value)
}

function greetingForHour(hour: number) {
  if (hour >= 18) return 'Boa noite'
  if (hour >= 12) return 'Boa tarde'
  return 'Bom dia'
}

function formatContextDate(date: Date) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(date)
    .replace(/\s+de\s+\d{4}$/, '')
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function surnameOf(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  return parts[parts.length - 1] ?? fullName
}

function sortRecentCases(data: RecentCase[]) {
  return [...data]
    .sort((a, b) => new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime())
    .slice(0, 5)
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.25v9.5M2.25 7h9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const colors = theme.badge[status]
  return (
    <span className="home-badge" style={{ background: colors.bg, color: colors.text }}>
      {STATUS_LABEL[status]}
    </span>
  )
}

function PrimaryButton({ to, children }: { to: string; children: string }) {
  return (
    <Link className="home-primary" to={to}>
      <IconPlus />
      {children}
    </Link>
  )
}

export default function Home() {
  const { navigate } = useRouter()
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [cases, setCases] = useState<RecentCase[]>([])
  const [casesLoading, setCasesLoading] = useState(true)
  const [casesError, setCasesError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getDashboardSummary()
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch(() => {
        if (!cancelled) setSummary(EMPTY_SUMMARY)
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getRecentCases()
      .then((data) => {
        if (!cancelled) setCases(sortRecentCases(data))
      })
      .catch(() => {
        if (!cancelled) {
          setCasesError(true)
          setCases([])
        }
      })
      .finally(() => {
        if (!cancelled) setCasesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function retryCases() {
    setCasesLoading(true)
    setCasesError(false)
    getRecentCases()
      .then((data) => setCases(sortRecentCases(data)))
      .catch(() => {
        setCasesError(true)
        setCases([])
      })
      .finally(() => setCasesLoading(false))
  }

  const now = new Date()
  const greeting = `${greetingForHour(now.getHours())}, ${currentUser.firstName}`
  const dateLabel = formatContextDate(now)
  const displaySummary =
    cases.length === 0 && !casesLoading && !casesError ? EMPTY_SUMMARY : summary
  const waiting = displaySummary.casosAguardandoRevisao
  const contextLine =
    waiting === 0
      ? dateLabel
      : waiting === 1
        ? `${dateLabel} · 1 caso aguardando sua revisão`
        : `${dateLabel} · ${waiting} casos aguardando sua revisão`

  const homeVars = {
    '--home-title': theme.title,
    '--home-secondary': theme.secondaryText,
    '--home-button-text': theme.buttonText,
    '--home-button-hover': theme.buttonHover,
    '--home-content-bg': theme.contentBg,
    '--home-card-bg': theme.cardBg,
    '--home-card-border': theme.cardBorder,
    '--home-label': theme.label,
    '--home-tertiary': theme.tertiaryText,
    '--home-links': theme.links,
    '--home-data': theme.dataText,
    '--home-row-divider': theme.rowDivider,
    '--home-head-divider': theme.tableHeaderDivider,
    '--home-error': theme.errorText,
    '--home-skeleton': theme.skeleton,
  } as CSSProperties

  function openCase(id: string) {
    navigate(`/casos/${id}`)
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openCase(id)
    }
  }

  return (
    <div className="home-page" style={homeVars}>
      <header className="home-header">
        <div>
          <h1 className="home-greeting">{greeting}</h1>
          <p className="home-context">{summaryLoading ? dateLabel : contextLine}</p>
        </div>
        <PrimaryButton to="/calculadora">Nova análise</PrimaryButton>
      </header>

      <section className="home-cards" aria-label="Indicadores">
        {summaryLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <article className="home-card">
              <div className="home-card-label">Excesso total da carteira</div>
              <div className="home-card-value">{formatExcessoTotal(displaySummary.excessoTotalCarteira)}</div>
              <div className="home-card-hint">{displaySummary.contratosApurados} contratos apurados</div>
            </article>
            <article className="home-card">
              <div className="home-card-label">Casos ativos</div>
              <div className="home-card-value">{displaySummary.casosAtivos}</div>
              <div className="home-card-hint">{displaySummary.casosEmCalculo} em fase de cálculo</div>
            </article>
            <article className="home-card">
              <div className="home-card-label">Valores recuperados</div>
              <div className="home-card-value">{formatCurrency(displaySummary.valoresRecuperados)}</div>
              <div className="home-card-hint">{displaySummary.casosLiquidados} casos liquidados</div>
            </article>
          </>
        )}
      </section>

      <section aria-label="Casos recentes">
        <div className="home-section-head">
          <h2 className="home-section-title">Casos recentes</h2>
          <Link className="home-section-link" to="/casos">
            Ver todos
          </Link>
        </div>

        <div className="home-table-wrap">
          {casesError ? (
            <div className="home-error">
              <p className="home-error-text">Não foi possível carregar os casos.</p>
              <button type="button" className="home-retry" onClick={retryCases}>
                Tentar novamente
              </button>
            </div>
          ) : casesLoading ? (
            <table className="home-table" role="table">
              <thead className="home-thead" role="rowgroup">
                <tr className="home-tr home-tr--head" role="row">
                  <th scope="col" role="columnheader">
                    Caso
                  </th>
                  <th scope="col" role="columnheader">
                    Contrato
                  </th>
                  <th scope="col" role="columnheader">
                    Excesso
                  </th>
                  <th scope="col" role="columnheader">
                    Situação
                  </th>
                </tr>
              </thead>
              <tbody className="home-tbody" role="rowgroup">
                {Array.from({ length: 5 }, (_, index) => (
                  <tr className="home-tr" role="row" key={index}>
                    <td role="cell">
                      <div className="home-skeleton" style={{ height: 12, width: '78%' }} />
                    </td>
                    <td role="cell">
                      <div className="home-skeleton" style={{ height: 12, width: '64%' }} />
                    </td>
                    <td role="cell">
                      <div className="home-skeleton" style={{ height: 12, width: '52%' }} />
                    </td>
                    <td className="home-td-status" role="cell">
                      <div className="home-skeleton" style={{ height: 18, width: 88, marginLeft: 'auto' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : cases.length === 0 ? (
            <div className="home-empty">
              <p className="home-empty-text">Nenhum caso cadastrado ainda.</p>
              <PrimaryButton to="/calculadora">Nova análise</PrimaryButton>
            </div>
          ) : (
            <table className="home-table" role="table">
              <thead className="home-thead" role="rowgroup">
                <tr className="home-tr home-tr--head" role="row">
                  <th scope="col" role="columnheader">
                    Caso
                  </th>
                  <th scope="col" role="columnheader">
                    Contrato
                  </th>
                  <th scope="col" role="columnheader">
                    Excesso
                  </th>
                  <th scope="col" role="columnheader">
                    Situação
                  </th>
                </tr>
              </thead>
              <tbody className="home-tbody" role="rowgroup">
                {cases.map((item) => (
                  <tr
                    key={item.id}
                    className="home-tr home-tr--body"
                    role="row"
                    tabIndex={0}
                    onClick={() => openCase(item.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, item.id)}
                  >
                    <td className="home-td-case" role="cell">
                      {surnameOf(item.cliente)} · {item.empreendimento}
                    </td>
                    <td className="home-td-contract" role="cell">
                      {formatCurrency(item.valorContrato)}
                    </td>
                    <td
                      className={item.excessoApurado == null ? 'home-td-empty' : 'home-td-excesso'}
                      role="cell"
                    >
                      {item.excessoApurado == null ? '—' : formatCurrency(item.excessoApurado)}
                    </td>
                    <td className="home-td-status" role="cell">
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

function SkeletonCard() {
  return (
    <article className="home-card" aria-hidden="true">
      <div className="home-skeleton" style={{ height: 32, width: '72%' }} />
      <div className="home-skeleton" style={{ height: 22, width: '48%', marginTop: 4 }} />
      <div className="home-skeleton" style={{ height: 11, width: '40%', marginTop: 5 }} />
    </article>
  )
}
