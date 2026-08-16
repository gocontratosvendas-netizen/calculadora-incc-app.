import { getSessionUserId, listProfiles, supabase, type Profile } from './supabase'

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

export let socios: SocioParceria[] = []
export let usuarioAtualId = ''

export async function carregarSociosParceria(): Promise<SocioParceria[]> {
  const profiles = await listProfiles()
  socios = profiles
    .filter((p) => p.papel === 'socio')
    .map((p) => ({ id: p.id, nome: p.nome, iniciais: p.iniciais }))
  if (socios.length === 0) {
    socios = profiles.map((p) => ({ id: p.id, nome: p.nome, iniciais: p.iniciais }))
  }
  try {
    usuarioAtualId = await getSessionUserId()
  } catch {
    usuarioAtualId = socios[0]?.id ?? ''
  }
  return socios
}

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

function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

type ParceiroRow = {
  id: string
  nome: string
  iniciais: string
  tipo: TipoParceiro
  detalhe: string | null
  documento: string | null
  contato_pessoa: string
  contato_cargo: string | null
  contato_email: string | null
  contato_telefone: string | null
  estagio: EstagioParceria
  responsavel_id: string
  proximo_passo: string | null
  ultimo_contato_em: string | null
  encerrada_em: string | null
  observacoes: string | null
  comissao_modelo: ModeloComissao
  comissao_percentual: number | null
  comissao_valor_por_caso: number | null
  casos_indicados: number
  excesso_originado: number
  criado_em: string
  responsavel?: Profile | Profile[] | null
}

function mapParceiro(row: ParceiroRow): Parceiro {
  const responsavel = one(row.responsavel)
  return {
    id: row.id,
    nome: row.nome,
    iniciais: row.iniciais,
    tipo: row.tipo,
    detalhe: row.detalhe,
    documento: row.documento,
    contato: {
      pessoa: row.contato_pessoa,
      cargo: row.contato_cargo,
      email: row.contato_email,
      telefone: row.contato_telefone,
    },
    estagio: row.estagio,
    responsavel: {
      id: responsavel?.id ?? row.responsavel_id,
      nome: responsavel?.nome ?? '—',
      iniciais: responsavel?.iniciais ?? '—',
    },
    proximoPasso: row.proximo_passo,
    ultimoContatoEm: row.ultimo_contato_em,
    encerradaEm: row.encerrada_em,
    observacoes: row.observacoes,
    comissionamento: {
      modelo: row.comissao_modelo,
      percentual: row.comissao_percentual != null ? Number(row.comissao_percentual) : null,
      valorPorCaso:
        row.comissao_valor_por_caso != null ? Number(row.comissao_valor_por_caso) : null,
    },
    casosIndicados: row.casos_indicados,
    excessoOriginado: Number(row.excesso_originado),
    criadoEm: row.criado_em,
  }
}

function calcularResumo(lista: Parceiro[]): ParceriasResumo {
  return {
    parceirosAtivos: lista.filter((p) => p.estagio === 'ativa').length,
    emNegociacao: lista.filter((p) => p.estagio === 'em_negociacao').length,
    casosIndicados: lista.reduce((acc, p) => acc + p.casosIndicados, 0),
    excessoOriginado: lista.reduce((acc, p) => acc + p.excessoOriginado, 0),
  }
}

function rowFromInput(id: string, input: ParceiroInput) {
  return {
    id,
    nome: input.nome.trim(),
    iniciais: iniciaisDe(input.nome),
    tipo: input.tipo,
    detalhe: input.detalhe?.trim() || null,
    documento: input.documento?.trim() || null,
    contato_pessoa: input.contato.pessoa.trim(),
    contato_cargo: input.contato.cargo?.trim() || null,
    contato_email: input.contato.email?.trim() || null,
    contato_telefone: input.contato.telefone?.trim() || null,
    estagio: input.estagio,
    responsavel_id: input.responsavelId,
    proximo_passo: input.proximoPasso?.trim() || null,
    ultimo_contato_em: input.ultimoContatoEm,
    encerrada_em: input.estagio === 'encerrada' ? input.encerradaEm : null,
    observacoes: input.observacoes?.trim() || null,
    comissao_modelo: input.comissionamento.modelo,
    comissao_percentual:
      input.comissionamento.modelo === 'percentual_exito' ||
      input.comissionamento.modelo === 'misto'
        ? input.comissionamento.percentual
        : null,
    comissao_valor_por_caso:
      input.comissionamento.modelo === 'valor_fixo' || input.comissionamento.modelo === 'misto'
        ? input.comissionamento.valorPorCaso
        : null,
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

const SELECT =
  '*, responsavel:profiles!parceiros_responsavel_id_fkey(id, nome, iniciais)'

export async function listarParceiros(): Promise<Parceiro[]> {
  await carregarSociosParceria()
  const { data, error } = await supabase
    .from('parceiros')
    .select(SELECT)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return ((data ?? []) as ParceiroRow[]).map(mapParceiro)
}

export async function obterResumoParcerias(): Promise<ParceriasResumo> {
  const lista = await listarParceiros()
  return calcularResumo(lista)
}

export async function criarParceiro(input: ParceiroInput): Promise<Parceiro> {
  const id = `par-${crypto.randomUUID()}`
  const { data, error } = await supabase
    .from('parceiros')
    .insert({ ...rowFromInput(id, input), casos_indicados: 0, excesso_originado: 0 })
    .select(SELECT)
    .single()
  if (error) throw error
  return mapParceiro(data as ParceiroRow)
}

export async function atualizarParceiro(
  id: string,
  input: ParceiroInput,
): Promise<Parceiro> {
  const { data, error } = await supabase
    .from('parceiros')
    .update(rowFromInput(id, input))
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw error
  return mapParceiro(data as ParceiroRow)
}

export async function excluirParceiro(id: string): Promise<void> {
  const { error } = await supabase.from('parceiros').delete().eq('id', id)
  if (error) throw error
}
