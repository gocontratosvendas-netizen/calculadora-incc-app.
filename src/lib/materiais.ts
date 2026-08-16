import { supabase, uploadFile } from './supabase'

export type Categoria = 'comercial' | 'juridico' | 'operacional'
export type Formato = 'pdf' | 'docx' | 'xlsx'
export type ThumbVariant =
  | 'carta'
  | 'carta-bloco'
  | 'tabela'
  | 'checklist'
  | 'memorando'
  | 'relatorio'

export interface Material {
  id: string
  nome: string
  descricao: string
  categoria: Categoria
  formato: Formato
  thumb: ThumbVariant
  tamanhoBytes: number
  atualizadoEm: string
  url: string
}

export type NovoMaterial = {
  nome: string
  descricao: string
  categoria: Categoria
  thumb: ThumbVariant
  arquivo: File
}

export const THUMB_VARIANTES: ThumbVariant[] = [
  'carta',
  'carta-bloco',
  'tabela',
  'checklist',
  'memorando',
  'relatorio',
]

export const CATEGORIA_ROTULO: Record<Categoria, string> = {
  comercial: 'Comercial',
  juridico: 'Jurídico',
  operacional: 'Operacional',
}

const MIME: Record<Formato, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const LIMITE_BYTES = 20 * 1024 * 1024

export function resolverThumb(valor: string | undefined): ThumbVariant {
  if (
    valor === 'carta' ||
    valor === 'carta-bloco' ||
    valor === 'tabela' ||
    valor === 'checklist' ||
    valor === 'memorando' ||
    valor === 'relatorio'
  ) {
    return valor
  }
  return 'carta'
}

export function formatoDeArquivo(arquivo: File): Formato | null {
  const nome = arquivo.name.toLowerCase()
  if (nome.endsWith('.pdf')) return 'pdf'
  if (nome.endsWith('.docx')) return 'docx'
  if (nome.endsWith('.xlsx')) return 'xlsx'
  if (arquivo.type === MIME.pdf) return 'pdf'
  if (arquivo.type === MIME.docx) return 'docx'
  if (arquivo.type === MIME.xlsx) return 'xlsx'
  return null
}

export function arquivoExcedeLimite(arquivo: File) {
  return arquivo.size > LIMITE_BYTES
}

export function formatarTamanho(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${new Intl.NumberFormat('pt-BR').format(Math.round(bytes / 1024))} KB`
  }
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(bytes / (1024 * 1024))} MB`
}

export function formatarData(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

export function nomeArquivo(material: Material) {
  return `${material.nome}.${material.formato}`
}

type MaterialRow = {
  id: string
  nome: string
  descricao: string
  categoria: Categoria
  formato: Formato
  thumb: ThumbVariant
  tamanho_bytes: number
  atualizado_em: string
  url: string
  storage_path: string | null
}

function mapMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    categoria: row.categoria,
    formato: row.formato,
    thumb: row.thumb,
    tamanhoBytes: Number(row.tamanho_bytes),
    atualizadoEm: row.atualizado_em,
    url: row.url,
  }
}

export async function listarMateriais(): Promise<Material[]> {
  const { data, error } = await supabase
    .from('materiais')
    .select('*')
    .order('atualizado_em', { ascending: false })
  if (error) throw error
  return ((data ?? []) as MaterialRow[]).map(mapMaterial)
}

export async function criarMaterial(input: NovoMaterial): Promise<Material> {
  const formato = formatoDeArquivo(input.arquivo)
  if (!formato) throw new Error('Formato inválido')

  const id = crypto.randomUUID()
  const path = `${id}/${input.arquivo.name}`
  const uploaded = await uploadFile('materiais', path, input.arquivo)

  const { data, error } = await supabase
    .from('materiais')
    .insert({
      id,
      nome: input.nome.trim(),
      descricao: input.descricao.trim(),
      categoria: input.categoria,
      formato,
      thumb: resolverThumb(input.thumb),
      tamanho_bytes: input.arquivo.size,
      url: uploaded.url,
      storage_path: uploaded.path,
      atualizado_em: new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error) throw error
  return mapMaterial(data as MaterialRow)
}

export async function excluirMaterial(id: string): Promise<void> {
  const { data: existing } = await supabase
    .from('materiais')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('materiais').delete().eq('id', id)
  if (error) throw error

  if (existing?.storage_path) {
    await supabase.storage.from('materiais').remove([existing.storage_path])
  }
}
