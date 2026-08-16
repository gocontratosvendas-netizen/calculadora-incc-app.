const CONVITE_MS = 7 * 24 * 60 * 60 * 1000
const REDEFINICAO_MS = 60 * 60 * 1000

export type TipoToken = 'convite' | 'redefinicao'

export type TokenRegistro = {
  tipo: TipoToken
  usadoEm: string | null
  expiresAt: string
}

export function validadeMs(tipo: TipoToken): number {
  return tipo === 'convite' ? CONVITE_MS : REDEFINICAO_MS
}

export function tokenUsavel(token: TokenRegistro, agora: Date = new Date()): 'ok' | 'inexistente' | 'expirado' | 'usado' {
  if (token.usadoEm) return 'usado'
  if (new Date(token.expiresAt).getTime() <= agora.getTime()) return 'expirado'
  return 'ok'
}

export function expiresAtIso(tipo: TipoToken, agora: Date = new Date()): string {
  return new Date(agora.getTime() + validadeMs(tipo)).toISOString()
}

/** Hex de 32 bytes — só o hash vai ao banco. */
export function tokenPareceBruto(valor: string): boolean {
  return /^[a-f0-9]{64}$/i.test(valor)
}
