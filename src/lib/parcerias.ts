export type EstagioParceria =
  | 'prospeccao'
  | 'em_negociacao'
  | 'ativa'
  | 'encerrada'

export type TipoParceiro =
  | 'imobiliaria'
  | 'administradora'
  | 'sindico'
  | 'assessoria_credito'
  | 'contabilidade'
  | 'outro'

export type ModeloComissao =
  | 'percentual_exito'
  | 'valor_fixo'
  | 'misto'
  | 'a_definir'

export interface Parceiro {
  id: string
  nome: string
  iniciais: string
  tipo: TipoParceiro
  detalhe: string | null
  documento: string | null
  contato: {
    pessoa: string
    cargo: string | null
    email: string | null
    telefone: string | null
  }
  estagio: EstagioParceria
  responsavel: { id: string; nome: string; iniciais: string }
  proximoPasso: string | null
  ultimoContatoEm: string | null
  encerradaEm: string | null
  observacoes: string | null
  comissionamento: {
    modelo: ModeloComissao
    percentual: number | null
    valorPorCaso: number | null
  }
  casosIndicados: number
  excessoOriginado: number
  criadoEm: string
}

export interface ParceriasResumo {
  parceirosAtivos: number
  emNegociacao: number
  casosIndicados: number
  excessoOriginado: number
}

export interface SocioParceria {
  id: string
  nome: string
  iniciais: string
}

export interface ParceiroInput {
  nome: string
  tipo: TipoParceiro
  detalhe: string | null
  documento: string | null
  contato: {
    pessoa: string
    cargo: string | null
    email: string | null
    telefone: string | null
  }
  estagio: EstagioParceria
  responsavelId: string
  proximoPasso: string | null
  ultimoContatoEm: string | null
  encerradaEm: string | null
  observacoes: string | null
  comissionamento: {
    modelo: ModeloComissao
    percentual: number | null
    valorPorCaso: number | null
  }
}

export const ESTAGIO_META: Record<
  EstagioParceria,
  { rotulo: string; bg: string; fg: string }
> = {
  prospeccao: { rotulo: 'Prospecção', bg: '#E6F1FB', fg: '#185FA5' },
  em_negociacao: { rotulo: 'Em negociação', bg: '#FAEEDA', fg: '#854F0B' },
  ativa: { rotulo: 'Ativa', bg: '#E1F5EE', fg: '#0F6E56' },
  encerrada: { rotulo: 'Encerrada', bg: '#F0F2F6', fg: '#5B6474' },
}

export const TIPO_ROTULO: Record<TipoParceiro, string> = {
  imobiliaria: 'Imobiliária',
  administradora: 'Administradora de condomínio',
  sindico: 'Síndico profissional',
  assessoria_credito: 'Assessoria de crédito',
  contabilidade: 'Contabilidade',
  outro: 'Outro',
}

export const MODELO_COMISSAO_ROTULO: Record<ModeloComissao, string> = {
  percentual_exito: 'Percentual sobre o êxito',
  valor_fixo: 'Valor fixo por caso',
  misto: 'Misto',
  a_definir: 'A definir',
}

export const socios: SocioParceria[] = [
  { id: 'usr-helena', nome: 'Helena Duarte', iniciais: 'HD' },
  { id: 'usr-vitor', nome: 'Vitor P.', iniciais: 'VP' },
  { id: 'usr-rafaela', nome: 'Rafaela Moura', iniciais: 'RM' },
  { id: 'usr-lucas', nome: 'Lucas Ferreira', iniciais: 'LF' },
]

export const usuarioAtualId = 'usr-helena'

const moneyFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const mesAnoFmt = new Intl.DateTimeFormat('pt-BR', {
  month: '2-digit',
  year: 'numeric',
})

function diasAtras(dias: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - dias)
  return d.toISOString()
}

function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function socioPorId(id: string): SocioParceria {
  return socios.find((s) => s.id === id) ?? socios[0]
}

let store: Parceiro[] = [
  {
    id: 'par-001',
    nome: 'Imobiliária Vega',
    iniciais: 'IV',
    tipo: 'imobiliaria',
    detalhe: 'Pinheiros, SP',
    documento: null,
    contato: {
      pessoa: 'Ana Vega',
      cargo: 'Diretora comercial',
      email: 'ana@vegaimob.com.br',
      telefone: '(11) 98888-1001',
    },
    estagio: 'ativa',
    responsavel: socioPorId('usr-rafaela'),
    proximoPasso: null,
    ultimoContatoEm: diasAtras(3),
    encerradaEm: null,
    observacoes: null,
    comissionamento: { modelo: 'percentual_exito', percentual: 10, valorPorCaso: null },
    casosIndicados: 12,
    excessoOriginado: 284_500,
    criadoEm: diasAtras(120),
  },
  {
    id: 'par-002',
    nome: 'Grupo Zenit',
    iniciais: 'GZ',
    tipo: 'administradora',
    detalhe: '42 condomínios',
    documento: null,
    contato: {
      pessoa: 'Marcos Zenit',
      cargo: 'Sócio',
      email: 'marcos@grupozenit.com.br',
      telefone: '(11) 97777-2002',
    },
    estagio: 'ativa',
    responsavel: socioPorId('usr-vitor'),
    proximoPasso: null,
    ultimoContatoEm: diasAtras(8),
    encerradaEm: null,
    observacoes: null,
    comissionamento: { modelo: 'misto', percentual: 8, valorPorCaso: 2500 },
    casosIndicados: 8,
    excessoOriginado: 196_200,
    criadoEm: diasAtras(90),
  },
  {
    id: 'par-003',
    nome: 'Assessoria Prime',
    iniciais: 'AP',
    tipo: 'assessoria_credito',
    detalhe: 'SP',
    documento: null,
    contato: {
      pessoa: 'Paula Prime',
      cargo: 'Sócia',
      email: 'paula@assessoriprime.com.br',
      telefone: null,
    },
    estagio: 'ativa',
    responsavel: socioPorId('usr-rafaela'),
    proximoPasso: null,
    ultimoContatoEm: diasAtras(1),
    encerradaEm: null,
    observacoes: null,
    comissionamento: { modelo: 'valor_fixo', percentual: null, valorPorCaso: 3000 },
    casosIndicados: 5,
    excessoOriginado: 112_800,
    criadoEm: diasAtras(60),
  },
  {
    id: 'par-004',
    nome: 'Costa & Lima',
    iniciais: 'CL',
    tipo: 'contabilidade',
    detalhe: 'carteira de investidores',
    documento: null,
    contato: {
      pessoa: 'Fernanda Costa',
      cargo: 'Sócia',
      email: 'fernanda@costalima.cont.br',
      telefone: '(11) 96666-4004',
    },
    estagio: 'em_negociacao',
    responsavel: socioPorId('usr-lucas'),
    proximoPasso: 'Proposta de comissionamento enviada. Retorno previsto para 20/08.',
    ultimoContatoEm: diasAtras(2),
    encerradaEm: null,
    observacoes: null,
    comissionamento: { modelo: 'a_definir', percentual: null, valorPorCaso: null },
    casosIndicados: 0,
    excessoOriginado: 0,
    criadoEm: diasAtras(20),
  },
  {
    id: 'par-005',
    nome: 'Ricardo Alves',
    iniciais: 'RA',
    tipo: 'sindico',
    detalhe: '9 prédios',
    documento: null,
    contato: {
      pessoa: 'Ricardo Alves',
      cargo: null,
      email: null,
      telefone: '(11) 95555-5005',
    },
    estagio: 'prospeccao',
    responsavel: socioPorId('usr-vitor'),
    proximoPasso: 'Carta de parceria enviada. Aguardando primeira reunião.',
    ultimoContatoEm: diasAtras(5),
    encerradaEm: null,
    observacoes: null,
    comissionamento: { modelo: 'a_definir', percentual: null, valorPorCaso: null },
    casosIndicados: 0,
    excessoOriginado: 0,
    criadoEm: diasAtras(12),
  },
  {
    id: 'par-006',
    nome: 'Imobiliária Horizonte',
    iniciais: 'IH',
    tipo: 'imobiliaria',
    detalhe: 'Santo Amaro, SP',
    documento: null,
    contato: {
      pessoa: 'João Horizonte',
      cargo: 'Gerente',
      email: 'joao@horizonteimob.com.br',
      telefone: '(11) 94444-6006',
    },
    estagio: 'encerrada',
    responsavel: socioPorId('usr-lucas'),
    proximoPasso: null,
    ultimoContatoEm: '2026-04-15T12:00:00.000Z',
    encerradaEm: '2026-04-15T12:00:00.000Z',
    observacoes: null,
    comissionamento: { modelo: 'percentual_exito', percentual: 10, valorPorCaso: null },
    casosIndicados: 3,
    excessoOriginado: 64_300,
    criadoEm: diasAtras(400),
  },
]

function delay(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function calcularResumo(lista: Parceiro[]): ParceriasResumo {
  return {
    parceirosAtivos: lista.filter((p) => p.estagio === 'ativa').length,
    emNegociacao: lista.filter((p) => p.estagio === 'em_negociacao').length,
    casosIndicados: lista.reduce((acc, p) => acc + p.casosIndicados, 0),
    excessoOriginado: lista.reduce((acc, p) => acc + p.excessoOriginado, 0),
  }
}

function montarParceiro(id: string, input: ParceiroInput, existente?: Parceiro): Parceiro {
  const responsavel = socioPorId(input.responsavelId)
  return {
    id,
    nome: input.nome.trim(),
    iniciais: iniciaisDe(input.nome),
    tipo: input.tipo,
    detalhe: input.detalhe?.trim() || null,
    documento: input.documento?.trim() || null,
    contato: {
      pessoa: input.contato.pessoa.trim(),
      cargo: input.contato.cargo?.trim() || null,
      email: input.contato.email?.trim() || null,
      telefone: input.contato.telefone?.trim() || null,
    },
    estagio: input.estagio,
    responsavel,
    proximoPasso: input.proximoPasso?.trim() || null,
    ultimoContatoEm: input.ultimoContatoEm,
    encerradaEm: input.estagio === 'encerrada' ? input.encerradaEm : null,
    observacoes: input.observacoes?.trim() || null,
    comissionamento: {
      modelo: input.comissionamento.modelo,
      percentual:
        input.comissionamento.modelo === 'percentual_exito' ||
        input.comissionamento.modelo === 'misto'
          ? input.comissionamento.percentual
          : null,
      valorPorCaso:
        input.comissionamento.modelo === 'valor_fixo' ||
        input.comissionamento.modelo === 'misto'
          ? input.comissionamento.valorPorCaso
          : null,
    },
    casosIndicados: existente?.casosIndicados ?? 0,
    excessoOriginado: existente?.excessoOriginado ?? 0,
    criadoEm: existente?.criadoEm ?? new Date().toISOString(),
  }
}

export function formatarMoeda(valor: number): string {
  return moneyFmt.format(valor)
}

export function formatarTempoRelativo(iso: string | null): string {
  if (!iso) return '—'
  const alvo = new Date(iso)
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  const ref = new Date(alvo)
  ref.setHours(12, 0, 0, 0)
  const diffDias = Math.round((hoje.getTime() - ref.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDias <= 0) return 'hoje'
  if (diffDias === 1) return 'ontem'
  if (diffDias < 30) return `há ${diffDias} dias`
  const meses = Math.max(1, Math.round(diffDias / 30))
  return meses === 1 ? 'há 1 mês' : `há ${meses} meses`
}

export function formatarEncerradaEm(iso: string | null): string {
  if (!iso) return 'encerrada'
  return `encerrada em ${mesAnoFmt.format(new Date(iso))}`
}

export function formatarDataInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function hojeIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dataInputParaIso(value: string): string | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString()
}

export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function mascararDocumento(valor: string): string {
  const digitos = soDigitos(valor).slice(0, 14)
  if (digitos.length <= 11) {
    return digitos
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return digitos
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function mascararTelefone(valor: string): string {
  const digitos = soDigitos(valor).slice(0, 11)
  if (digitos.length <= 10) {
    return digitos
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digitos
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

function calcularDigito(base: string, pesos: number[]): number {
  const soma = base.split('').reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

export function validarCpf(digitos: string): boolean {
  if (digitos.length !== 11 || /^(\d)\1+$/.test(digitos)) return false
  const d1 = calcularDigito(digitos.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = calcularDigito(digitos.slice(0, 9) + d1, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return digitos === digitos.slice(0, 9) + String(d1) + String(d2)
}

export function validarCnpj(digitos: string): boolean {
  if (digitos.length !== 14 || /^(\d)\1+$/.test(digitos)) return false
  const d1 = calcularDigito(
    digitos.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  )
  const d2 = calcularDigito(
    digitos.slice(0, 12) + d1,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  )
  return digitos === digitos.slice(0, 12) + String(d1) + String(d2)
}

export function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function listarParceiros(): Promise<Parceiro[]> {
  await delay()
  return store.map((p) => ({ ...p, contato: { ...p.contato }, responsavel: { ...p.responsavel }, comissionamento: { ...p.comissionamento } })) // TODO: conectar ao backend
}

export async function obterResumoParcerias(): Promise<ParceriasResumo> {
  await delay()
  return calcularResumo(store) // TODO: conectar ao backend
}

export async function criarParceiro(input: ParceiroInput): Promise<Parceiro> {
  await delay(320)
  const criado = montarParceiro(`par-${Date.now()}`, input)
  store = [criado, ...store]
  return { ...criado, contato: { ...criado.contato }, responsavel: { ...criado.responsavel }, comissionamento: { ...criado.comissionamento } } // TODO: conectar ao backend
}

export async function atualizarParceiro(
  id: string,
  input: ParceiroInput,
): Promise<Parceiro> {
  await delay(320)
  const idx = store.findIndex((p) => p.id === id)
  if (idx < 0) throw new Error('Parceiro não encontrado')
  const atualizado = montarParceiro(id, input, store[idx])
  store = store.map((p) => (p.id === id ? atualizado : p))
  return { ...atualizado, contato: { ...atualizado.contato }, responsavel: { ...atualizado.responsavel }, comissionamento: { ...atualizado.comissionamento } } // TODO: conectar ao backend
}

export async function excluirParceiro(id: string): Promise<void> {
  await delay(220)
  const idx = store.findIndex((p) => p.id === id)
  if (idx < 0) throw new Error('Parceiro não encontrado')
  store = store.filter((p) => p.id !== id)
  return // TODO: conectar ao backend
}
