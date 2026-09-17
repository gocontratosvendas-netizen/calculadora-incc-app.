import { useEffect, useMemo, useState } from 'react'
import { obterCaso, type CasoDetalhe as CasoDetalheTipo } from '../lib/casos'
import {
  compararRelatorios,
  montarRelatorioMemoria,
  type RelatorioMemoriaCalculo,
} from '../lib/memoriaCalculo'
import { Link } from '../lib/router'
import { mensagemErroSupabase } from '../lib/supabase'
import './AuditoriaFinanceira.css'

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const numero = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type AbaPrincipal = 'pagamento' | 'vencimento' | 'comparativo'
type AbaDefasagem = 1 | 2

function formatData(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

function formatCelula(value: number) {
  if (value === 0) return '—'
  return numero.format(value)
}

function formatPercent(value: number) {
  if (value === 0) return '—'
  return `${value.toFixed(4).replace('.', ',')}%`
}

function classeDelta(valor: number) {
  if (valor > 0) return 'is-pos'
  if (valor < 0) return 'is-neg'
  return ''
}

function classeExcesso(valor: number) {
  if (valor > 0) return 'is-excesso'
  if (valor < 0) return 'is-neg'
  return ''
}

function IconAudit() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="2.2" width="10" height="11.6" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.4 5.3h5.2M5.4 8h5.2M5.4 10.7h3.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function TabelaAuditoria({
  relatorio,
  rotuloData,
}: {
  relatorio: RelatorioMemoriaCalculo
  rotuloData: string
}) {
  return (
    <div className="audit-table-wrap">
      {relatorio.errosIndice.length > 0 ? (
        <p className="audit-banner" role="alert">
          {relatorio.errosIndice.join(' ')}
        </p>
      ) : null}
      <table className="audit-table">
        <thead>
          <tr>
            <th scope="col">{rotuloData}</th>
            <th scope="col" className="is-num">
              Contratual
            </th>
            <th scope="col" className="is-num">
              Renegociação
            </th>
            <th scope="col" className="is-num">
              Multa
            </th>
            <th scope="col" className="is-num">
              Juros
            </th>
            <th scope="col" className="is-num">
              Descontos
            </th>
            <th scope="col" className="is-num">
              Taxas
            </th>
            <th scope="col" className="is-num">
              Correção
            </th>
            <th scope="col" className="is-num">
              INCC
            </th>
            <th scope="col" className="is-num">
              IGP-M
            </th>
            <th scope="col" className="is-num">
              Juros comp.
            </th>
            <th scope="col" className="is-num">
              Devido
            </th>
            <th scope="col" className="is-num">
              Pago
            </th>
            <th scope="col" className="is-num">
              Excesso
            </th>
          </tr>
        </thead>
        <tbody>
          {relatorio.rows.map((r) => (
            <tr key={r.id}>
              <td>
                <span className="audit-date">{formatData(r.pagamento)}</span>
                {r.janela ? <small className="audit-janela">{r.janela}</small> : null}
              </td>
              <td className="is-num">{formatCelula(r.vc)}</td>
              <td className="is-num">{formatCelula(r.renegociacao)}</td>
              <td className="is-num">{formatCelula(r.multa)}</td>
              <td className="is-num">{formatCelula(r.jurosMora)}</td>
              <td className="is-num">{formatCelula(r.descontos)}</td>
              <td className="is-num">{formatCelula(r.taxasAdicionais)}</td>
              <td className="is-num">{formatCelula(r.correcao)}</td>
              <td className="is-num">
                <span>{formatCelula(r.inccValor)}</span>
                {r.inccPercentual ? <small className="audit-janela">{formatPercent(r.inccPercentual)}</small> : null}
              </td>
              <td className="is-num">
                <span>{formatCelula(r.igpmValor)}</span>
                {r.igpmPercentual ? <small className="audit-janela">{formatPercent(r.igpmPercentual)}</small> : null}
              </td>
              <td className="is-num">{formatCelula(r.jurosCompensatorios)}</td>
              <td className="is-num">{formatCelula(r.devido)}</td>
              <td className="is-num">{formatCelula(r.vp)}</td>
              <td className={`is-num ${classeExcesso(r.excesso)}`}>{formatCelula(r.excesso)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="is-num" />
            <td className="is-num">{formatCelula(relatorio.totalRenegociacao)}</td>
            <td className="is-num">{formatCelula(relatorio.totalMulta)}</td>
            <td className="is-num">{formatCelula(relatorio.totalJurosMora)}</td>
            <td className="is-num">{formatCelula(relatorio.totalDescontos)}</td>
            <td className="is-num">{formatCelula(relatorio.totalTaxasAdicionais)}</td>
            <td className="is-num">{formatCelula(relatorio.totalCorrecao)}</td>
            <td className="is-num">{formatCelula(relatorio.totalIncc)}</td>
            <td className="is-num">{formatCelula(relatorio.totalIgpm)}</td>
            <td className="is-num">{formatCelula(relatorio.totalJurosCompensatorios)}</td>
            <td className="is-num">{formatCelula(relatorio.totalDevido)}</td>
            <td className="is-num">{formatCelula(relatorio.totalPago)}</td>
            <td className={`is-num ${classeExcesso(relatorio.totalExcesso)}`}>
              {formatCelula(relatorio.totalExcesso)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function KpisRelatorio({ relatorio }: { relatorio: RelatorioMemoriaCalculo }) {
  return (
    <section className="audit-kpis" aria-label="Totais da memória">
      <article className="audit-kpi">
        <span>Pago</span>
        <strong>{moeda.format(relatorio.totalPago)}</strong>
      </article>
      <article className="audit-kpi">
        <span>Devido</span>
        <strong>{moeda.format(relatorio.totalDevido)}</strong>
      </article>
      <article className="audit-kpi">
        <span>Correção</span>
        <strong>{moeda.format(relatorio.totalCorrecao)}</strong>
      </article>
      <article className="audit-kpi">
        <span>INCC</span>
        <strong>{moeda.format(relatorio.totalIncc)}</strong>
      </article>
      <article className="audit-kpi">
        <span>IGP-M</span>
        <strong>{moeda.format(relatorio.totalIgpm)}</strong>
      </article>
      <article className="audit-kpi">
        <span>Juros compensatórios</span>
        <strong>{moeda.format(relatorio.totalJurosCompensatorios)}</strong>
      </article>
      <article className="audit-kpi audit-kpi--excesso">
        <span>Excesso</span>
        <strong className={classeExcesso(relatorio.totalExcesso)}>{moeda.format(relatorio.totalExcesso)}</strong>
      </article>
    </section>
  )
}

export default function AuditoriaFinanceira({ id }: { id: string }) {
  const [caso, setCaso] = useState<CasoDetalheTipo | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [erro, setErro] = useState<string | null>(null)
  const [carregadoId, setCarregadoId] = useState(id)
  const [aba, setAba] = useState<AbaPrincipal>('pagamento')
  const [abaDefasagem, setAbaDefasagem] = useState<AbaDefasagem>(1)

  if (id !== carregadoId) {
    setCarregadoId(id)
    setStatus('loading')
    setCaso(null)
    setErro(null)
    setAba('pagamento')
    setAbaDefasagem(1)
  }

  useEffect(() => {
    let cancelado = false
    void obterCaso(id)
      .then((dados) => {
        if (cancelado) return
        setCaso(dados)
        setStatus('ready')
        setCarregadoId(id)
      })
      .catch((error) => {
        if (cancelado) return
        setErro(mensagemErroSupabase(error, 'Não foi possível carregar a auditoria.'))
        setStatus('error')
        setCarregadoId(id)
      })
    return () => {
      cancelado = true
    }
  }, [id])

  const input = caso?.memoriaCalculo ?? null
  const usarVencimento = aba === 'vencimento'

  const relatorioPagamento = useMemo(
    () => (input ? montarRelatorioMemoria(input, { usarDataVencimento: false }) : null),
    [input],
  )
  const relatorioVencimento = useMemo(
    () => (input ? montarRelatorioMemoria(input, { usarDataVencimento: true }) : null),
    [input],
  )
  const relatorioAtual = aba === 'vencimento' ? relatorioVencimento : relatorioPagamento
  const comparativo = useMemo(
    () =>
      relatorioPagamento && relatorioVencimento
        ? compararRelatorios(relatorioPagamento, relatorioVencimento)
        : null,
    [relatorioPagamento, relatorioVencimento],
  )

  const defasagemBase = useMemo(
    () =>
      input
        ? montarRelatorioMemoria(input, { usarDataVencimento: usarVencimento, defasagemMeses: 0 })
        : null,
    [input, usarVencimento],
  )
  const defasagem1 = useMemo(
    () =>
      input
        ? montarRelatorioMemoria(input, { usarDataVencimento: usarVencimento, defasagemMeses: 1 })
        : null,
    [input, usarVencimento],
  )
  const defasagem2 = useMemo(
    () =>
      input
        ? montarRelatorioMemoria(input, { usarDataVencimento: usarVencimento, defasagemMeses: 2 })
        : null,
    [input, usarVencimento],
  )
  const relatorioDefasagem = abaDefasagem === 1 ? defasagem1 : defasagem2

  if (status === 'loading') {
    return (
      <div className="audit-page">
        <p className="audit-msg">Carregando auditoria financeira…</p>
      </div>
    )
  }

  if (status === 'error' || !caso) {
    return (
      <div className="audit-page">
        <p className="audit-msg audit-msg--error">{erro ?? 'Caso não encontrado.'}</p>
        <Link to="/casos">Voltar aos casos</Link>
      </div>
    )
  }

  return (
    <div className="audit-page">
      <nav className="audit-crumb" aria-label="Migalha">
        <Link to="/casos">Casos</Link>
        <span aria-hidden="true"> · </span>
        <Link to={`/casos/${caso.id}`}>{caso.cliente.nome}</Link>
        <span aria-hidden="true"> · </span>
        <span>Auditoria financeira</span>
      </nav>

      <header className="audit-header">
        <div>
          <p className="audit-kicker">
            <IconAudit />
            Auditoria financeira
          </p>
          <h1>{caso.cliente.nome}</h1>
          <p className="audit-sub">
            {caso.empreendimento} · {caso.incorporadora}
            {input
              ? ` · aniversário ${formatData(input.dataAniversario || relatorioPagamento?.periodoInicio || '')}`
              : null}
            {input?.dataHabiteSe ? ` · Habite-se ${formatData(input.dataHabiteSe)}` : null}
          </p>
        </div>
        <Link to={`/casos/${caso.id}`} className="audit-back">
          Voltar ao caso
        </Link>
      </header>

      {!input || !relatorioAtual ? (
        <section className="audit-empty">
          <h2>Memória ainda não gerada</h2>
          <p>
            Esta tela é preenchida automaticamente quando o caso é cadastrado pela calculadora.
            Recalcule o extrato e cadastre o cliente de novo para auditar as colunas de correção,
            INCC, IGP-M e juros.
          </p>
          <Link to="/calculadora" className="audit-back audit-back--solid">
            Abrir calculadora
          </Link>
        </section>
      ) : (
        <>
          <div className="audit-tabs" role="tablist" aria-label="Cenário da memória">
            {(
              [
                ['pagamento', 'Data de pagamento'],
                ['vencimento', 'Data de vencimento'],
                ['comparativo', 'Comparativo'],
              ] as const
            ).map(([idAba, rotulo]) => (
              <button
                key={idAba}
                type="button"
                role="tab"
                aria-selected={aba === idAba}
                className={aba === idAba ? 'is-active' : undefined}
                onClick={() => setAba(idAba)}
              >
                {rotulo}
              </button>
            ))}
          </div>

          {aba !== 'comparativo' && relatorioAtual ? (
            <>
              {aba === 'vencimento' && !relatorioAtual.temVencimentos ? (
                <p className="audit-banner">
                  Este caso não tem datas de vencimento preenchidas. A memória abaixo usa a data de
                  pagamento como referência.
                </p>
              ) : null}
              <KpisRelatorio relatorio={relatorioAtual} />
              <section className="audit-card">
                <div className="audit-card-bar">
                  <h2>
                    Memória completa · {aba === 'vencimento' ? 'data de vencimento' : 'data de pagamento'}
                  </h2>
                  <p>
                    Colunas de correção, juros, INCC, IGP-M e juros compensatórios para conferência
                    lançamento a lançamento.
                  </p>
                </div>
                <TabelaAuditoria
                  relatorio={relatorioAtual}
                  rotuloData={aba === 'vencimento' ? 'Vencimento' : 'Pagamento'}
                />
              </section>
            </>
          ) : null}

          {aba === 'comparativo' && comparativo && relatorioPagamento && relatorioVencimento ? (
            <>
              <section className="audit-compare-kpis" aria-label="Comparativo de totais">
                {[
                  {
                    label: 'Devido',
                    pagamento: comparativo.totalDevidoPagamento,
                    vencimento: comparativo.totalDevidoVencimento,
                    delta: comparativo.deltaDevido,
                  },
                  {
                    label: 'Correção',
                    pagamento: comparativo.totalCorrecaoPagamento,
                    vencimento: comparativo.totalCorrecaoVencimento,
                    delta: relatorioVencimento.totalCorrecao - relatorioPagamento.totalCorrecao,
                  },
                  {
                    label: 'Juros comp.',
                    pagamento: comparativo.totalJurosPagamento,
                    vencimento: comparativo.totalJurosVencimento,
                    delta:
                      relatorioVencimento.totalJurosCompensatorios -
                      relatorioPagamento.totalJurosCompensatorios,
                  },
                  {
                    label: 'Excesso',
                    pagamento: comparativo.totalExcessoPagamento,
                    vencimento: comparativo.totalExcessoVencimento,
                    delta: comparativo.deltaExcesso,
                  },
                ].map((item) => (
                  <article key={item.label} className="audit-compare-card">
                    <h3>{item.label}</h3>
                    <dl>
                      <div>
                        <dt>Pagamento</dt>
                        <dd>{moeda.format(item.pagamento)}</dd>
                      </div>
                      <div>
                        <dt>Vencimento</dt>
                        <dd>{moeda.format(item.vencimento)}</dd>
                      </div>
                      <div>
                        <dt>Diferença</dt>
                        <dd className={classeDelta(item.delta)}>{moeda.format(item.delta)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </section>

              <section className="audit-card">
                <div className="audit-card-bar">
                  <h2>Lado a lado por parcela</h2>
                  <p>
                    A diferença é vencimento menos pagamento. Destaque nas linhas em que os dois
                    cenários não coincidem.
                  </p>
                </div>
                <div className="audit-table-wrap">
                  <table className="audit-table audit-table--compare">
                    <thead>
                      <tr>
                        <th scope="col">Pagamento</th>
                        <th scope="col">Vencimento</th>
                        <th scope="col" className="is-num">
                          Contratual
                        </th>
                        <th scope="col" className="is-num">
                          Devido pagto
                        </th>
                        <th scope="col" className="is-num">
                          Devido venc.
                        </th>
                        <th scope="col" className="is-num">
                          Δ Devido
                        </th>
                        <th scope="col" className="is-num">
                          Excesso pagto
                        </th>
                        <th scope="col" className="is-num">
                          Excesso venc.
                        </th>
                        <th scope="col" className="is-num">
                          Δ Excesso
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparativo.rows.map((r) => (
                        <tr key={r.id} className={r.deltaDevido !== 0 || r.deltaExcesso !== 0 ? 'is-diff' : undefined}>
                          <td>{formatData(r.dataPagamento)}</td>
                          <td>{formatData(r.dataVencimento)}</td>
                          <td className="is-num">{formatCelula(r.vc)}</td>
                          <td className="is-num">{formatCelula(r.devidoPagamento)}</td>
                          <td className="is-num">{formatCelula(r.devidoVencimento)}</td>
                          <td className={`is-num ${classeDelta(r.deltaDevido)}`}>
                            {formatCelula(r.deltaDevido)}
                          </td>
                          <td className={`is-num ${classeExcesso(r.excessoPagamento)}`}>
                            {formatCelula(r.excessoPagamento)}
                          </td>
                          <td className={`is-num ${classeExcesso(r.excessoVencimento)}`}>
                            {formatCelula(r.excessoVencimento)}
                          </td>
                          <td className={`is-num ${classeDelta(r.deltaExcesso)}`}>
                            {formatCelula(r.deltaExcesso)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3}>Total</td>
                        <td className="is-num">{formatCelula(comparativo.totalDevidoPagamento)}</td>
                        <td className="is-num">{formatCelula(comparativo.totalDevidoVencimento)}</td>
                        <td className={`is-num ${classeDelta(comparativo.deltaDevido)}`}>
                          {formatCelula(comparativo.deltaDevido)}
                        </td>
                        <td className={`is-num ${classeExcesso(comparativo.totalExcessoPagamento)}`}>
                          {formatCelula(comparativo.totalExcessoPagamento)}
                        </td>
                        <td className={`is-num ${classeExcesso(comparativo.totalExcessoVencimento)}`}>
                          {formatCelula(comparativo.totalExcessoVencimento)}
                        </td>
                        <td className={`is-num ${classeDelta(comparativo.deltaExcesso)}`}>
                          {formatCelula(comparativo.deltaExcesso)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            </>
          ) : null}

          {defasagem1 && defasagem2 && defasagemBase && relatorioDefasagem ? (
            <section className="audit-card audit-defasagem">
              <div className="audit-card-bar">
                <h2>Cenários de defasagem do índice</h2>
                <p>
                  Recuo de 1 e 2 meses na janela do índice, sem mudar os aniversários. Comparado com
                  a memória sem defasagem, no mesmo critério de data (
                  {aba === 'vencimento' ? 'vencimento' : 'pagamento'}).
                </p>
              </div>

              <div className="audit-defasagem-grid">
                <article className={abaDefasagem === 1 ? 'is-selected' : undefined}>
                  <button type="button" onClick={() => setAbaDefasagem(1)}>
                    <span>1 mês de defasagem</span>
                    <strong>{moeda.format(defasagem1.totalExcesso)}</strong>
                    <small>
                      Índice-base {defasagem1.indiceBaseLabel ?? '—'} · Δ excesso{' '}
                      {moeda.format(defasagem1.totalExcesso - defasagemBase.totalExcesso)}
                    </small>
                  </button>
                </article>
                <article className={abaDefasagem === 2 ? 'is-selected' : undefined}>
                  <button type="button" onClick={() => setAbaDefasagem(2)}>
                    <span>2 meses de defasagem</span>
                    <strong>{moeda.format(defasagem2.totalExcesso)}</strong>
                    <small>
                      Índice-base {defasagem2.indiceBaseLabel ?? '—'} · Δ excesso{' '}
                      {moeda.format(defasagem2.totalExcesso - defasagemBase.totalExcesso)}
                    </small>
                  </button>
                </article>
              </div>

              <KpisRelatorio relatorio={relatorioDefasagem} />
              <TabelaAuditoria
                relatorio={relatorioDefasagem}
                rotuloData={aba === 'vencimento' ? 'Vencimento' : 'Pagamento'}
              />
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
