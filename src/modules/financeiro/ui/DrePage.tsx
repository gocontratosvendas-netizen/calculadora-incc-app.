import { useMemo, useState } from 'react'
import { calcularDRE } from '../engine/calcularDRE'
import { calcularPeriodoAnterior } from '../engine/calcularPeriodoAnterior'
import { filtrarPorRegime } from '../engine/filtrarPorRegime'
import { margem, montarLinhasDRE } from '../engine/montarLinhasDRE'
import type { AtalhoPeriodo, FiltrosFinanceiro } from '../filtros'
import { formatarDataLonga, formatarMoeda, formatarMoedaContabil, formatarPercentual, formatarVariacao, rotuloRegime } from '../format'
import type { Classificacao, Lancamento, LinhaDRE } from '../types'
import { exportarDrePdf, exportarDreXlsx } from './exportacao'

type Props = {
  filtros: FiltrosFinanceiro
  lancamentos: Lancamento[]
  classificacoes: Classificacao[]
  onFiltros: (patch: Partial<FiltrosFinanceiro>) => void
}

function tomVariacao(linha: Pick<LinhaDRE, 'valor' | 'valorAnterior' | 'sentido' | 'variacao'>): 'melhora' | 'piora' | '' {
  if (linha.variacao === null || linha.valor === linha.valorAnterior) return ''
  const subiu = linha.valor > linha.valorAnterior
  if (linha.sentido === 'despesa') return subiu ? 'piora' : 'melhora'
  return subiu ? 'melhora' : 'piora'
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
    { rotulo: 'Receita bruta', valor: atualDre.receitaBruta, anterior: anteriorDre.receitaBruta, sentido: 'resultado' as const },
    { rotulo: 'Lucro bruto', valor: atualDre.lucroBruto, anterior: anteriorDre.lucroBruto, sentido: 'resultado' as const },
    { rotulo: 'EBITDA', valor: atualDre.ebitda, anterior: anteriorDre.ebitda, sentido: 'resultado' as const },
    { rotulo: 'Lucro líquido', valor: atualDre.lucroLiquido, anterior: anteriorDre.lucroLiquido, sentido: 'resultado' as const, margem: true },
  ]

  return (
    <>
      <p className="fin-header-sub">
        {rotuloRegime(regime)} · {formatarDataLonga(periodo.inicio)} a {formatarDataLonga(periodo.fim)}
      </p>
      <div className="fin-filters" style={{ marginTop: 10 }}>
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

      <div className="fin-kpis fin-kpis--4" style={{ marginTop: 12 }}>
        {cards.map((card) => {
          const varicao = card.anterior === 0 ? null : (card.valor - card.anterior) / Math.abs(card.anterior)
          const tom = tomVariacao({
            valor: card.valor,
            valorAnterior: card.anterior,
            sentido: card.sentido,
            variacao: varicao,
          })
          return (
            <article key={card.rotulo} className="fin-kpi">
              <span className="fin-kpi-label">{card.rotulo.toUpperCase()}</span>
              <span className="fin-kpi-value">{formatarMoeda(card.valor)}</span>
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

      <div className="fin-header-actions" style={{ marginBottom: 10 }}>
        <button type="button" className="fin-btn fin-btn--secondary" onClick={() => exportarDrePdf(linhas, periodo, regime)}>
          PDF
        </button>
        <button type="button" className="fin-btn fin-btn--secondary" onClick={() => exportarDreXlsx(linhas, periodo)}>
          XLSX
        </button>
      </div>

      <div className="fin-scroll">
        <table className="fin-dre">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Período (R$)</th>
              <th>AV</th>
              <th>Período anterior (R$)</th>
              <th>Var</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const tom = tomVariacao(linha)
              return (
                <tr
                  key={linha.chave}
                  className={`nivel-${linha.nivel} ${linha.destaque ? 'is-destaque' : ''}`}
                  onClick={() => {
                    if (linha.nivel === 'detalhe') setDetalhe(linha)
                  }}
                >
                  <td>{linha.rotulo}</td>
                  <td>{formatarMoedaContabil(linha.valor)}</td>
                  <td>{formatarPercentual(linha.analiseVertical)}</td>
                  <td>{formatarMoedaContabil(linha.valorAnterior)}</td>
                  <td className={tom ? `is-${tom}` : undefined}>{formatarVariacao(linha.variacao)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {detalhe ? (
        <div className="fin-backdrop" onClick={() => setDetalhe(null)}>
          <aside className="fin-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>{detalhe.rotulo}</h2>
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
            <button type="button" className="fin-btn fin-btn--secondary" style={{ marginTop: 16 }} onClick={() => setDetalhe(null)}>
              Fechar
            </button>
          </aside>
        </div>
      ) : null}
    </>
  )
}
