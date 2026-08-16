import { verificarAcessoRpc } from './data/repositorio'
import type { FinanceiroSessao, PapelFinanceiro } from './types'

export function podeAcessarFinanceiro(sessao: FinanceiroSessao): boolean {
  return sessao.papel === 'socio' || sessao.papel === 'financeiro'
}

export function papelDaSessao(papelHost: string, allowlist = false): PapelFinanceiro {
  if (papelHost === 'socio') return 'socio'
  if (papelHost === 'financeiro' || allowlist) return 'financeiro'
  return 'outro'
}

let cacheAcesso: boolean | null = null

export async function verificarAcessoFinanceiro(): Promise<boolean> {
  if (cacheAcesso === true) return true
  const ok = await verificarAcessoRpc()
  if (ok) cacheAcesso = true
  return ok
}

export function invalidarCacheAcesso(): void {
  cacheAcesso = null
}
