import type { PapelSistema } from './recursos'
import { sociosAtivosParaSoma, type SocioResumo } from './socios'

export type SituacaoUsuario = 'ativo' | 'convidado' | 'suspenso' | 'desativado'

export type UsuarioResumo = {
  id: string
  papelId: string
  situacao: SituacaoUsuario
}

const MENSAGEM_LOGIN_NEUTRA = 'E-mail ou senha incorretos.'

export function podeAutenticar(situacao: SituacaoUsuario): boolean {
  return situacao === 'ativo'
}

export function mensagemLoginRecusado(): string {
  return MENSAGEM_LOGIN_NEUTRA
}

export function ehOProprio(atorId: string, alvoId: string | null | undefined): boolean {
  return Boolean(alvoId) && atorId === alvoId
}

export function bloqueiaAutoEdicaoParticipacao(atorUsuarioId: string, socio: SocioResumo): boolean {
  return ehOProprio(atorUsuarioId, socio.usuarioId)
}

export function bloqueiaAutoSaida(atorUsuarioId: string, socio: SocioResumo): boolean {
  return ehOProprio(atorUsuarioId, socio.usuarioId)
}

export function bloqueiaAutoExclusao(atorUsuarioId: string, socio: SocioResumo): boolean {
  return ehOProprio(atorUsuarioId, socio.usuarioId)
}

export function bloqueiaAutoPapel(atorId: string, alvoUsuarioId: string): boolean {
  return atorId === alvoUsuarioId
}

export function bloqueiaAutoSuspensao(atorId: string, alvoUsuarioId: string): boolean {
  return atorId === alvoUsuarioId
}

export function deixariaSemSocioAtivo(
  quadro: readonly SocioResumo[],
  socioAfetadoId: string,
  novaDataSaida: string | null,
): boolean {
  const restantes = sociosAtivosParaSoma(quadro).filter((s) => {
    if (s.id !== socioAfetadoId) return true
    return novaDataSaida == null
  })
  return restantes.length === 0
}

export function deixariaSemUsuarioSocioAtivo(
  usuarios: readonly UsuarioResumo[],
  alvoId: string,
  novaSituacao: UsuarioResumo['situacao'],
  novoPapelId?: string,
): boolean {
  const restantes = usuarios.filter((u) => {
    if (u.id === alvoId) {
      const papel = novoPapelId ?? u.papelId
      return novaSituacao === 'ativo' && papel === 'socio'
    }
    return u.situacao === 'ativo' && u.papelId === 'socio'
  })
  return restantes.length === 0
}

export function papelSocioImutavel(papelId: string): boolean {
  return papelId === 'socio'
}

const REAUTH_MS = 30 * 60 * 1000

export function precisaReautenticar(ultimaReauthIso: string | null, agora: Date = new Date()): boolean {
  if (!ultimaReauthIso) return true
  return agora.getTime() - new Date(ultimaReauthIso).getTime() > REAUTH_MS
}

const PRAZO_2FA_MS = 7 * 24 * 60 * 60 * 1000

export function acessoConfiguracoesBloqueadoPor2fa(input: {
  papelId: string
  doisFatoresAtivo: boolean
  doisFatoresDesde: string | null
  agora?: Date
}): boolean {
  if (input.papelId !== 'socio') return false
  if (input.doisFatoresAtivo) return false
  if (!input.doisFatoresDesde) return false
  const agora = input.agora ?? new Date()
  return agora.getTime() - new Date(input.doisFatoresDesde).getTime() > PRAZO_2FA_MS
}

export function aviso2faPendente(input: {
  papelId: string
  doisFatoresAtivo: boolean
}): boolean {
  return input.papelId === ('socio' satisfies PapelSistema) && !input.doisFatoresAtivo
}

export function migraUsuariosAntesDeExcluirPapel(quantidadeVinculados: number): boolean {
  return quantidadeVinculados === 0
}
