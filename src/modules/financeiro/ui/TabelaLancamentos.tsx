import { useId, useState, type KeyboardEvent } from 'react'
import { parseMoedaParaCentavos, mascararCentavos } from '../data/moeda'
import { validarLancamentoInput, type ErrosLancamento } from '../data/schemas'
import { derivarStatus } from '../engine/derivarStatus'
import { formatarDataTabela, formatarMoedaContabil } from '../format'
import type { Classificacao, ClienteLancamentoOpcao, Lancamento, LancamentoInput, Movimentacao, SortCampo } from '../types'
import { OpcoesClassificacao } from './OpcoesClassificacao'

type Props = {
  lancamentos: Lancamento[]
  classificacoes: Classificacao[]
  clientes: ClienteLancamentoOpcao[]
  hoje: string
  ord: SortCampo
  dir: 'asc' | 'desc'
  pagina: number
  total: number
  pageSize: number
  highlightId: string | null
  tmpIds: Set<string>
  onSort: (campo: SortCampo) => void
  onPagina: (pagina: number) => void
  onSalvarEdicao: (id: string, input: LancamentoInput) => Promise<boolean>
  onLiquidar: (id: string, dataPagamento: string) => void
  onDuplicar: (lancamento: Lancamento) => void
  onExcluir: (lancamento: Lancamento) => void
}

type Edicao = LancamentoInput & { valorTexto: string }

export function TabelaLancamentos({
  lancamentos,
  classificacoes,
  clientes,
  hoje,
  ord,
  dir,
  pagina,
  total,
  pageSize,
  highlightId,
  tmpIds,
  onSort,
  onPagina,
  onSalvarEdicao,
  onLiquidar,
  onDuplicar,
  onExcluir,
}: Props) {
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [erros, setErros] = useState<ErrosLancamento>({})
  const [liquidandoId, setLiquidandoId] = useState<string | null>(null)
  const [dataLiquidar, setDataLiquidar] = useState(hoje)
  const [confirmando, setConfirmando] = useState<Lancamento | null>(null)
  const tituloId = useId()

  function iniciarEdicao(l: Lancamento) {
    setEditandoId(l.id)
    setErros({})
    setEdicao({
      dataEmissao: l.dataEmissao,
      movimentacao: l.movimentacao,
      historico: l.historico,
      classificacaoId: l.classificacaoId,
      valor: l.valor,
      valorTexto: mascararCentavos(l.valor),
      vencimento: l.vencimento,
      dataPagamento: l.dataPagamento,
      casoId: l.casoId,
      observacao: l.observacao,
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEdicao(null)
    setErros({})
  }

  async function salvarEdicao() {
    if (!editandoId || !edicao) return
    const valor = parseMoedaParaCentavos(edicao.valorTexto)
    if (valor === null || valor <= 0) {
      setErros({ valor: 'Informe um valor maior que zero.' })
      return
    }
    const input: LancamentoInput = {
      dataEmissao: edicao.dataEmissao,
      movimentacao: edicao.movimentacao,
      historico: edicao.historico.trim(),
      classificacaoId: edicao.classificacaoId,
      valor,
      vencimento: edicao.vencimento,
      dataPagamento: edicao.dataPagamento,
      casoId: edicao.casoId?.trim() || undefined,
    }
    const parsed = validarLancamentoInput(input)
    if (!parsed.ok) {
      setErros(parsed.errors)
      return
    }
    const ok = await onSalvarEdicao(editandoId, parsed.data)
    if (ok) cancelarEdicao()
  }

  function onRowKey(event: KeyboardEvent, l: Lancamento) {
    if (editandoId === l.id) {
      if (event.key === 'Enter') {
        event.preventDefault()
        void salvarEdicao()
      }
      if (event.key === 'Escape') cancelarEdicao()
    }
  }

  const paginas = Math.max(1, Math.ceil(total / pageSize))
  const nome = (id: string) => classificacoes.find((c) => c.id === id)?.nome ?? id
  const rotuloCliente = (casoId: string | undefined) => {
    if (!casoId) return '—'
    const cliente = clientes.find((c) => c.casoId === casoId)
    if (!cliente) return 'Cliente vinculado'
    return cliente.detalhe ? `${cliente.nome} · ${cliente.detalhe}` : cliente.nome
  }

  function cabecalho(campo: SortCampo, rotulo: string, num = false) {
    const ativo = ord === campo
    return (
      <th className={num ? 'is-num' : undefined}>
        <button type="button" className="fin-btn fin-btn--ghost" onClick={() => onSort(campo)}>
          {rotulo}
          {ativo ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
        </button>
      </th>
    )
  }

  return (
    <>
      <div className="fin-scroll">
        <table className="fin-table">
          <thead>
            <tr>
              {cabecalho('emissao', 'Emissão')}
              {cabecalho('movimentacao', 'Mov.')}
              {cabecalho('historico', 'Histórico')}
              <th>Cliente</th>
              {cabecalho('classificacao', 'Classificação')}
              {cabecalho('valor', 'Valor (R$)', true)}
              {cabecalho('vencimento', 'Venc.')}
              {cabecalho('pagamento', 'Pagto.')}
              <th><span className="fin-visually-hidden">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="fin-empty">Nenhum lançamento neste período. Cadastre o primeiro acima.</div>
                </td>
              </tr>
            ) : (
              lancamentos.map((l) => {
                const status = derivarStatus(l, hoje)
                const atrasado = status === 'atrasado'
                const editando = editandoId === l.id && edicao
                return (
                  <tr
                    key={l.id}
                    className={[
                      tmpIds.has(l.id) ? 'is-tmp' : '',
                      highlightId === l.id ? 'is-highlight' : '',
                    ].join(' ')}
                    onKeyDown={(e) => onRowKey(e, l)}
                  >
                    {editando ? (
                      <>
                        <td>
                          <input
                            className="fin-input"
                            type="date"
                            value={edicao.dataEmissao}
                            onChange={(e) => setEdicao({ ...edicao, dataEmissao: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            className="fin-select"
                            value={edicao.movimentacao}
                            onChange={(e) =>
                              setEdicao({
                                ...edicao,
                                movimentacao: e.target.value as Movimentacao,
                                classificacaoId: '',
                              })
                            }
                          >
                            <option value="entrada">Entrada</option>
                            <option value="saida">Saída</option>
                          </select>
                        </td>
                        <td>
                          <input
                            className="fin-input"
                            value={edicao.historico}
                            onChange={(e) => setEdicao({ ...edicao, historico: e.target.value })}
                          />
                          {erros.historico ? <div className="fin-field-erro">{erros.historico}</div> : null}
                        </td>
                        <td>
                          <select
                            className="fin-select"
                            value={edicao.casoId ?? ''}
                            onChange={(e) => setEdicao({ ...edicao, casoId: e.target.value || undefined })}
                            aria-label="Cliente"
                          >
                            <option value="">Sem cliente</option>
                            {clientes.map((cliente) => (
                              <option key={cliente.casoId} value={cliente.casoId}>
                                {cliente.detalhe ? `${cliente.nome} · ${cliente.detalhe}` : cliente.nome}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="fin-select"
                            value={edicao.classificacaoId}
                            onChange={(e) => setEdicao({ ...edicao, classificacaoId: e.target.value })}
                          >
                            <OpcoesClassificacao
                              classificacoes={classificacoes}
                              movimentacao={edicao.movimentacao}
                              incluirId={edicao.classificacaoId}
                              placeholder=""
                            />
                          </select>
                        </td>
                        <td className="is-num">
                          <input
                            className="fin-input"
                            value={edicao.valorTexto}
                            onChange={(e) => setEdicao({ ...edicao, valorTexto: e.target.value })}
                          />
                          {erros.valor ? <div className="fin-field-erro">{erros.valor}</div> : null}
                        </td>
                        <td>
                          <input
                            className="fin-input"
                            type="date"
                            value={edicao.vencimento}
                            onChange={(e) => setEdicao({ ...edicao, vencimento: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="fin-input"
                            type="date"
                            value={edicao.dataPagamento ?? ''}
                            onChange={(e) =>
                              setEdicao({ ...edicao, dataPagamento: e.target.value ? e.target.value : null })
                            }
                          />
                        </td>
                        <td>
                          <div className="fin-row-actions" style={{ opacity: 1 }}>
                            <button type="button" onClick={() => void salvarEdicao()}>Salvar</button>
                            <button type="button" onClick={cancelarEdicao}>Cancelar</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{formatarDataTabela(l.dataEmissao)}</td>
                        <td>
                          <span className={`fin-mov ${l.movimentacao === 'entrada' ? 'is-entrada' : 'is-saida'}`}>
                            {l.movimentacao === 'entrada' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td>{l.historico}</td>
                        <td>{rotuloCliente(l.casoId)}</td>
                        <td>{nome(l.classificacaoId)}</td>
                        <td className="is-num">{formatarMoedaContabil(l.valor)}</td>
                        <td className={atrasado ? 'fin-td-atrasado' : undefined}>
                          {formatarDataTabela(l.vencimento)}
                        </td>
                        <td>
                          {l.dataPagamento ? (
                            formatarDataTabela(l.dataPagamento)
                          ) : (
                            <span className={`fin-pill ${atrasado ? 'is-atrasado' : 'is-pendente'}`}>
                              {atrasado ? 'atrasado' : 'pendente'}
                            </span>
                          )}
                          {liquidandoId === l.id ? (
                            <div>
                              <input
                                type="date"
                                className="fin-input"
                                value={dataLiquidar}
                                onChange={(e) => setDataLiquidar(e.target.value)}
                              />
                              <button
                                type="button"
                                className="fin-btn fin-btn--primary"
                                onClick={() => {
                                  onLiquidar(l.id, dataLiquidar)
                                  setLiquidandoId(null)
                                }}
                              >
                                Confirmar
                              </button>
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <div className="fin-row-actions">
                            <button type="button" onClick={() => iniciarEdicao(l)}>Editar</button>
                            {!l.dataPagamento ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setLiquidandoId(l.id)
                                  setDataLiquidar(hoje)
                                }}
                              >
                                Liquidar
                              </button>
                            ) : null}
                            <button type="button" onClick={() => onDuplicar(l)}>Duplicar</button>
                            <button type="button" onClick={() => setConfirmando(l)}>Excluir</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="fin-footer">
        <span>
          {total} lançamento{total === 1 ? '' : 's'}
        </span>
        <span>
          <button type="button" className="fin-btn fin-btn--secondary" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)}>
            Anterior
          </button>{' '}
          {pagina}/{paginas}{' '}
          <button type="button" className="fin-btn fin-btn--secondary" disabled={pagina >= paginas} onClick={() => onPagina(pagina + 1)}>
            Próxima
          </button>
        </span>
      </div>

      {confirmando ? (
        <div className="fin-backdrop" onClick={() => setConfirmando(null)}>
          <dialog className="fin-dialog" open aria-labelledby={tituloId} onClick={(e) => e.stopPropagation()}>
            <h2 id={tituloId} style={{ marginTop: 0, fontSize: 16 }}>Excluir lançamento</h2>
            <p>
              Excluir “{confirmando.historico}”, {formatarMoedaContabil(confirmando.valor, true)}?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="fin-btn fin-btn--secondary" onClick={() => setConfirmando(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="fin-btn fin-btn--primary"
                onClick={() => {
                  onExcluir(confirmando)
                  setConfirmando(null)
                }}
              >
                Excluir
              </button>
            </div>
          </dialog>
        </div>
      ) : null}
    </>
  )
}
