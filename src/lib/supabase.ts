import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local (veja .env.example).',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export type Profile = {
  id: string
  nome: string
  iniciais: string
  papel: 'socio' | 'advogado'
}

export async function getSessionUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const id = data.session?.user?.id
  if (!id) throw new Error('Não autenticado')
  return id
}

export async function getProfile(userId?: string): Promise<Profile> {
  const id = userId ?? (await getSessionUserId())
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, iniciais, papel')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Profile
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, iniciais, papel')
    .order('nome')
  if (error) throw error
  return (data ?? []) as Profile[]
}

export function publicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadFile(
  bucket: 'casos-arquivos' | 'mural-anexos' | 'materiais',
  path: string,
  file: File,
): Promise<{ path: string; url: string }> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  })
  if (error) throw error
  return { path, url: publicUrl(bucket, path) }
}
