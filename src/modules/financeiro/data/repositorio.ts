import { supabase } from '../../../lib/supabase'
import {
  mapearHonorariosDaCarteira,
  type HonorariosDoCaso,
} from '../engine/honorariosCarteira'
import { CLASSIFICACAO_PRO_LABORE_RECEITA, mesclarPlanoContas, planoContasSeed } from '../engine/planoContas'
import { proLaboreCentavosParaReais, resumirProLaboreDoCaso, type ProLaboreDoCaso } from '../engine/somarProLaboreRecebido'
import type { Classificacao, GrupoDRE, Lancamento, LancamentoInput, Movimentacao } from '../types'

export type RpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors?: Record<string, string>; message?: string }

type LancamentoRow = {
  id: string
  dataEmissao: string
  movimentacao: Movimentacao
  historico: string
  classificacaoId: string
  valor: number
  vencimento: string
  dataPagamento: string | null
  casoId: string | null
  observacao: string | null
  deletadoEm: string | null
  criadoEm: string
  atualizadoEm: string
}

type ClassificacaoRow = {
  id: string
  codigo: string
  nome: string
  movimentacao: Movimentacao
  grupo_dre: GrupoDRE | null
  ordem: number
  ativa: boolean
  sistema: boolean
}

function mapLancamento(row: LancamentoRow): Lancamento {
  return {
    id: row.id,
    dataEmissao: String(row.dataEmissao).slice(0, 10),
    movimentacao: row.movimentacao,
    historico: row.historico,
    classificacaoId: row.classificacaoId,
    valor: Number(row.valor),
    vencimento: String(row.vencimento).slice(0, 10),
    dataPagamento: row.dataPagamento ? String(row.dataPagamento).slice(0, 10) : null,
    casoId: row.casoId ?? undefined,
    observacao: row.observacao ?? undefined,
    deletadoEm: row.deletadoEm,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  }
}

function mapClassificacao(row: ClassificacaoRow): Classificacao {
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    movimentacao: row.movimentacao,
    grupoDRE: row.grupo_dre,
    ordem: row.ordem,
    ativa: row.ativa,
    sistema: row.sistema,
  }
}

export async function listarClassificacoes(): Promise<Classificacao[]> {
  const { data, error } = await supabase
    .from('fin_classificacoes')
    .select('id, codigo, nome, movimentacao, grupo_dre, ordem, ativa, sistema')
    .order('ordem')
  if (error) return planoContasSeed()
  return mesclarPlanoContas(((data ?? []) as ClassificacaoRow[]).map(mapClassificacao))
}

/** Total de pró-labore recebido na área financeira, em reais. Falha de acesso devolve 0. */
export async function obterTotalProLaboreRecebido(): Promise<number> {
  const { data, error } = await supabase
    .from('fin_lancamentos')
    .select('valor')
    .eq('classificacao_id', CLASSIFICACAO_PRO_LABORE_RECEITA)
    .eq('movimentacao', 'entrada')
    .is('deletado_em', null)
  if (error) return 0
  const centavos = (data ?? []).reduce((acc, row) => acc + Number(row.valor), 0)
  return proLaboreCentavosParaReais(centavos)
}

export type { HonorariosDoCaso, ProLaboreDoCaso }

/** Pró-labore vinculado ao caso, em reais. Falha devolve zeros / não pago. */
export async function obterProLaboreDoCaso(casoId: string): Promise<ProLaboreDoCaso> {
  const vazio = resumirProLaboreDoCaso(0, 0)
  const { data, error } = await supabase.rpc('fin_pro_labore_do_caso', { p_caso_id: casoId })
  if (error || !data) return vazio
  const payload = data as { ok?: boolean; valorPago?: number; valorPendente?: number }
  if (payload.ok === false) return vazio
  return resumirProLaboreDoCaso(Number(payload.valorPago ?? 0), Number(payload.valorPendente ?? 0))
}

/** Pró-labore e êxito por caso, em reais. Falha devolve mapa vazio. */
export async function obterHonorariosDaCarteira(): Promise<Record<string, HonorariosDoCaso>> {
  const { data, error } = await supabase.rpc('fin_honorarios_da_carteira')
  if (error || !data) return {}
  const payload = data as { ok?: boolean; itens?: Parameters<typeof mapearHonorariosDaCarteira>[0] }
  if (payload.ok === false) return {}
  return mapearHonorariosDaCarteira(payload.itens)
}

export async function listarLancamentos(): Promise<Lancamento[]> {
  const { data, error } = await supabase
    .from('fin_lancamentos')
    .select(
      'id, data_emissao, movimentacao, historico, classificacao_id, valor, vencimento, data_pagamento, caso_id, observacao, deletado_em, criado_em, atualizado_em',
    )
    .is('deletado_em', null)
    .order('data_emissao', { ascending: false })
  if (error) throw error
  type Snake = {
    id: string
    data_emissao: string
    movimentacao: Movimentacao
    historico: string
    classificacao_id: string
    valor: number | string
    vencimento: string
    data_pagamento: string | null
    caso_id: string | null
    observacao: string | null
    deletado_em: string | null
    criado_em: string
    atualizado_em: string
  }
  return ((data ?? []) as Snake[]).map((row) =>
    mapLancamento({
      id: row.id,
      dataEmissao: row.data_emissao,
      movimentacao: row.movimentacao,
      historico: row.historico,
      classificacaoId: row.classificacao_id,
      valor: Number(row.valor),
      vencimento: row.vencimento,
      dataPagamento: row.data_pagamento,
      casoId: row.caso_id,
      observacao: row.observacao,
      deletadoEm: row.deletado_em,
      criadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em,
    }),
  )
}

function interpretarRpc(data: unknown, error: { message: string } | null): RpcResult<Lancamento> {
  if (error) return { ok: false, message: error.message }
  const payload = data as { ok?: boolean; lancamento?: LancamentoRow; errors?: Record<string, string>; message?: string } | null
  if (!payload || payload.ok !== true || !payload.lancamento) {
    return {
      ok: false,
      errors: payload?.errors,
      message: payload?.message ?? 'Não foi possível salvar o lançamento. Tente novamente.',
    }
  }
  return { ok: true, data: mapLancamento(payload.lancamento) }
}

/** POST /api/financeiro/lancamentos */
export async function criarLancamento(input: LancamentoInput): Promise<RpcResult<Lancamento>> {
  const { data, error } = await supabase.rpc('fin_criar_lancamento', { payload: input })
  return interpretarRpc(data, error)
}

/** PATCH /api/financeiro/lancamentos/:id */
export async function editarLancamento(id: string, input: LancamentoInput): Promise<RpcResult<Lancamento>> {
  const { data, error } = await supabase.rpc('fin_editar_lancamento', { p_id: id, payload: input })
  return interpretarRpc(data, error)
}

/** POST /api/financeiro/lancamentos/:id/liquidar */
export async function liquidarLancamento(id: string, dataPagamento: string): Promise<RpcResult<Lancamento>> {
  const { data, error } = await supabase.rpc('fin_liquidar_lancamento', {
    p_id: id,
    p_data_pagamento: dataPagamento,
  })
  return interpretarRpc(data, error)
}

/** DELETE /api/financeiro/lancamentos/:id (soft) */
export async function excluirLancamento(id: string): Promise<RpcResult<Lancamento>> {
  const { data, error } = await supabase.rpc('fin_excluir_lancamento', { p_id: id })
  return interpretarRpc(data, error)
}

export async function criarClassificacao(input: {
  codigo: string
  nome: string
  movimentacao: Movimentacao
  grupoDRE: GrupoDRE | null
}): Promise<RpcResult<Classificacao>> {
  const { data, error } = await supabase.rpc('fin_criar_classificacao', { payload: input })
  if (error) return { ok: false, message: error.message }
  const payload = data as {
    ok?: boolean
    classificacao?: {
      id: string
      codigo: string
      nome: string
      movimentacao: Movimentacao
      grupoDRE: GrupoDRE | null
      ordem: number
      ativa: boolean
      sistema: boolean
    }
    errors?: Record<string, string>
    message?: string
  } | null
  if (!payload || payload.ok !== true || !payload.classificacao) {
    return { ok: false, errors: payload?.errors, message: payload?.message }
  }
  return { ok: true, data: payload.classificacao }
}

export async function verificarAcessoRpc(): Promise<boolean> {
  const { data, error } = await supabase.rpc('fin_pode_acessar')
  if (error) return false
  return data === true
}
