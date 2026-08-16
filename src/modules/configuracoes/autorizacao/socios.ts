import type { NivelPermissao } from './recursos'

export type SituacaoSocio = 'ativo' | 'aporte_pendente' | 'inativo'

export type SocioResumo = {
  id: string
  usuarioId: string | null
  participacaoCentesimos: number
  aporteComprometido: number
  aporteIntegralizado: number
  dataSaida: string | null
  deletadoEm: string | null
  usuarioJaLogou: boolean
  temLancamentoFinanceiro: boolean
}

export function participacaoParaCentesimos(percentual: number): number {
  return Math.round(percentual * 100)
}

export function centesimosParaParticipacao(centesimos: number): number {
  return centesimos / 100
}

export function derivarSituacaoSocio(input: {
  dataSaida: string | null
  aporteComprometido: number
  aporteIntegralizado: number
}): SituacaoSocio {
  if (input.dataSaida) return 'inativo'
  if (input.aporteIntegralizado < input.aporteComprometido) return 'aporte_pendente'
  return 'ativo'
}

export function sociosAtivosParaSoma(
  socios: readonly SocioResumo[],
  ignorarId?: string,
): SocioResumo[] {
  return socios.filter(
    (s) => !s.deletadoEm && !s.dataSaida && s.id !== ignorarId,
  )
}

export function somaParticipacaoCentesimos(
  socios: readonly SocioResumo[],
  ignorarId?: string,
): number {
  return sociosAtivosParaSoma(socios, ignorarId).reduce((acc, s) => acc + s.participacaoCentesimos, 0)
}

export const CEM_POR_CENTO = 10_000

export function desvioParticipacao(somaCentesimos: number): {
  fecha: boolean
  soma: number
  desvio: number
} {
  const desvio = somaCentesimos - CEM_POR_CENTO
  return { fecha: desvio === 0, soma: somaCentesimos, desvio }
}

export function participacaoExcedeCem(
  atuais: readonly SocioResumo[],
  novaParticipacaoCentesimos: number,
  ignorarId?: string,
): { excede: boolean; excessoCentesimos: number; somaCentesimos: number } {
  const soma = somaParticipacaoCentesimos(atuais, ignorarId) + novaParticipacaoCentesimos
  const excesso = soma - CEM_POR_CENTO
  return { excede: excesso > 0, excessoCentesimos: Math.max(0, excesso), somaCentesimos: soma }
}

export type MotivoExclusaoBloqueada =
  | 'aporte_integralizado'
  | 'lancamento_financeiro'
  | 'conta_com_login'
  | 'unico_ativo'

export function motivosExclusaoBloqueada(
  socio: SocioResumo,
  quadro: readonly SocioResumo[],
): MotivoExclusaoBloqueada[] {
  const motivos: MotivoExclusaoBloqueada[] = []
  if (socio.aporteIntegralizado > 0) motivos.push('aporte_integralizado')
  if (socio.temLancamentoFinanceiro) motivos.push('lancamento_financeiro')
  if (socio.usuarioId && socio.usuarioJaLogou) motivos.push('conta_com_login')
  const ativos = sociosAtivosParaSoma(quadro)
  const ehAtivo = !socio.deletadoEm && !socio.dataSaida
  if (ehAtivo && ativos.length <= 1) motivos.push('unico_ativo')
  return motivos
}

export function podeExcluirCadastro(socio: SocioResumo, quadro: readonly SocioResumo[]): boolean {
  return motivosExclusaoBloqueada(socio, quadro).length === 0
}

export type AcaoLinhaSocio = 'editar' | 'registrar_saida' | 'reverter_saida' | 'excluir'

export function acoesVisiveisSocio(input: {
  permissao: NivelPermissao
  socio: SocioResumo
  quadro: readonly SocioResumo[]
}): AcaoLinhaSocio[] {
  const acoes: AcaoLinhaSocio[] = []
  if (input.permissao === 'editar' || input.permissao === 'total') {
    acoes.push('editar')
  }
  if (input.permissao !== 'total') return acoes
  if (input.socio.dataSaida) acoes.push('reverter_saida')
  else acoes.push('registrar_saida')
  if (podeExcluirCadastro(input.socio, input.quadro)) acoes.push('excluir')
  return acoes
}

export function campoSocioExigeTotal(
  campo:
    | 'participacao'
    | 'aporteComprometido'
    | 'aporteIntegralizado'
    | 'dataEntrada'
    | 'nomeCompleto'
    | 'cpf'
    | 'email'
    | 'telefone'
    | 'observacao'
    | 'usuarioId',
): boolean {
  return (
    campo === 'participacao' ||
    campo === 'aporteComprometido' ||
    campo === 'aporteIntegralizado' ||
    campo === 'dataEntrada'
  )
}

export function podeEditarCampoSocio(permissao: NivelPermissao, campo: Parameters<typeof campoSocioExigeTotal>[0]): boolean {
  if (permissao !== 'editar' && permissao !== 'total') return false
  if (campoSocioExigeTotal(campo)) return permissao === 'total'
  return true
}

export function dataEntradaValida(iso: string, hoje: string): boolean {
  return iso <= hoje
}

export function aporteConsistente(comprometido: number, integralizado: number): boolean {
  return comprometido >= 0 && integralizado >= 0 && integralizado <= comprometido
}

export function participacaoNoIntervalo(centesimos: number): boolean {
  return centesimos >= 1 && centesimos <= CEM_POR_CENTO
}
