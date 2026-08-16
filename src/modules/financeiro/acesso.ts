import { verificarAcessoRpc } from './data/repositorio'
import { podeAcessar, usuarioAtual } from '../configuracoes/acesso'
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
  const sessao = await usuarioAtual().catch(() => null)
  if (sessao) {
    const ok = await podeAcessar(sessao.id, 'financeiro.lancamentos', 'ler')
    if (ok) {
      cacheAcesso = true
      return true
    }
  }
  const ok = await verificarAcessoRpc()
  if (ok) cacheAcesso = true
  return ok
}

export function invalidarCacheAcesso(): void {
  cacheAcesso = null
}
