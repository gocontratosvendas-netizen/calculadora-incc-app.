import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '../../../lib/router-context'
import { loadCurrentUser } from '../../../lib/session'
import { verificarAcessoFinanceiro } from '../acesso'
import {
  criarLancamento,
  editarLancamento,
  excluirLancamento,
  listarClassificacoes,
  listarLancamentos,
  liquidarLancamento,
} from '../data/repositorio'
import { formInicial, valuesFromLancamento, type FormLancamentoValues } from '../formState'
import { planoContasSeed } from '../engine/planoContas'
import { periodoDeAtalho, parseFiltros, pathFinanceiro, type FiltrosFinanceiro } from '../filtros'
import type { Classificacao, ClienteLancamentoOpcao, Lancamento, LancamentoInput, Regime } from '../types'
import { DrePage } from './DrePage'
import { FinanceiroErrorBoundary } from './ErrorBoundary'
import { FluxoCaixaPage } from './FluxoCaixaPage'
import './financeiro.css'

export function FinanceiroApp({
  carregarClientes,
}: {
  carregarClientes?: () => Promise<ClienteLancamentoOpcao[]>
}) {
  return (
    <FinanceiroErrorBoundary>
      <FinanceiroInner carregarClientes={carregarClientes} />
    </FinanceiroErrorBoundary>
  )
}

function FinanceiroInner({
  carregarClientes,
}: {
  carregarClientes?: () => Promise<ClienteLancamentoOpcao[]>
}) {
  const { pathname, search, navigate } = useRouter()
  const [acesso, setAcesso] = useState<boolean | null>(null)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [classificacoes, setClassificacoes] = useState<Classificacao[]>(() => planoContasSeed())
  const [clientes, setClientes] = useState<ClienteLancamentoOpcao[]>([])
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [tmpIds, setTmpIds] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)
  const [erroBanner, setErroBanner] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [formInitial, setFormInitial] = useState(() => formInicial())
  const [liveMessage, setLiveMessage] = useState('')
  const pendenteRef = useRef<{ input: LancamentoInput; snapshot: FormLancamentoValues } | null>(null)
  const vooRef = useRef(false)

  const filtros = useMemo(() => parseFiltros(search, pathname), [search, pathname])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [okRpc, user] = await Promise.all([
        verificarAcessoFinanceiro(),
        loadCurrentUser().catch(() => null),
      ])
      if (cancelled) return
      const ok = okRpc || user?.papel === 'socio'
      if (cancelled) return
      setAcesso(ok)
      if (!ok) return
      const [ls, cs, cl] = await Promise.all([
        listarLancamentos().catch(() => [] as Lancamento[]),
        listarClassificacoes().catch(() => planoContasSeed()),
        carregarClientes?.().catch(() => [] as ClienteLancamentoOpcao[]) ?? Promise.resolve([]),
      ])
      if (cancelled) return
      setLancamentos(ls)
      setClassificacoes(cs)
      setClientes(cl)
    })()
    return () => {
      cancelled = true
    }
  }, [carregarClientes])

  function aplicar(patch: Partial<FiltrosFinanceiro>) {
    const next: FiltrosFinanceiro = { ...filtros, ...patch }
    if (patch.atalho && patch.atalho !== 'personalizado' && !patch.periodo) {
      next.periodo = periodoDeAtalho(next.atalho, next.periodo)
    }
    navigate(pathFinanceiro(next), { replace: true })
  }

  function setAba(aba: 'dre' | 'fluxo') {
    aplicar({ aba })
  }

  function setRegime(regime: Regime) {
    aplicar({ regime })
  }

  async function persistir(input: LancamentoInput, snapshot: FormLancamentoValues) {
    if (vooRef.current) return
    vooRef.current = true
    setSalvando(true)
    setErroBanner(null)
    pendenteRef.current = { input, snapshot }
    const tmpId = `tmp-${crypto.randomUUID()}`
    const tmp: Lancamento = {
      id: tmpId,
      dataEmissao: input.dataEmissao,
      movimentacao: input.movimentacao,
      historico: input.historico,
      classificacaoId: input.classificacaoId,
      valor: input.valor,
      vencimento: input.vencimento,
      dataPagamento: input.dataPagamento,
      casoId: input.casoId,
      observacao: input.observacao,
      deletadoEm: null,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    }
    setLancamentos((atual) => [tmp, ...atual])
    setTmpIds((s) => new Set(s).add(tmpId))

    const result = await criarLancamento(input)
    vooRef.current = false
    setSalvando(false)

    if (result.ok) {
      setLancamentos((atual) => atual.map((l) => (l.id === tmpId ? result.data : l)))
      setTmpIds((s) => {
        const n = new Set(s)
        n.delete(tmpId)
        return n
      })
      setHighlightId(result.data.id)
      window.setTimeout(() => setHighlightId(null), 1500)
      setFormInitial({
        ...snapshot,
        historico: '',
        valorTexto: '',
        dataPagamento: '',
      })
      setFormKey((n) => n + 1)
      setLiveMessage('Lançamento adicionado')
      return
    }

    setLancamentos((atual) => atual.filter((l) => l.id !== tmpId))
    setTmpIds((s) => {
      const n = new Set(s)
      n.delete(tmpId)
      return n
    })
    setErroBanner(result.message ?? 'Não foi possível salvar o lançamento. Tente novamente.')
  }

  if (acesso === false) {
    return (
      <div className="fin-page">
        <div className="fin-403">
          <h1>Acesso restrito</h1>
          <div className="fin-header-rule" />
          <p className="fin-header-sub">
            Esta seção é visível apenas para sócios e para o papel financeiro.
          </p>
        </div>
      </div>
    )
  }

  if (acesso === null) {
    return <div className="fin-page" />
  }

  const aba = pathname.includes('/fluxo') ? 'fluxo' : 'dre'

  return (
    <div className="fin-page">
      <header className="fin-header">
        <div>
          <h1>Financeiro</h1>
          <div className="fin-header-rule" />
          <p className="fin-header-sub">
            A DRE é derivada dos lançamentos. Não há digitação paralela de resultado.
          </p>
        </div>
        <div className="fin-header-actions">
          <div className="fin-regime" role="group" aria-label="Regime">
            <button
              type="button"
              className={filtros.regime === 'competencia' ? 'is-active' : ''}
              onClick={() => setRegime('competencia')}
            >
              Competência
            </button>
            <button
              type="button"
              className={filtros.regime === 'caixa' ? 'is-active' : ''}
              onClick={() => setRegime('caixa')}
            >
              Caixa
            </button>
          </div>
        </div>
      </header>

      <div className="fin-tabs">
        <button type="button" className={`fin-tab ${aba === 'dre' ? 'is-active' : ''}`} onClick={() => setAba('dre')}>
          DRE
        </button>
        <button type="button" className={`fin-tab ${aba === 'fluxo' ? 'is-active' : ''}`} onClick={() => setAba('fluxo')}>
          Fluxo de caixa
        </button>
      </div>

      {aba === 'dre' ? (
        <DrePage
          filtros={filtros}
          lancamentos={lancamentos}
          classificacoes={classificacoes}
          onFiltros={aplicar}
        />
      ) : (
        <FluxoCaixaPage
          filtros={filtros}
          lancamentos={lancamentos}
          classificacoes={classificacoes}
          clientes={clientes}
          tmpIds={tmpIds}
          highlightId={highlightId}
          salvando={salvando}
          formKey={formKey}
          formInitial={formInitial}
          erroBanner={erroBanner}
          liveMessage={liveMessage}
          onFiltros={aplicar}
          onCriar={(input, snapshot) => void persistir(input, snapshot)}
          onRetry={() => {
            const pendente = pendenteRef.current
            if (pendente) void persistir(pendente.input, pendente.snapshot)
          }}
          onEditar={async (id, input) => {
            const anterior = lancamentos.find((l) => l.id === id)
            if (!anterior) return false
            setLancamentos((atual) =>
              atual.map((l) =>
                l.id === id
                  ? {
                      ...l,
                      ...input,
                      atualizadoEm: new Date().toISOString(),
                    }
                  : l,
              ),
            )
            const result = await editarLancamento(id, input)
            if (result.ok) {
              setLancamentos((atual) => atual.map((l) => (l.id === id ? result.data : l)))
              return true
            }
            setLancamentos((atual) => atual.map((l) => (l.id === id ? anterior : l)))
            setErroBanner(result.message ?? 'Não foi possível salvar o lançamento. Tente novamente.')
            return false
          }}
          onLiquidar={(id, data) => {
            const anterior = lancamentos.find((l) => l.id === id)
            if (!anterior) return
            setLancamentos((atual) =>
              atual.map((l) => (l.id === id ? { ...l, dataPagamento: data } : l)),
            )
            void liquidarLancamento(id, data).then((result) => {
              if (result.ok) {
                setLancamentos((atual) => atual.map((l) => (l.id === id ? result.data : l)))
              } else if (anterior) {
                setLancamentos((atual) => atual.map((l) => (l.id === id ? anterior : l)))
                setErroBanner(result.message ?? 'Não foi possível salvar o lançamento. Tente novamente.')
              }
            })
          }}
          onExcluir={(id) => {
            const anterior = lancamentos.find((l) => l.id === id)
            setLancamentos((atual) => atual.filter((l) => l.id !== id))
            void excluirLancamento(id).then((result) => {
              if (!result.ok && anterior) {
                setLancamentos((atual) => [anterior, ...atual])
                setErroBanner(result.message ?? 'Não foi possível salvar o lançamento. Tente novamente.')
              }
            })
          }}
          onDuplicar={(l) => {
            setFormInitial(valuesFromLancamento(l))
            setFormKey((n) => n + 1)
          }}
          onImportar={async (inputs) => {
            for (const input of inputs) {
              const result = await criarLancamento(input)
              if (result.ok) setLancamentos((atual) => [result.data, ...atual])
            }
          }}
        />
      )}
    </div>
  )
}
