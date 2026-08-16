export const ACOES_AUDITORIA = [
  'criar',
  'editar',
  'excluir',
  'registrar_saida',
  'reverter_saida',
  'convidar',
  'suspender',
  'reativar',
  'desativar',
  'alterar_permissao',
  'login',
  'login_falho',
] as const

export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[number]

export function fraseAlteracaoCampo(input: {
  campo: string
  nome: string
  anterior: string
  novo: string
}): string {
  return `Alterou ${input.campo} de ${input.nome} de ${input.anterior} para ${input.novo}`
}

export function confirmacaoComContexto(frase: string): string {
  return frase.endsWith('?') ? frase : `${frase}?`
}
