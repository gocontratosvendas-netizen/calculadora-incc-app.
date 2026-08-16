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

      <div className="fin-filters">
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
            className={`fin-chip ${filtros.atalho === id ? 'is-active' : ''}`}
            onClick={() => atalho(id)}
          >
            {rotulo}
          </button>
        ))}
        {filtros.atalho === 'personalizado' ? (
          <>
            <input
              type="date"
              className="fin-input"
              value={filtros.periodo.inicio}
              onChange={(e) =>
                onFiltros({ periodo: { ...filtros.periodo, inicio: e.target.value }, pagina: 1 })
              }
            />
            <input
              type="date"
              className="fin-input"
              value={filtros.periodo.fim}
              onChange={(e) =>
                onFiltros({ periodo: { ...filtros.periodo, fim: e.target.value }, pagina: 1 })
              }
            />
          </>
        ) : null}
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
        <div className="fin-cls-menu">
          <button type="button" className="fin-chip" onClick={() => setClsOpen((o) => !o)}>
            Classificação
            {filtros.classificacaoIds.length ? ` (${filtros.classificacaoIds.length})` : ''}
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
        <select
          className="fin-select"
          value={filtros.status}
          onChange={(e) =>
            onFiltros({ status: e.target.value as FiltrosFinanceiro['status'], pagina: 1 })
          }
        >
          <option value="todos">Todos os status</option>
          <option value="pago">Pago</option>
          <option value="pendente">Pendente</option>
          <option value="atrasado">Atrasado</option>
        </select>
        <input
          className="fin-input"
          placeholder="Buscar histórico"
          value={filtros.busca}
          onChange={(e) => onFiltros({ busca: e.target.value, pagina: 1 })}
        />
        <button type="button" className="fin-btn fin-btn--secondary" onClick={() => exportarLancamentosCsv(filtrados, classificacoes)}>
          CSV
        </button>
        <button type="button" className="fin-btn fin-btn--secondary" onClick={() => exportarLancamentosXlsx(filtrados, classificacoes)}>
          XLSX
        </button>
        <button type="button" className="fin-btn fin-btn--secondary" onClick={() => setImportOpen(true)}>
          Importar
        </button>
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
