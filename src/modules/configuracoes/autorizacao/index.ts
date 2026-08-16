export {
  RECURSOS,
  NIVEIS_PERMISSAO,
  PAPEIS_SISTEMA,
  nivelSuficiente,
  podeAcessarMapa,
  nivelPadraoRecursoNovo,
  niveisPermitidosNaCelula,
  alterarPermissaoPermitido,
  temAlgumaPermissaoConfiguracoes,
} from './recursos'
export type { Recurso, NivelPermissao, MapaPermissoes, PapelSistema } from './recursos'

export { MATRIZ_PADRAO, DESCRICAO_PAPEIS, mapaVazio, mapaDePapel, isPapelSistema, recursoConhecido } from './matriz'

export { apenasDigitos, cpfValido, mascararCpf } from './cpf'

export { senhaAceita, senhasConferem } from './senha'

export { tokenUsavel, expiresAtIso, validadeMs, tokenPareceBruto } from './token'
export type { TipoToken, TokenRegistro } from './token'

export {
  participacaoParaCentesimos,
  centesimosParaParticipacao,
  derivarSituacaoSocio,
  sociosAtivosParaSoma,
  somaParticipacaoCentesimos,
  CEM_POR_CENTO,
  desvioParticipacao,
  participacaoExcedeCem,
  motivosExclusaoBloqueada,
  podeExcluirCadastro,
  acoesVisiveisSocio,
  campoSocioExigeTotal,
  podeEditarCampoSocio,
  dataEntradaValida,
  aporteConsistente,
  participacaoNoIntervalo,
} from './socios'
export type { SituacaoSocio, SocioResumo, MotivoExclusaoBloqueada, AcaoLinhaSocio } from './socios'

export {
  ehOProprio,
  podeAutenticar,
  mensagemLoginRecusado,
  bloqueiaAutoEdicaoParticipacao,
  bloqueiaAutoSaida,
  bloqueiaAutoExclusao,
  bloqueiaAutoPapel,
  bloqueiaAutoSuspensao,
  deixariaSemSocioAtivo,
  deixariaSemUsuarioSocioAtivo,
  papelSocioImutavel,
  precisaReautenticar,
  acessoConfiguracoesBloqueadoPor2fa,
  aviso2faPendente,
  migraUsuariosAntesDeExcluirPapel,
} from './salvaguardas'
export type { UsuarioResumo, SituacaoUsuario } from './salvaguardas'

export { casoVisivelPara, filtrarCasosPorResponsavel } from './casos'

export { ACOES_AUDITORIA, fraseAlteracaoCampo, confirmacaoComContexto } from './auditoria'
export type { AcaoAuditoria } from './auditoria'
