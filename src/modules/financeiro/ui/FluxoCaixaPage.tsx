import { useMemo, useState } from 'react'
import { calcularResumoCaixa } from '../engine/calcularResumoCaixa'
import { derivarStatus } from '../engine/derivarStatus'
import { filtrarPorRegime } from '../engine/filtrarPorRegime'
import { hojeISO } from '../engine/datas'
import type { AtalhoPeriodo, FiltrosFinanceiro } from '../filtros'
import { formatarMoeda } from '../format'
import type { FormLancamentoValues } from '../formState'
import type { Classificacao, Lancamento, LancamentoInput, SortCampo } from '../types'
import { normalizarTexto } from '../data/csv'
import { FormLancamento } from './FormLancamento'
import { ImportCsvModal } from './ImportCsvModal'
import { TabelaLancamentos } from './TabelaLancamentos'
import { exportarLancamentosCsv, exportarLancamentosXlsx } from './exportacao'

const PAGE = 25

type Props = {
  filtros: FiltrosFinanceiro
  lancamentos: Lancamento[]
  classificacoes: Classificacao[]
  tmpIds: Set<string>
  highlightId: string | null
  salvando: boolean
  formKey: number
  formInitial: FormLancamentoValues
  erroBanner: string | null
  liveMessage: string
  onFiltros: (patch: Partial<FiltrosFinanceiro>) => void
  onCriar: (input: LancamentoInput, snapshot: FormLancamentoValues) => void
  onRetry: () => void
  onEditar: (id: string, input: LancamentoInput) => Promise<boolean>
  onLiquidar: (id: string, data: string) => void
  onExcluir: (id: string) => void
  onImportar: (inputs: LancamentoInput[]) => Promise<void>
  onDuplicar: (l: Lancamento) => void
}

export function FluxoCaixaPage({
  filtros,
  lancamentos,
  classificacoes,
  tmpIds,
  highlightId,
  salvando,
  formKey,
  formInitial,
  erroBanner,
  liveMessage,
  onFiltros,
  onCriar,
  onRetry,
  onEditar,
  onLiquidar,
  onExcluir,
  onImportar,
  onDuplicar,
}: Props) {
  const hoje = hojeISO()
  const [importOpen, setImportOpen] = useState(false)
  const [clsOpen, setClsOpen] = useState(false)

  const filtrados = useMemo(() => {
    let lista = filtrarPorRegime(lancamentos, filtros.periodo.inicio, filtros.periodo.fim, filtros.regime)
    if (filtros.movimentacao !== 'todas') {
      lista = lista.filter((l) => l.movimentacao === filtros.movimentacao)
    }
    if (filtros.classificacaoIds.length) {
      lista = lista.filter((l) => filtros.classificacaoIds.includes(l.classificacaoId))
    }
    if (filtros.status !== 'todos') {
      lista = lista.filter((l) => derivarStatus(l, hoje) === filtros.status)
    }
    if (filtros.busca.trim()) {
      const q = normalizarTexto(filtros.busca)
      lista = lista.filter((l) => normalizarTexto(l.historico).includes(q))
    }
    const dir = filtros.dir === 'asc' ? 1 : -1
    lista = [...lista].sort((a, b) => comparar(a, b, filtros.ord, classificacoes) * dir)
    return lista
  }, [lancamentos, filtros, hoje, classificacoes])

  const resumo = calcularResumoCaixa(filtrados, filtros.regime)
  const inicio = (filtros.pagina - 1) * PAGE
  const paginaItens = filtrados.slice(inicio, inicio + PAGE)

  function atalho(id: AtalhoPeriodo) {
    onFiltros({ atalho: id, pagina: 1 })
  }

  return (
    <>
      <div className="fin-kpis" aria-label="Resumo do período">
        <article className="fin-kpi">
          <span className="fin-kpi-label">ENTRADAS</span>
          <span className="fin-kpi-value is-entrada">{formatarMoeda(resumo.entradas)}</span>
        </article>
        <article className="fin-kpi">
          <span className="fin-kpi-label">SAÍDAS</span>
          <span className="fin-kpi-value is-saida">{formatarMoeda(resumo.saidas)}</span>
        </article>
        <article className="fin-kpi">
          <span className="fin-kpi-label">SALDO DO MÊS</span>
          <span className={`fin-kpi-value ${resumo.saldo < 0 ? 'is-saida' : 'is-entrada'}`}>
            {formatarMoeda(resumo.saldo)}
          </span>
        </article>
        <article className="fin-kpi">
          <span className="fin-kpi-label">A RECEBER</span>
          <span className="fin-kpi-value">{formatarMoeda(resumo.aReceber)}</span>
        </article>
        <article className="fin-kpi">
          <span className="fin-kpi-label">A PAGAR</span>
          <span className="fin-kpi-value">{formatarMoeda(resumo.aPagar)}</span>
        </article>
      </div>

      <div aria-live="polite" className="fin-visually-hidden">
        {liveMessage}
      </div>

      <FormLancamento
        key={formKey}
        classificacoes={classificacoes}
        salvando={salvando}
        initial={formInitial}
        erroBanner={erroBanner}
        onSubmit={onCriar}
        onRetry={onRetry}
      />

      <section className="fin-ledger" aria-label="Lançamentos do período">
        <header className="fin-ledger-head">
          <div>
            <h2>Lançamentos</h2>
            <p>
              {filtrados.length === 0
                ? 'Nenhum no recorte atual'
                : `${filtrados.length} ${filtrados.length === 1 ? 'lançamento' : 'lançamentos'} no período`}
            </p>
          </div>
          <div className="fin-ledger-exports">
            <button
              type="button"
              className="fin-btn fin-btn--secondary"
              onClick={() => exportarLancamentosCsv(filtrados, classificacoes)}
            >
              CSV
            </button>
            <button
              type="button"
              className="fin-btn fin-btn--secondary"
              onClick={() => exportarLancamentosXlsx(filtrados, classificacoes)}
            >
              XLSX
            </button>
            <button type="button" className="fin-btn fin-btn--secondary" onClick={() => setImportOpen(true)}>
              Importar
            </button>
          </div>
        </header>

        <div className="fin-ledger-period">
          <span className="fin-ledger-label">Período</span>
          <div className="fin-period-toggle" role="group" aria-label="Atalho de período">
            {(
              [
                ['mes', 'Este mês'],
                ['mes_anterior', 'Mês anterior'],
                ['trimestre', 'Trimestre'],
                ['ano', 'Ano'],
                ['personalizado', 'Personalizado'],
              ] as const
            ).map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                className={filtros.atalho === id ? 'is-active' : ''}
                onClick={() => atalho(id)}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {filtros.atalho === 'personalizado' ? (
            <div className="fin-ledger-dates">
              <input
                type="date"
                className="fin-input"
                aria-label="Início"
                value={filtros.periodo.inicio}
                onChange={(e) =>
                  onFiltros({ periodo: { ...filtros.periodo, inicio: e.target.value }, pagina: 1 })
                }
              />
              <span className="fin-ledger-dates-sep">a</span>
              <input
                type="date"
                className="fin-input"
                aria-label="Fim"
                value={filtros.periodo.fim}
                onChange={(e) =>
                  onFiltros({ periodo: { ...filtros.periodo, fim: e.target.value }, pagina: 1 })
                }
              />
            </div>
          ) : null}
        </div>

        <div className="fin-ledger-filters">
          <label className="fin-ledger-field">
            <span className="fin-ledger-label">Movimentação</span>
            <select
              className="fin-select"
              value={filtros.movimentacao}
              onChange={(e) =>
                onFiltros({
                  movimentacao: e.target.value as FiltrosFinanceiro['movimentacao'],
                  pagina: 1,
                })
              }
            >
              <option value="todas">Todas</option>
              <option value="entrada">Entradas</option>
              <option value="saida">Saídas</option>
            </select>
          </label>

          <div className="fin-ledger-field fin-cls-menu">
            <span className="fin-ledger-label" id="fin-cls-filtro">
              Classificação
            </span>
            <button
              type="button"
              className="fin-select fin-cls-trigger"
              aria-labelledby="fin-cls-filtro"
              aria-expanded={clsOpen}
              onClick={() => setClsOpen((o) => !o)}
            >
              {filtros.classificacaoIds.length
                ? `${filtros.classificacaoIds.length} selecionada${filtros.classificacaoIds.length > 1 ? 's' : ''}`
                : 'Todas'}
            </button>
            {clsOpen ? (
              <div className="fin-cls-dropdown">
                {classificacoes.map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={filtros.classificacaoIds.includes(c.id)}
                      onChange={() => {
                        const set = new Set(filtros.classificacaoIds)
                        if (set.has(c.id)) set.delete(c.id)
                        else set.add(c.id)
                        onFiltros({ classificacaoIds: [...set], pagina: 1 })
                      }}
                    />
                    {c.codigo} {c.nome}
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <label className="fin-ledger-field">
            <span className="fin-ledger-label">Status</span>
            <select
              className="fin-select"
              value={filtros.status}
              onChange={(e) =>
                onFiltros({ status: e.target.value as FiltrosFinanceiro['status'], pagina: 1 })
              }
            >
              <option value="todos">Todos</option>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </label>

          <label className="fin-ledger-field fin-ledger-search">
            <span className="fin-ledger-label">Buscar</span>
            <input
              className="fin-input"
              placeholder="Histórico do lançamento"
              value={filtros.busca}
              onChange={(e) => onFiltros({ busca: e.target.value, pagina: 1 })}
            />
          </label>
        </div>

        <TabelaLancamentos
          lancamentos={paginaItens}
          classificacoes={classificacoes}
          hoje={hoje}
          ord={filtros.ord}
          dir={filtros.dir}
          pagina={filtros.pagina}
          total={filtrados.length}
          pageSize={PAGE}
          highlightId={highlightId}
          tmpIds={tmpIds}
          onSort={(campo) =>
            onFiltros({
              ord: campo,
              dir: filtros.ord === campo && filtros.dir === 'desc' ? 'asc' : 'desc',
            })
          }
          onPagina={(p) => onFiltros({ pagina: p })}
          onSalvarEdicao={onEditar}
          onLiquidar={onLiquidar}
          onDuplicar={onDuplicar}
          onExcluir={(l) => onExcluir(l.id)}
        />
      </section>

      <ImportCsvModal
        open={importOpen}
        classificacoes={classificacoes}
        onClose={() => setImportOpen(false)}
        onConfirmar={async (inputs) => {
          await onImportar(inputs)
          setImportOpen(false)
        }}
      />
    </>
  )
}

function comparar(a: Lancamento, b: Lancamento, campo: SortCampo, classificacoes: Classificacao[]): number {
  switch (campo) {
    case 'emissao':
      return a.dataEmissao.localeCompare(b.dataEmissao)
    case 'movimentacao':
      return a.movimentacao.localeCompare(b.movimentacao)
    case 'historico':
      return a.historico.localeCompare(b.historico)
    case 'classificacao': {
      const na = classificacoes.find((c) => c.id === a.classificacaoId)?.nome ?? ''
      const nb = classificacoes.find((c) => c.id === b.classificacaoId)?.nome ?? ''
      return na.localeCompare(nb)
    }
    case 'valor':
      return a.valor - b.valor
    case 'vencimento':
      return a.vencimento.localeCompare(b.vencimento)
    case 'pagamento':
      return (a.dataPagamento ?? '').localeCompare(b.dataPagamento ?? '')
  }
  return 0
}
