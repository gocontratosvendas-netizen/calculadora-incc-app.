import { supabase } from '../../../lib/supabase'
import type { AcaoAuditoria, MapaPermissoes } from '../autorizacao'
import type { FiltrosAuditoria, Papel, RegistroAuditoria, ResumoSocios, Socio, SocioInput, Usuario } from '../types'

export type RpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; code?: string; message?: string; errors?: Record<string, string> }

function asObj(data: unknown): Record<string, unknown> | null {
  let value = data
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown
    } catch {
      return null
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return null
}

export function schemaCfgAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === 'PGRST202' ||
    error.code === 'PGRST205' ||
    /schema cache|Could not find the function public\.cfg_|Could not find the table 'public.cfg_/i.test(
      error.message,
    )
  )
}

function interpretar<T>(data: unknown, error: { message: string } | null, key: string): RpcResult<T> {
  if (error) return { ok: false, message: error.message }
  const payload = asObj(data)
  if (!payload || payload.ok !== true) {
    return {
      ok: false,
      code: typeof payload?.code === 'string' ? payload.code : undefined,
      message: typeof payload?.message === 'string' ? payload.message : 'Não foi possível concluir a operação.',
      errors: payload?.errors as Record<string, string> | undefined,
    }
  }
  return { ok: true, data: payload[key] as T }
}

export type SessaoPayload = {
  id: string
  nome: string
  email: string
  papelId: string
  papelNome: string
  situacao: 'ativo' | 'convidado' | 'suspenso' | 'desativado'
  doisFatoresAtivo: boolean
  doisFatoresDesde: string | null
  permissoes: MapaPermissoes
  ultimaReauthEm: string | null
  iniciais: string
}

export type ResultadoSessao = {
  usuario: SessaoPayload | null
  schemaAusente: boolean
}

export async function carregarSessaoDetalhe(): Promise<ResultadoSessao> {
  const { data, error } = await supabase.rpc('cfg_sessao_atual')
  if (error) return { usuario: null, schemaAusente: schemaCfgAusente(error) }
  const payload = asObj(data)
  if (!payload || payload.ok !== true) return { usuario: null, schemaAusente: false }
  return { usuario: (payload.usuario as SessaoPayload | null) ?? null, schemaAusente: false }
}

export async function carregarSessao(): Promise<SessaoPayload | null> {
  const { usuario } = await carregarSessaoDetalhe()
  return usuario
}

export async function confirmarPosLogin(): Promise<RpcResult<true>> {
  const { data, error } = await supabase.rpc('cfg_pos_login')
  const parsed = interpretar<unknown>(data, error, 'ok')
  if (!parsed.ok) return parsed
  return { ok: true, data: true }
}

export async function registrarLoginFalho(email: string): Promise<void> {
  await supabase.rpc('cfg_registrar_login_falho', { p_email: email })
}

export async function loginLiberado(email: string): Promise<boolean> {
  const { data } = await supabase.rpc('cfg_login_liberado', { p_email: email })
  const payload = asObj(data)
  return payload?.ok === true
}

export async function marcarReauth(): Promise<RpcResult<true>> {
  const { data, error } = await supabase.rpc('cfg_marcar_reauth')
  const parsed = interpretar<unknown>(data, error, 'ok')
  if (!parsed.ok) return parsed
  return { ok: true, data: true }
}

export async function marcar2fa(ativo: boolean): Promise<void> {
  await supabase.rpc('cfg_marcar_2fa', { p_ativo: ativo })
}

export async function logoutServidor(): Promise<void> {
  await supabase.rpc('cfg_logout')
}

export type ListaSocios = { socios: Socio[]; resumo: ResumoSocios }

export async function listarSocios(incluirInativos = false): Promise<RpcResult<ListaSocios>> {
  const { data, error } = await supabase.rpc('cfg_listar_socios', { p_incluir_inativos: incluirInativos })
  if (error) return { ok: false, message: error.message }
  const payload = asObj(data)
  if (!payload || payload.ok !== true) {
    return { ok: false, code: payload?.code as string, message: payload?.message as string }
  }
  return { ok: true, data: { socios: (payload.socios as Socio[]) ?? [], resumo: payload.resumo as ResumoSocios } }
}

export async function criarSocio(input: SocioInput): Promise<RpcResult<Socio>> {
  const { data, error } = await supabase.rpc('cfg_criar_socio', { payload: input })
  return interpretar<Socio>(data, error, 'socio')
}

export async function editarSocio(id: string, input: SocioInput): Promise<RpcResult<Socio>> {
  const { data, error } = await supabase.rpc('cfg_editar_socio', { p_id: id, payload: input })
  return interpretar<Socio>(data, error, 'socio')
}

export async function registrarSaida(
  id: string,
  input: { dataSaida: string; motivo?: string; suspenderConta: boolean },
): Promise<RpcResult<Socio>> {
  const { data, error } = await supabase.rpc('cfg_registrar_saida', { p_id: id, payload: input })
  return interpretar<Socio>(data, error, 'socio')
}

export async function reverterSaida(id: string): Promise<RpcResult<Socio>> {
  const { data, error } = await supabase.rpc('cfg_reverter_saida', { p_id: id })
  return interpretar<Socio>(data, error, 'socio')
}

export async function excluirSocio(
  id: string,
  input: { confirmacaoNome: string; desativarConvite?: boolean },
): Promise<RpcResult<true>> {
  const { data, error } = await supabase.rpc('cfg_excluir_socio', { p_id: id, payload: input })
  const parsed = interpretar<unknown>(data, error, 'ok')
  if (!parsed.ok) return parsed
  return { ok: true, data: true }
}

export async function revelarCpf(id: string): Promise<RpcResult<string>> {
  const { data, error } = await supabase.rpc('cfg_revelar_cpf', { p_id: id })
  return interpretar<string>(data, error, 'cpf')
}

export async function listarUsuarios(): Promise<RpcResult<Usuario[]>> {
  const { data, error } = await supabase.rpc('cfg_listar_usuarios')
  return interpretar<Usuario[]>(data, error, 'usuarios')
}

export async function listarPapeis(): Promise<RpcResult<Papel[]>> {
  const { data, error } = await supabase.rpc('cfg_listar_papeis')
  return interpretar<Papel[]>(data, error, 'papeis')
}

export async function convidarUsuario(input: {
  nome: string
  email: string
  papelId: string
}): Promise<RpcResult<Usuario>> {
  const { data, error } = await supabase.rpc('cfg_convidar_usuario', { payload: input })
  return interpretar<Usuario>(data, error, 'usuario')
}

export async function reenviarConvite(id: string): Promise<RpcResult<true>> {
  const { data, error } = await supabase.rpc('cfg_reenviar_convite', { p_id: id })
  const parsed = interpretar<unknown>(data, error, 'ok')
  if (!parsed.ok) return parsed
  return { ok: true, data: true }
}

export async function alterarPapel(id: string, papelId: string): Promise<RpcResult<Usuario>> {
  const { data, error } = await supabase.rpc('cfg_alterar_papel_usuario', { p_id: id, p_papel: papelId })
  return interpretar<Usuario>(data, error, 'usuario')
}

export async function mudarSituacao(
  id: string,
  situacao: 'ativo' | 'suspenso' | 'desativado',
): Promise<RpcResult<Usuario>> {
  const { data, error } = await supabase.rpc('cfg_mudar_situacao_usuario', { p_id: id, p_situacao: situacao })
  return interpretar<Usuario>(data, error, 'usuario')
}

export async function forcarRedefinicao(id: string): Promise<RpcResult<true>> {
  const { data, error } = await supabase.rpc('cfg_forcar_redefinicao', { p_id: id })
  const parsed = interpretar<unknown>(data, error, 'ok')
  if (!parsed.ok) return parsed
  return { ok: true, data: true }
}

export async function alterarPermissao(
  papelId: string,
  recurso: string,
  nivel: string,
): Promise<RpcResult<true>> {
  const { data, error } = await supabase.rpc('cfg_alterar_permissao', {
    p_papel: papelId,
    p_recurso: recurso,
    p_nivel: nivel,
  })
  const parsed = interpretar<unknown>(data, error, 'ok')
  if (!parsed.ok) return parsed
  return { ok: true, data: true }
}

export async function criarPapel(input: {
  nome: string
  descricao: string
  origemId: string
}): Promise<RpcResult<string>> {
  const { data, error } = await supabase.rpc('cfg_criar_papel', { payload: input })
  return interpretar<string>(data, error, 'papelId')
}

export async function excluirPapel(id: string): Promise<RpcResult<true>> {
  const { data, error } = await supabase.rpc('cfg_excluir_papel', { p_id: id })
  const parsed = interpretar<unknown>(data, error, 'ok')
  if (!parsed.ok) return parsed
  return { ok: true, data: true }
}

export async function listarAuditoria(filtros: FiltrosAuditoria = {}): Promise<RpcResult<RegistroAuditoria[]>> {
  const { data, error } = await supabase.rpc('cfg_listar_auditoria', {
    p_autor: filtros.autorId ?? null,
    p_acao: filtros.acao ?? null,
    p_modulo: filtros.modulo ?? null,
    p_entidade: filtros.entidade ?? null,
    p_busca: filtros.busca ?? null,
    p_de: filtros.de ?? null,
    p_ate: filtros.ate ?? null,
    p_limite: 200,
    p_offset: 0,
  })
  return interpretar<RegistroAuditoria[]>(data, error, 'registros')
}

export async function peekToken(token: string): Promise<
  RpcResult<{ tipo: string; nome: string; papel: string; usuarioId: string }>
> {
  const { data, error } = await supabase.rpc('cfg_peek_token', { p_token: token })
  if (error) return { ok: false, message: error.message }
  const payload = asObj(data)
  if (!payload || payload.ok !== true) {
    return { ok: false, code: payload?.code as string, message: 'Este link não é mais válido.' }
  }
  return {
    ok: true,
    data: {
      tipo: String(payload.tipo),
      nome: String(payload.nome),
      papel: String(payload.papel),
      usuarioId: String(payload.usuarioId),
    },
  }
}

export async function solicitarRedefinicao(email: string): Promise<void> {
  await supabase.rpc('cfg_solicitar_redefinicao', { p_email: email })
}

export async function solicitarNovoConvite(email: string): Promise<void> {
  await supabase.rpc('cfg_solicitar_novo_convite', { p_email: email })
}

export async function listarFilaEmails(): Promise<
  { id: string; tipo: string; destinatario: string; assunto: string; payload: Record<string, unknown> | null }[]
> {
  const { data } = await supabase.rpc('cfg_filhos_fila')
  const payload = asObj(data)
  if (!payload || payload.ok !== true) return []
  return (payload.itens as { id: string; tipo: string; destinatario: string; assunto: string; payload: Record<string, unknown> | null }[]) ?? []
}

export async function marcarEmailEnviado(id: string): Promise<void> {
  await supabase.rpc('cfg_marcar_email_enviado', { p_id: id })
}

export type { AcaoAuditoria }
