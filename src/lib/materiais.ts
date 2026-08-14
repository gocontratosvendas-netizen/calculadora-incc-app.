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

function kb(valor: number) {
  return valor * 1024
}

function urlPlaceholder(nome: string, formato: Formato) {
  return URL.createObjectURL(new Blob([nome], { type: MIME[formato] }))
}

const acervo: Material[] = [
  {
    id: 'mat-001',
    nome: 'Carta ao comprador',
    descricao:
      'Primeiro contato com o comprador de imóvel na planta. Explica a regra dos 36 meses e oferece a análise gratuita.',
    categoria: 'comercial',
    formato: 'docx',
    thumb: 'carta',
    tamanhoBytes: kb(48),
    atualizadoEm: '2026-08-10T09:00:00-03:00',
    url: urlPlaceholder('Carta ao comprador', 'docx'),
  },
  {
    id: 'mat-002',
    nome: 'Carta ao canal de originação',
    descricao:
      'Proposta de parceria para corretores, síndicos e assessorias. Use na primeira abordagem de um canal novo.',
    categoria: 'comercial',
    formato: 'docx',
    thumb: 'carta-bloco',
    tamanhoBytes: kb(46),
    atualizadoEm: '2026-08-09T11:20:00-03:00',
    url: urlPlaceholder('Carta ao canal de originação', 'docx'),
  },
  {
    id: 'mat-003',
    nome: 'ICP — Perfil de cliente ideal',
    descricao: 'Critérios de aceite e recusa de casos. Consulte antes de aprovar um contrato na triagem.',
    categoria: 'operacional',
    formato: 'docx',
    thumb: 'tabela',
    tamanhoBytes: kb(52),
    atualizadoEm: '2026-08-08T14:40:00-03:00',
    url: urlPlaceholder('ICP — Perfil de cliente ideal', 'docx'),
  },
  {
    id: 'mat-004',
    nome: 'Cartão de qualificação',
    descricao:
      'Cinco perguntas para o parceiro qualificar um caso sem entender a tese. Entregue impresso na reunião.',
    categoria: 'comercial',
    formato: 'pdf',
    thumb: 'checklist',
    tamanhoBytes: kb(120),
    atualizadoEm: '2026-08-07T16:15:00-03:00',
    url: urlPlaceholder('Cartão de qualificação', 'pdf'),
  },
  {
    id: 'mat-005',
    nome: 'Pedido de memorial à incorporadora',
    descricao:
      'Modelo para o cliente solicitar o memorial de cálculo. Envie quando ele não localizar o documento.',
    categoria: 'operacional',
    formato: 'docx',
    thumb: 'memorando',
    tamanhoBytes: kb(32),
    atualizadoEm: '2026-08-06T10:05:00-03:00',
    url: urlPlaceholder('Pedido de memorial à incorporadora', 'docx'),
  },
  {
    id: 'mat-006',
    nome: 'Tese jurídica — resumo',
    descricao:
      'Fundamentos dos arts. 46 e 47 e precedentes do TJSP. Base para a inicial e para reunião com escritório.',
    categoria: 'juridico',
    formato: 'pdf',
    thumb: 'relatorio',
    tamanhoBytes: kb(210),
    atualizadoEm: '2026-08-05T08:30:00-03:00',
    url: urlPlaceholder('Tese jurídica — resumo', 'pdf'),
  },
]

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

export async function listarMateriais(): Promise<Material[]> {
  await new Promise((resolve) => setTimeout(resolve, 400))
  return acervo.map((item) => ({ ...item })) // TODO: conectar ao backend
}

export async function criarMaterial(input: NovoMaterial): Promise<Material> {
  const formato = formatoDeArquivo(input.arquivo)
  if (!formato) {
    throw new Error('Formato inválido')
  }
  const criado: Material = {
    id: crypto.randomUUID(),
    nome: input.nome.trim(),
    descricao: input.descricao.trim(),
    categoria: input.categoria,
    formato,
    thumb: resolverThumb(input.thumb),
    tamanhoBytes: input.arquivo.size,
    atualizadoEm: new Date().toISOString(),
    url: URL.createObjectURL(input.arquivo),
  }
  acervo.unshift(criado)
  return { ...criado } // TODO: conectar ao backend
}
