export const RECURSOS = [
  'calculadora',
  'casos',
  'parcerias',
  'documentos',
  'financeiro.lancamentos',
  'financeiro.dre',
  'configuracoes.socios',
  'configuracoes.usuarios',
  'configuracoes.auditoria',
] as const

export type Recurso = (typeof RECURSOS)[number]

export const NIVEIS_PERMISSAO = ['nenhum', 'ler', 'editar', 'total'] as const

export type NivelPermissao = (typeof NIVEIS_PERMISSAO)[number]

export type MapaPermissoes = Record<Recurso, NivelPermissao>

export const PAPEIS_SISTEMA = [
  'socio',
  'financeiro',
  'operacao',
  'parceiro_juridico',
  'leitura',
] as const

export type PapelSistema = (typeof PAPEIS_SISTEMA)[number]

const ORDEM: Record<NivelPermissao, number> = {
  nenhum: 0,
  ler: 1,
  editar: 2,
  total: 3,
}

export function nivelSuficiente(atual: NivelPermissao, exigido: NivelPermissao): boolean {
  return ORDEM[atual] >= ORDEM[exigido]
}

export function podeAcessarMapa(
  mapa: MapaPermissoes,
  recurso: Recurso,
  nivel: NivelPermissao,
): boolean {
  return nivelSuficiente(mapa[recurso] ?? 'nenhum', nivel)
}

export function nivelPadraoRecursoNovo(papelId: string): NivelPermissao {
  return papelId === 'socio' ? 'total' : 'nenhum'
}

export function niveisPermitidosNaCelula(
  papelId: string,
  recurso: Recurso,
): readonly NivelPermissao[] | 'bloqueado' {
  if (papelId === 'socio') return 'bloqueado'
  if (recurso === 'configuracoes.auditoria') return ['nenhum', 'ler']
  return NIVEIS_PERMISSAO
}

export function alterarPermissaoPermitido(
  papelId: string,
  recurso: Recurso,
  novo: NivelPermissao,
): boolean {
  const permitidos = niveisPermitidosNaCelula(papelId, recurso)
  if (permitidos === 'bloqueado') return false
  return permitidos.includes(novo)
}

export function temAlgumaPermissaoConfiguracoes(mapa: MapaPermissoes): boolean {
  return (
    podeAcessarMapa(mapa, 'configuracoes.socios', 'ler') ||
    podeAcessarMapa(mapa, 'configuracoes.usuarios', 'ler') ||
    podeAcessarMapa(mapa, 'configuracoes.auditoria', 'ler')
  )
}
