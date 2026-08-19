import { mapaVazio, podeAcessarMapa, temAlgumaPermissaoConfiguracoes, type MapaPermissoes, type NivelPermissao, type Recurso } from './autorizacao'
import { getCachedCurrentUser } from '../../lib/session'
import { carregarSessaoDetalhe, type SessaoPayload } from './data/repositorio'
import type { UsuarioSessao } from './types'

let cache: UsuarioSessao | null | undefined
let schemaAusenteCache = false

function toSessao(row: SessaoPayload): UsuarioSessao {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    papelId: row.papelId,
    papelNome: row.papelNome,
    situacao: row.situacao,
    doisFatoresAtivo: row.doisFatoresAtivo,
    doisFatoresDesde: row.doisFatoresDesde,
    permissoes: row.permissoes,
    ultimaReauthEm: row.ultimaReauthEm,
    iniciais: row.iniciais,
  }
}

export function invalidarSessaoCfg(): void {
  cache = undefined
  schemaAusenteCache = false
}

export async function usuarioAtual(): Promise<UsuarioSessao | null> {
  const { sessao } = await diagnosticarSessao()
  return sessao
}

export async function diagnosticarSessao(): Promise<{ sessao: UsuarioSessao | null; schemaAusente: boolean }> {
  if (cache !== undefined) return { sessao: cache, schemaAusente: schemaAusenteCache }
  const { usuario, schemaAusente } = await carregarSessaoDetalhe()
  cache = usuario ? toSessao(usuario) : null
  schemaAusenteCache = schemaAusente
  return { sessao: cache, schemaAusente }
}

export async function obterPermissoes(usuarioId: string): Promise<MapaPermissoes> {
  const sessao = await usuarioAtual()
  if (sessao && sessao.id === usuarioId) return sessao.permissoes
  return mapaVazio()
}

export async function podeAcessar(
  usuarioId: string,
  recurso: Recurso,
  nivel: NivelPermissao,
): Promise<boolean> {
  const mapa = await obterPermissoes(usuarioId)
  return podeAcessarMapa(mapa, recurso, nivel)
}

export function exigirPermissao(recurso: Recurso, nivel: NivelPermissao) {
  return async (usuarioId: string): Promise<void> => {
    const ok = await podeAcessar(usuarioId, recurso, nivel)
    if (!ok) {
      throw new Error('Acesso restrito.')
    }
  }
}

export async function podeVerConfiguracoes(): Promise<boolean> {
  const sessao = await usuarioAtual()
  if (sessao) return temAlgumaPermissaoConfiguracoes(sessao.permissoes)
  return getCachedCurrentUser()?.papel === 'socio'
}
