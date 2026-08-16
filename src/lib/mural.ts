import { getSessionUserId, listProfiles, supabase, uploadFile, type Profile } from './supabase'

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
  /** Quando omitido, assume post de usuário. Use 'atualizacao' para posts do sistema. */
  tipo?: PostTipo
  anexoFile?: File | null
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

function profileToUsuario(p: Profile): Usuario {
  return { id: p.id, nome: p.nome, iniciais: p.iniciais, papel: p.papel }
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

let equipeCache: Usuario[] | null = null

export async function carregarEquipe(): Promise<Usuario[]> {
  const profiles = await listProfiles()
  equipeCache = profiles.map(profileToUsuario)
  equipe = equipeCache
  return equipeCache
}

export async function carregarUsuarioAtual(): Promise<Usuario> {
  const id = await getSessionUserId()
  const lista = equipeCache ?? (await carregarEquipe())
  const found = lista.find((u) => u.id === id)
  if (!found) throw new Error('Perfil não encontrado')
  usuarioAtual = found
  return found
}

/** Compat: arrays sincronizados após carregarEquipe / carregarUsuarioAtual */
export let usuarioAtual: Usuario = {
  id: '',
  nome: '…',
  iniciais: '…',
  papel: 'advogado',
}

export let equipe: Usuario[] = []

export function rotuloMencao(usuario: { id: string | 'todos'; nome: string }): string {
  if (usuario.id === 'todos') return 'todos'
  return usuario.nome.split(/\s+/)[0].replace(/\.$/, '')
}

export function rotuloPapel(usuario: Usuario): string {
  const feminino = /a$/i.test(usuario.nome.split(/\s+/)[0] ?? '') ||
    ['Rafaela', 'Helena', 'Camila'].some((n) => usuario.nome.startsWith(n))
  if (usuario.papel === 'socio') return feminino ? 'sócia' : 'sócio'
  return feminino ? 'advogada' : 'advogado'
}

export function primeiroNome(usuario: Usuario): string {
  return usuario.nome.split(/\s+/)[0].replace(/\.$/, '')
}

export function usuarioPorId(id: string | 'todos'): Usuario | null {
  if (id === 'todos') return null
  return equipe.find((item) => item.id === id) ?? null
}

type PostRow = {
  id: string
  tipo: PostTipo
  autor_id: string | null
  texto: string
  caso_snapshot: CasoVinculado | null
  anexo_id: string | null
  anexo_nome: string | null
  anexo_formato: string | null
  anexo_tamanho_bytes: number | null
  anexo_versao: string | null
  anexo_url: string | null
  restrito_a_socios: boolean
  criado_em: string
  autor?: Profile | Profile[] | null
}

async function hydratePosts(rows: PostRow[], userId: string): Promise<Post[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const [{ data: mencoes }, { data: comentarios }, { data: curtidas }] = await Promise.all([
    supabase.from('post_mencoes').select('*').in('post_id', ids),
    supabase
      .from('comentarios')
      .select('*, autor:profiles!comentarios_autor_id_fkey(id, nome, iniciais, papel)')
      .in('post_id', ids)
      .order('criado_em', { ascending: false }),
    supabase.from('post_curtidas').select('post_id, usuario_id').in('post_id', ids),
  ])

  const mencoesByPost = new Map<string, Mencao[]>()
  for (const m of mencoes ?? []) {
    const list = mencoesByPost.get(m.post_id) ?? []
    list.push({
      usuarioId: m.usuario_id as string | 'todos',
      offset: m.offset_start,
      length: m.length,
    })
    mencoesByPost.set(m.post_id, list)
  }

  const comentariosByPost = new Map<string, Comentario[]>()
  for (const c of comentarios ?? []) {
    const autor = one(c.autor as Profile | Profile[] | null)
    const list = comentariosByPost.get(c.post_id) ?? []
    list.push({
      id: c.id,
      autor: autor
        ? profileToUsuario(autor)
        : { id: c.autor_id, nome: '—', iniciais: '—', papel: 'advogado' },
      texto: c.texto,
      criadoEm: c.criado_em,
    })
    comentariosByPost.set(c.post_id, list)
  }

  const curtidasCount = new Map<string, number>()
  const curtidoPorMim = new Set<string>()
  for (const c of curtidas ?? []) {
    curtidasCount.set(c.post_id, (curtidasCount.get(c.post_id) ?? 0) + 1)
    if (c.usuario_id === userId) curtidoPorMim.add(c.post_id)
  }

  return rows.map((row) => {
    const autorProfile = one(row.autor)
    const comentariosPost = comentariosByPost.get(row.id) ?? []
    return {
      id: row.id,
      tipo: row.tipo,
      autor: autorProfile ? profileToUsuario(autorProfile) : null,
      texto: row.texto,
      mencoes: mencoesByPost.get(row.id) ?? [],
      casoVinculado: row.caso_snapshot,
      anexo:
        row.anexo_id && row.anexo_nome && row.anexo_url
          ? {
              id: row.anexo_id,
              nome: row.anexo_nome,
              formato: row.anexo_formato ?? '',
              tamanhoBytes: Number(row.anexo_tamanho_bytes ?? 0),
              versao: row.anexo_versao ?? undefined,
              url: row.anexo_url,
            }
          : null,
      restritoASocios: row.restrito_a_socios,
      curtidas: curtidasCount.get(row.id) ?? 0,
      curtidoPorMim: curtidoPorMim.has(row.id),
      comentarios: comentariosPost.slice(0, 5),
      totalComentarios: comentariosPost.length,
      criadoEm: row.criado_em,
    }
  })
}

export function obterMarcacoesNaoLidas(): Marcacao[] {
  return []
}

export async function listarMarcacoesNaoLidas(): Promise<Marcacao[]> {
  const userId = await getSessionUserId()
  const { data, error } = await supabase
    .from('marcacoes')
    .select('*, autor:profiles!marcacoes_autor_id_fkey(id, nome, iniciais, papel)')
    .eq('destinatario_id', userId)
    .eq('lida', false)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => {
    const autor = one(row.autor as Profile | Profile[] | null)
    return {
      id: row.id,
      postId: row.post_id,
      autor: autor
        ? profileToUsuario(autor)
        : { id: row.autor_id, nome: '—', iniciais: '—', papel: 'advogado' as const },
      resumo: row.resumo,
      lida: row.lida,
    }
  })
}

export function obterItensAtencao(): ItemAtencao[] {
  return []
}

export async function listarItensAtencao(): Promise<ItemAtencao[]> {
  const { data, error } = await supabase.from('itens_atencao').select('*')
  if (error) throw error
  return (data ?? []).map((row) => {
    if (row.tipo === 'prescricao') {
      return {
        id: row.id,
        tipo: 'prescricao' as const,
        cliente: row.cliente ?? '',
        meses: row.meses ?? 0,
        href: row.href,
      }
    }
    return {
      id: row.id,
      tipo: row.tipo as 'revisao' | 'memorial',
      quantidade: row.quantidade ?? 0,
      href: row.href,
    }
  })
}

export async function listarPosts(cursor?: string): Promise<ListarPostsResultado> {
  const userId = await getSessionUserId()
  let query = supabase
    .from('posts')
    .select('*, autor:profiles!posts_autor_id_fkey(id, nome, iniciais, papel)')
    .order('criado_em', { ascending: false })
    .limit(PAGE_SIZE + 1)

  if (cursor) {
    const { data: cursorRow } = await supabase
      .from('posts')
      .select('criado_em')
      .eq('id', cursor)
      .single()
    if (cursorRow) {
      query = query.lt('criado_em', cursorRow.criado_em)
    }
  }

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as PostRow[]
  const hasMore = rows.length > PAGE_SIZE
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows
  const posts = await hydratePosts(page, userId)
  return {
    posts,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  }
}

export async function publicarPost(input: PublicarPostInput): Promise<Post> {
  const userId = await getSessionUserId()
  const tipo = input.tipo ?? 'usuario'
  const id = `post-${crypto.randomUUID()}`

  let anexo = input.anexo
  if (input.anexoFile) {
    const file = input.anexoFile
    const anexoId = crypto.randomUUID()
    const path = `${id}/${anexoId}-${file.name}`
    const uploaded = await uploadFile('mural-anexos', path, file)
    const ext = file.name.split('.').pop()?.toUpperCase() ?? 'FILE'
    anexo = {
      id: anexoId,
      nome: file.name,
      formato: ext,
      tamanhoBytes: file.size,
      url: uploaded.url,
    }
  }

  const { error } = await supabase.from('posts').insert({
    id,
    tipo,
    autor_id: tipo === 'atualizacao' ? null : userId,
    texto: input.texto,
    caso_id: input.casoVinculado?.id ?? null,
    caso_snapshot: input.casoVinculado,
    anexo_id: anexo?.id ?? null,
    anexo_nome: anexo?.nome ?? null,
    anexo_formato: anexo?.formato ?? null,
    anexo_tamanho_bytes: anexo?.tamanhoBytes ?? null,
    anexo_versao: anexo?.versao ?? null,
    anexo_url: anexo?.url ?? null,
    restrito_a_socios: input.restritoASocios,
  })
  if (error) throw error

  if (input.mencoes.length > 0) {
    await supabase.from('post_mencoes').insert(
      input.mencoes.map((m) => ({
        post_id: id,
        usuario_id: m.usuarioId,
        offset_start: m.offset,
        length: m.length,
      })),
    )

    const autor = await carregarUsuarioAtual()
    const destinatarios = new Set(
      input.mencoes
        .map((m) => m.usuarioId)
        .filter((uid): uid is string => uid !== 'todos' && uid !== userId),
    )
    if (destinatarios.size > 0) {
      await supabase.from('marcacoes').insert(
        [...destinatarios].map((dest) => ({
          id: `marc-${crypto.randomUUID()}`,
          post_id: id,
          destinatario_id: dest,
          autor_id: autor.id,
          resumo: `mencionou você`,
          lida: false,
        })),
      )
    }
  }

  const { posts } = await listarPosts()
  const created = posts.find((p) => p.id === id)
  if (!created) {
    return {
      id,
      tipo,
      autor: tipo === 'atualizacao' ? null : await carregarUsuarioAtual(),
      texto: input.texto,
      mencoes: input.mencoes,
      casoVinculado: input.casoVinculado,
      anexo,
      restritoASocios: input.restritoASocios,
      curtidas: 0,
      curtidoPorMim: false,
      comentarios: [],
      totalComentarios: 0,
      criadoEm: new Date().toISOString(),
    }
  }
  return created
}

export async function curtirPost(id: string): Promise<void> {
  const userId = await getSessionUserId()
  const { data: existing } = await supabase
    .from('post_curtidas')
    .select('post_id')
    .eq('post_id', id)
    .eq('usuario_id', userId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('post_curtidas')
      .delete()
      .eq('post_id', id)
      .eq('usuario_id', userId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('post_curtidas').insert({
      post_id: id,
      usuario_id: userId,
    })
    if (error) throw error
  }
}

export async function comentar(postId: string, texto: string): Promise<Comentario> {
  const user = await carregarUsuarioAtual()
  const id = `c-${crypto.randomUUID()}`
  const { data, error } = await supabase
    .from('comentarios')
    .insert({
      id,
      post_id: postId,
      autor_id: user.id,
      texto,
    })
    .select('*, autor:profiles!comentarios_autor_id_fkey(id, nome, iniciais, papel)')
    .single()
  if (error) throw error
  const autor = one(data.autor as Profile | Profile[] | null)
  return {
    id: data.id,
    autor: autor ? profileToUsuario(autor) : user,
    texto: data.texto,
    criadoEm: data.criado_em,
  }
}

export async function marcarMencoesComoLidas(postId?: string): Promise<void> {
  const userId = await getSessionUserId()
  let query = supabase
    .from('marcacoes')
    .update({ lida: true })
    .eq('destinatario_id', userId)
    .eq('lida', false)
  if (postId) query = query.eq('post_id', postId)
  const { error } = await query
  if (error) throw error
}

export async function excluirPost(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) throw error
}

export async function excluirComentario(postId: string, comentarioId: string): Promise<void> {
  const { error } = await supabase
    .from('comentarios')
    .delete()
    .eq('id', comentarioId)
    .eq('post_id', postId)
  if (error) throw error
}
