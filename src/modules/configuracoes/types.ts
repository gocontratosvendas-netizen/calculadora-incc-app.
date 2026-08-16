import type {
  AcaoAuditoria,
  MapaPermissoes,
  NivelPermissao,
  Recurso,
  SituacaoSocio,
  SituacaoUsuario,
} from './autorizacao'

export type { Recurso, NivelPermissao, MapaPermissoes, SituacaoSocio, SituacaoUsuario, AcaoAuditoria }

export interface Socio {
  id: string
  usuarioId: string | null
  nomeCompleto: string
  cpfMascarado: string
  email: string
  telefone?: string
  participacao: number
  aporteComprometido: number
  aporteIntegralizado: number
  dataEntrada: string
  dataSaida: string | null
  motivoSaida?: string
  situacao: SituacaoSocio
  observacao?: string
  deletadoEm: string | null
  criadoEm: string
  atualizadoEm: string
  podeExcluir: boolean
}

export interface SocioInput {
  nomeCompleto: string
  cpf: string
  email: string
  telefone?: string
  participacao: number
  aporteComprometido: number
  aporteIntegralizado: number
  dataEntrada: string
  observacao?: string
  usuarioId?: string | null
  convidarConta?: boolean
}

export interface Usuario {
  id: string
  nome: string
  email: string
  papelId: string
  situacao: SituacaoUsuario
  doisFatoresAtivo: boolean
  ultimoAcesso: string | null
  convidadoPor: string | null
  criadoEm: string
  atualizadoEm: string
}

export interface UsuarioSessao {
  id: string
  nome: string
  email: string
  papelId: string
  papelNome: string
  situacao: SituacaoUsuario
  doisFatoresAtivo: boolean
  doisFatoresDesde: string | null
  permissoes: MapaPermissoes
  ultimaReauthEm: string | null
  iniciais: string
}

export interface Papel {
  id: string
  nome: string
  descricao: string
  imutavel: boolean
  permissoes: MapaPermissoes
  usuariosVinculados: number
}

export interface RegistroAuditoria {
  id: string
  autorId: string
  autorNome: string
  acao: AcaoAuditoria
  modulo: string
  entidade: string
  entidadeId: string
  descricao: string
  valorAnterior: unknown | null
  valorNovo: unknown | null
  ip: string | null
  criadoEm: string
}

export interface ResumoSocios {
  ativos: number
  participacaoCentesimos: number
  aportado: number
  pendente: number
}

export type FiltrosAuditoria = {
  autorId?: string
  acao?: AcaoAuditoria
  modulo?: string
  entidade?: string
  busca?: string
  de?: string
  ate?: string
}
