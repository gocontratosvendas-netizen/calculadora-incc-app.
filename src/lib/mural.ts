export type PostTipo = 'usuario' | 'atualizacao'
export type PapelUsuario = 'socio' | 'advogado'

export interface Usuario {
  id: string
  nome: string
  iniciais: string
  papel: PapelUsuario
}

export interface Mencao {
  usuarioId: string | 'todos'
  offset: number
  length: number
}

export interface Comentario {
  id: string
  autor: Usuario
  texto: string
  criadoEm: string
}

export interface CasoVinculado {
  id: string
  cliente: string
  empreendimento: string
  status: string
  excesso: number | null
}

export interface AnexoPost {
  id: string
  nome: string
  formato: string
  tamanhoBytes: number
  versao?: string
  url: string
}

export interface Post {
  id: string
  tipo: PostTipo
  autor: Usuario | null
  texto: string
  mencoes: Mencao[]
  casoVinculado: CasoVinculado | null
  anexo: AnexoPost | null
  restritoASocios: boolean
  curtidas: number
  curtidoPorMim: boolean
  comentarios: Comentario[]
  totalComentarios: number
  criadoEm: string
}

export interface PublicarPostInput {
  texto: string
  mencoes: Mencao[]
  casoVinculado: CasoVinculado | null
  anexo: AnexoPost | null
  restritoASocios: boolean
}

export interface ListarPostsResultado {
  posts: Post[]
  nextCursor: string | null
}

export interface Marcacao {
  id: string
  postId: string
  autor: Usuario
  resumo: string
  lida: boolean
}

export type ItemAtencao =
  | { id: string; tipo: 'revisao'; quantidade: number; href: string }
  | { id: string; tipo: 'prescricao'; cliente: string; meses: number; href: string }
  | { id: string; tipo: 'memorial'; quantidade: number; href: string }

const PAGE_SIZE = 20

export const usuarioAtual: Usuario = {
  id: 'usr-vitor',
  nome: 'Vitor P.',
  iniciais: 'VP',
  papel: 'socio',
}

export const equipe: Usuario[] = [
  usuarioAtual,
  { id: 'usr-rafaela', nome: 'Rafaela Moura', iniciais: 'RM', papel: 'socio' },
  { id: 'usr-lucas', nome: 'Lucas Ferreira', iniciais: 'LF', papel: 'advogado' },
  { id: 'usr-helena', nome: 'Helena Duarte', iniciais: 'HD', papel: 'socio' },
  { id: 'usr-camila', nome: 'Camila Barros', iniciais: 'CB', papel: 'advogado' },
  { id: 'usr-paulo', nome: 'Paulo Mendes', iniciais: 'PM', papel: 'advogado' },
]

const rafaela = equipe.find((item) => item.id === 'usr-rafaela') ?? usuarioAtual
const lucas = equipe.find((item) => item.id === 'usr-lucas') ?? usuarioAtual

const agora = Date.now()
const hora = 60 * 60 * 1000
const ontem = new Date(agora)
ontem.setDate(ontem.getDate() - 1)
ontem.setHours(16, 20, 0, 0)

const TEXTO_1 =
  '@Vitor a Kallas contestou alegando que os 37 meses foram livremente pactuados. Alguém já enfrentou essa defesa? Subo a contestação na base hoje.'
const TEXTO_3 =
  'Subi a nova versão da carta ao comprador em Materiais. O memorial virou documento obrigatório, não mais opcional. @todos usem essa daqui pra frente.'

const anexoCartaUrl = URL.createObjectURL(
  new Blob(['Carta ao comprador'], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }),
)

const postsIniciais: Post[] = [
  {
    id: 'post-1',
    tipo: 'usuario',
    autor: rafaela,
    texto: TEXTO_1,
    mencoes: [{ usuarioId: usuarioAtual.id, offset: 0, length: 6 }],
    casoVinculado: {
      id: 'caso-002',
      cliente: 'Erika Tanaka',
      empreendimento: 'Vila Nova 1200',
      status: 'Ajuizado',
      excesso: 34_820,
    },
    anexo: null,
    restritoASocios: false,
    curtidas: 3,
    curtidoPorMim: false,
    comentarios: [
      {
        id: 'c-1-1',
        autor: usuarioAtual,
        texto: 'Mesma tese no caso Costa. O juiz não acolheu — mando a sentença ainda hoje.',
        criadoEm: new Date(agora - 1.2 * hora).toISOString(),
      },
    ],
    totalComentarios: 2,
    criadoEm: new Date(agora - 2 * hora).toISOString(),
  },
  {
    id: 'post-2',
    tipo: 'atualizacao',
    autor: null,
    texto: 'Sentença favorável em Helena Costa · Reserva Ipê. Devolução em dobro deferida: R$ 54.300.',
    mencoes: [],
    casoVinculado: {
      id: 'caso-005',
      cliente: 'Helena Costa',
      empreendimento: 'Reserva Ipê',
      status: 'Ajuizado',
      excesso: 27_150,
    },
    anexo: null,
    restritoASocios: false,
    curtidas: 4,
    curtidoPorMim: false,
    comentarios: [],
    totalComentarios: 0,
    criadoEm: new Date(agora - 5 * hora).toISOString(),
  },
  {
    id: 'post-3',
    tipo: 'usuario',
    autor: lucas,
    texto: TEXTO_3,
    mencoes: [{ usuarioId: 'todos', offset: TEXTO_3.indexOf('@todos'), length: 6 }],
    casoVinculado: null,
    anexo: {
      id: 'anexo-1',
      nome: 'Carta ao comprador',
      formato: 'DOCX',
      tamanhoBytes: 48 * 1024,
      versao: 'v2',
      url: anexoCartaUrl,
    },
    restritoASocios: false,
    curtidas: 5,
    curtidoPorMim: false,
    comentarios: [],
    totalComentarios: 0,
    criadoEm: ontem.toISOString(),
  },
]

const marcacoesIniciais: Marcacao[] = [
  {
    id: 'marc-1',
    postId: 'post-1',
    autor: rafaela,
    resumo: 'sobre a defesa da Kallas',
    lida: false,
  },
  {
    id: 'marc-2',
    postId: 'post-3',
    autor: lucas,
    resumo: 'sobre a revisão do ICP',
    lida: false,
  },
]

const itensAtencao: ItemAtencao[] = [
  { id: 'at-revisao', tipo: 'revisao', quantidade: 3, href: '/casos?atencao=revisao' },
  { id: 'at-prescricao', tipo: 'prescricao', cliente: 'Ribeiro', meses: 4, href: '/casos/caso-003' },
  { id: 'at-memorial', tipo: 'memorial', quantidade: 2, href: '/casos?atencao=memorial' },
]

const store = {
  posts: postsIniciais.map((post) => ({ ...post, comentarios: [...post.comentarios] })),
  marcacoes: marcacoesIniciais.map((item) => ({ ...item })),
}

function visiveisPara(usuario: Usuario) {
  return store.posts.filter((post) => !post.restritoASocios || usuario.papel === 'socio')
}

function clonarPost(post: Post): Post {
  return {
    ...post,
    mencoes: [...post.mencoes],
    casoVinculado: post.casoVinculado ? { ...post.casoVinculado } : null,
    anexo: post.anexo ? { ...post.anexo } : null,
    comentarios: post.comentarios.map((comentario) => ({ ...comentario })),
  }
}

export function rotuloMencao(usuario: { id: string | 'todos'; nome: string }): string {
  if (usuario.id === 'todos') return 'todos'
  return usuario.nome.split(/\s+/)[0].replace(/\.$/, '')
}

export function rotuloPapel(usuario: Usuario): string {
  const feminino = new Set(['usr-rafaela', 'usr-helena', 'usr-camila'])
  if (usuario.papel === 'socio') return feminino.has(usuario.id) ? 'sócia' : 'sócio'
  return feminino.has(usuario.id) ? 'advogada' : 'advogado'
}

export function primeiroNome(usuario: Usuario): string {
  return usuario.nome.split(/\s+/)[0].replace(/\.$/, '')
}

export function usuarioPorId(id: string | 'todos'): Usuario | null {
  if (id === 'todos') return null
  return equipe.find((item) => item.id === id) ?? null
}

export function obterMarcacoesNaoLidas(): Marcacao[] {
  return store.marcacoes.filter((item) => !item.lida).map((item) => ({ ...item }))
}

export function obterItensAtencao(): ItemAtencao[] {
  return [...itensAtencao]
}

export async function listarPosts(cursor?: string): Promise<ListarPostsResultado> {
  const lista = visiveisPara(usuarioAtual)
  const inicio = cursor ? lista.findIndex((post) => post.id === cursor) + 1 : 0
  const pagina = lista.slice(Math.max(0, inicio), Math.max(0, inicio) + PAGE_SIZE)
  const ultimo = pagina[pagina.length - 1]
  const nextCursor =
    ultimo && inicio + PAGE_SIZE < lista.length ? ultimo.id : null
  return { posts: pagina.map(clonarPost), nextCursor } // TODO: conectar ao backend
}

export async function publicarPost(input: PublicarPostInput): Promise<Post> {
  const post: Post = {
    id: `post-${crypto.randomUUID()}`,
    tipo: 'usuario',
    autor: usuarioAtual,
    texto: input.texto,
    mencoes: input.mencoes.map((item) => ({ ...item })),
    casoVinculado: input.casoVinculado ? { ...input.casoVinculado } : null,
    anexo: input.anexo ? { ...input.anexo } : null,
    restritoASocios: input.restritoASocios,
    curtidas: 0,
    curtidoPorMim: false,
    comentarios: [],
    totalComentarios: 0,
    criadoEm: new Date().toISOString(),
  }
  store.posts.unshift(post)
  return clonarPost(post) // TODO: conectar ao backend
}

export async function curtirPost(id: string): Promise<void> {
  const post = store.posts.find((item) => item.id === id)
  if (!post) throw new Error('Post não encontrado')
  post.curtidoPorMim = !post.curtidoPorMim
  post.curtidas += post.curtidoPorMim ? 1 : -1
  return // TODO: conectar ao backend
}

export async function comentar(postId: string, texto: string): Promise<Comentario> {
  const post = store.posts.find((item) => item.id === postId)
  if (!post) throw new Error('Post não encontrado')
  const comentario: Comentario = {
    id: `c-${crypto.randomUUID()}`,
    autor: usuarioAtual,
    texto,
    criadoEm: new Date().toISOString(),
  }
  post.comentarios = [comentario, ...post.comentarios]
  post.totalComentarios += 1
  return { ...comentario } // TODO: conectar ao backend
}

export async function marcarMencoesComoLidas(postId?: string): Promise<void> {
  for (const item of store.marcacoes) {
    if (!postId || item.postId === postId) item.lida = true
  }
  return // TODO: conectar ao backend
}
