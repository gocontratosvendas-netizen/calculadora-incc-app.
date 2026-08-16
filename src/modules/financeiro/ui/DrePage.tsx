import { useMemo, useState } from 'react'
import { calcularDRE } from '../engine/calcularDRE'
import { calcularPeriodoAnterior } from '../engine/calcularPeriodoAnterior'
import { isAnoCivil, isMesCivil, isTrimestreCivil, partesData } from '../engine/datas'
import { filtrarPorRegime } from '../engine/filtrarPorRegime'
import { margem, montarLinhasDRE } from '../engine/montarLinhasDRE'
import type { AtalhoPeriodo, FiltrosFinanceiro } from '../filtros'
import {
  formatarDataLonga,
  formatarMoeda,
  formatarMoedaContabil,
  formatarPercentual,
  formatarVariacao,
  rotuloRegime,
} from '../format'
import type { Classificacao, Lancamento, LinhaDRE, Periodo } from '../types'
import { exportarDrePdf, exportarDreXlsx } from './exportacao'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

type Props = {
  filtros: FiltrosFinanceiro
  lancamentos: Lancamento[]
  classificacoes: Classificacao[]
  onFiltros: (patch: Partial<FiltrosFinanceiro>) => void
}

function tomVariacao(
  linha: Pick<LinhaDRE, 'valor' | 'valorAnterior' | 'sentido' | 'variacao'>,
): 'melhora' | 'piora' | '' {
  if (linha.variacao === null || linha.valor === linha.valorAnterior) return ''
  const subiu = linha.valor > linha.valorAnterior
  if (linha.sentido === 'despesa') return subiu ? 'piora' : 'melhora'
  return subiu ? 'melhora' : 'piora'
}

function rotuloPeriodoColuna(periodo: Periodo): string {
  const { y, m } = partesData(periodo.inicio)
  if (isMesCivil(periodo)) return `${MESES[m - 1]}/${y}`
  if (isTrimestreCivil(periodo)) return `${Math.ceil(m / 3)}º tri/${y}`
  if (isAnoCivil(periodo)) return String(y)
  return `${formatarDataLonga(periodo.inicio)} – ${formatarDataLonga(periodo.fim)}`
}

function classeNumero(valor: number, sentido: LinhaDRE['sentido']): string {
  const partes = ['fin-dre-num']
  if (valor === 0) partes.push('is-zero')
  else if (valor < 0) partes.push('is-neg')
  else if (sentido === 'despesa') partes.push('is-despesa')
  else partes.push('is-resultado')
  return partes.join(' ')
}

export function DrePage({ filtros, lancamentos, classificacoes, onFiltros }: Props) {
  const { regime, periodo } = filtros
  const anterior = useMemo(() => calcularPeriodoAnterior(periodo), [periodo])
  const atualDre = useMemo(
    () => calcularDRE(lancamentos, classificacoes, periodo, regime),
    [lancamentos, classificacoes, periodo, regime],
  )
  const anteriorDre = useMemo(
    () => calcularDRE(lancamentos, classificacoes, anterior, regime),
    [lancamentos, classificacoes, anterior, regime],
  )
  const linhas = useMemo(
    () => montarLinhasDRE(atualDre, anteriorDre, classificacoes),
    [atualDre, anteriorDre, classificacoes],
  )

  const [detalhe, setDetalhe] = useState<LinhaDRE | null>(null)
  const colAtual = rotuloPeriodoColuna(periodo)
  const colAnterior = rotuloPeriodoColuna(anterior)

  const lancamentosDetalhe = useMemo(() => {
    if (!detalhe) return []
    const filtrados = filtrarPorRegime(lancamentos, periodo.inicio, periodo.fim, regime)
    if (detalhe.classificacaoId) {
      return filtrados.filter((l) => l.classificacaoId === detalhe.classificacaoId)
    }
    if (detalhe.grupoDRE) {
      const ids = new Set(classificacoes.filter((c) => c.grupoDRE === detalhe.grupoDRE).map((c) => c.id))
      return filtrados.filter((l) => ids.has(l.classificacaoId))
    }
    return []
  }, [detalhe, lancamentos, periodo, regime, classificacoes])

  const cards = [
    {
      rotulo: 'Receita bruta',
      valor: atualDre.receitaBruta,
      anterior: anteriorDre.receitaBruta,
      sentido: 'resultado' as const,
    },
    {
      rotulo: 'Lucro bruto',
      valor: atualDre.lucroBruto,
      anterior: anteriorDre.lucroBruto,
      sentido: 'resultado' as const,
    },
    {
      rotulo: 'EBITDA',
      valor: atualDre.ebitda,
      anterior: anteriorDre.ebitda,
      sentido: 'resultado' as const,
    },
    {
      rotulo: 'Lucro líquido',
      valor: atualDre.lucroLiquido,
      anterior: anteriorDre.lucroLiquido,
      sentido: 'resultado' as const,
      destaque: true,
      margem: true,
    },
  ]

  return (
    <div className="fin-dre-page">
      <div className="fin-dre-toolbar">
        <div className="fin-dre-periodo">
          <span className="fin-dre-periodo-regime">{rotuloRegime(regime)}</span>
          <strong>
            {formatarDataLonga(periodo.inicio)} a {formatarDataLonga(periodo.fim)}
          </strong>
        </div>
        <div className="fin-filters" style={{ margin: 0 }}>
          {(
            [
              ['mes', 'Mês'],
              ['trimestre', 'Trimestre'],
              ['ano', 'Ano'],
            ] as [AtalhoPeriodo, string][]
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              className={`fin-chip ${filtros.atalho === id ? 'is-active' : ''}`}
              onClick={() => onFiltros({ atalho: id, pagina: 1 })}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="fin-dre-kpis">
        {cards.map((card) => {
          const varicao = card.anterior === 0 ? null : (card.valor - card.anterior) / Math.abs(card.anterior)
          const tom = tomVariacao({
            valor: card.valor,
            valorAnterior: card.anterior,
            sentido: card.sentido,
            variacao: varicao,
          })
          const valorClass =
            card.valor < 0 ? 'is-neg' : card.valor === 0 ? 'is-zero' : card.destaque ? 'is-destaque' : ''
          return (
            <article key={card.rotulo} className={`fin-dre-kpi ${card.destaque ? 'is-destaque' : ''}`}>
              <span className="fin-kpi-label">{card.rotulo}</span>
              <span className={`fin-dre-kpi-value ${valorClass}`}>{formatarMoeda(card.valor)}</span>
              {card.margem ? (
                <span className="fin-kpi-delta">
                  Margem líquida {formatarPercentual(margem(atualDre.lucroLiquido, atualDre.receitaBruta))}
                </span>
              ) : (
                <span className={`fin-kpi-delta ${tom ? `is-${tom}` : ''}`}>{formatarVariacao(varicao)}</span>
              )}
            </article>
          )
        })}
      </div>

      <section className="fin-dre-card" aria-label="Demonstração de resultado">
        <header className="fin-dre-card-head">
          <div>
            <h2>Demonstração de resultado</h2>
            <p>AV sobre a receita bruta. Clique numa conta para ver os lançamentos.</p>
          </div>
          <div className="fin-header-actions">
            <button
              type="button"
              className="fin-btn fin-btn--secondary"
              onClick={() => exportarDrePdf(linhas, periodo, regime)}
            >
              PDF
            </button>
            <button type="button" className="fin-btn fin-btn--secondary" onClick={() => exportarDreXlsx(linhas, periodo)}>
              XLSX
            </button>
          </div>
        </header>

        <div className="fin-scroll">
          <table className="fin-dre">
            <colgroup>
              <col className="fin-dre-col-desc" />
              <col className="fin-dre-col-now" />
              <col className="fin-dre-col-av" />
              <col className="fin-dre-col-prev" />
              <col className="fin-dre-col-var" />
            </colgroup>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>
                  {colAtual}
                  <small>R$</small>
                </th>
                <th>
                  AV
                  <small>%</small>
                </th>
                <th>
                  {colAnterior}
                  <small>anterior</small>
                </th>
                <th>
                  Var
                  <small>%</small>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => {
                const tom = tomVariacao(linha)
                const avPct = Math.min(100, Math.abs(linha.analiseVertical) * 100)
                return (
                  <tr
                    key={linha.chave}
                    className={`nivel-${linha.nivel} ${linha.destaque ? 'is-destaque' : ''} ${linha.sentido === 'despesa' ? 'is-despesa' : ''}`}
                    onClick={() => {
                      if (linha.nivel === 'detalhe') setDetalhe(linha)
                    }}
                  >
                    <td>{linha.rotulo}</td>
                    <td className={classeNumero(linha.valor, linha.sentido)}>
                      {formatarMoedaContabil(linha.valor)}
                    </td>
                    <td className="fin-dre-av">
                      <span>{formatarPercentual(linha.analiseVertical)}</span>
                      <span className="fin-dre-av-track" aria-hidden="true">
                        <i style={{ width: `${avPct}%` }} />
                      </span>
                    </td>
                    <td className={`fin-dre-prev ${linha.valorAnterior === 0 ? 'is-zero' : ''}`}>
                      {formatarMoedaContabil(linha.valorAnterior)}
                    </td>
                    <td className={`fin-dre-var ${tom ? `is-${tom}` : ''} ${linha.variacao === null ? 'is-zero' : ''}`}>
                      {formatarVariacao(linha.variacao)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {detalhe ? (
        <div className="fin-backdrop" onClick={() => setDetalhe(null)}>
          <aside className="fin-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="fin-panel-title">{detalhe.rotulo}</h2>
            <p className="fin-header-sub">Lançamentos que compõem esta linha no período.</p>
            {lancamentosDetalhe.length === 0 ? (
              <p className="fin-empty">Nenhum lançamento nesta linha.</p>
            ) : (
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Emissão</th>
                    <th>Histórico</th>
                    <th className="is-num">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentosDetalhe.map((l) => (
                    <tr key={l.id}>
                      <td>{formatarDataLonga(l.dataEmissao)}</td>
                      <td>{l.historico}</td>
                      <td className="is-num">{formatarMoedaContabil(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button
              type="button"
              className="fin-btn fin-btn--secondary"
              style={{ marginTop: 16 }}
              onClick={() => setDetalhe(null)}
            >
              Fechar
            </button>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
