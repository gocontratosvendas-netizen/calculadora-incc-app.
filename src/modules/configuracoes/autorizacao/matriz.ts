import {
  PAPEIS_SISTEMA,
  RECURSOS,
  type MapaPermissoes,
  type NivelPermissao,
  type PapelSistema,
  type Recurso,
} from './recursos'

const N: NivelPermissao = 'nenhum'
const L: NivelPermissao = 'ler'
const E: NivelPermissao = 'editar'
const T: NivelPermissao = 'total'

export const MATRIZ_PADRAO: Record<PapelSistema, MapaPermissoes> = {
  socio: {
    calculadora: T,
    casos: T,
    parcerias: T,
    documentos: T,
    'financeiro.lancamentos': T,
    'financeiro.dre': T,
    'configuracoes.socios': T,
    'configuracoes.usuarios': T,
    'configuracoes.auditoria': L,
  },
  financeiro: {
    calculadora: L,
    casos: L,
    parcerias: L,
    documentos: L,
    'financeiro.lancamentos': T,
    'financeiro.dre': L,
    'configuracoes.socios': N,
    'configuracoes.usuarios': N,
    'configuracoes.auditoria': N,
  },
  operacao: {
    calculadora: T,
    casos: E,
    parcerias: E,
    documentos: E,
    'financeiro.lancamentos': N,
    'financeiro.dre': N,
    'configuracoes.socios': N,
    'configuracoes.usuarios': N,
    'configuracoes.auditoria': N,
  },
  parceiro_juridico: {
    calculadora: L,
    casos: E,
    parcerias: N,
    documentos: E,
    'financeiro.lancamentos': N,
    'financeiro.dre': N,
    'configuracoes.socios': N,
    'configuracoes.usuarios': N,
    'configuracoes.auditoria': N,
  },
  leitura: {
    calculadora: L,
    casos: L,
    parcerias: L,
    documentos: L,
    'financeiro.lancamentos': N,
    'financeiro.dre': N,
    'configuracoes.socios': N,
    'configuracoes.usuarios': N,
    'configuracoes.auditoria': N,
  },
}

export const DESCRICAO_PAPEIS: Record<PapelSistema, { nome: string; descricao: string }> = {
  socio: {
    nome: 'Sócio',
    descricao: 'Acesso total, incluindo configurações e financeiro. Imutável.',
  },
  financeiro: {
    nome: 'Financeiro',
    descricao: 'Lança e concilia; vê a DRE em leitura.',
  },
  operacao: {
    nome: 'Operação',
    descricao: 'Calculadora, casos, parcerias e documentos. Sem acesso a dado financeiro.',
  },
  parceiro_juridico: {
    nome: 'Parceiro jurídico',
    descricao: 'Acesso externo restrito aos casos em que é responsável.',
  },
  leitura: {
    nome: 'Leitura',
    descricao: 'Consulta sem alteração, sem financeiro.',
  },
}

export function mapaVazio(): MapaPermissoes {
  return Object.fromEntries(RECURSOS.map((r) => [r, 'nenhum'])) as MapaPermissoes
}

export function mapaDePapel(papelId: string, custom?: Partial<MapaPermissoes>): MapaPermissoes {
  const base = isPapelSistema(papelId) ? MATRIZ_PADRAO[papelId] : mapaVazio()
  return { ...base, ...custom }
}

export function isPapelSistema(id: string): id is PapelSistema {
  return (PAPEIS_SISTEMA as readonly string[]).includes(id)
}

export function recursoConhecido(valor: string): valor is Recurso {
  return (RECURSOS as readonly string[]).includes(valor)
}
