import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function env(name: string): string {
  const value = import.meta.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

const url = env('VITE_SUPABASE_URL')
const anonKey = env('VITE_SUPABASE_ANON_KEY')

export const isSupabaseConfigured = Boolean(url && anonKey)

export type Profile = {
  id: string
  nome: string
  iniciais: string
  papel: 'socio' | 'advogado'
}

export const DEMO_PROFILE: Profile = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  nome: 'Helena Duarte',
  iniciais: 'HD',
  papel: 'socio',
}

const DEMO_PROFILES: Profile[] = [
  DEMO_PROFILE,
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', nome: 'Vitor P.', iniciais: 'VP', papel: 'socio' },
  { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', nome: 'Rafaela Moura', iniciais: 'RM', papel: 'socio' },
  { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', nome: 'Lucas Ferreira', iniciais: 'LF', papel: 'advogado' },
  { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', nome: 'Camila Barros', iniciais: 'CB', papel: 'advogado' },
  { id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', nome: 'Paulo Mendes', iniciais: 'PM', papel: 'advogado' },
]

const PLACEHOLDER_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

function fetchDisabled(): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify({ message: 'Supabase não configurado neste ambiente.', code: 'UNCONFIGURED' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

export const supabase: SupabaseClient = createClient(url || 'https://localhost', anonKey || PLACEHOLDER_JWT, {
  auth: {
    persistSession: isSupabaseConfigured,
    autoRefreshToken: isSupabaseConfigured,
    detectSessionInUrl: isSupabaseConfigured,
  },
  global: isSupabaseConfigured ? {} : { fetch: fetchDisabled },
})

export async function getSessionUserId(): Promise<string> {
  if (!isSupabaseConfigured) return DEMO_PROFILE.id
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const id = data.session?.user?.id
  if (!id) throw new Error('Não autenticado')
  return id
}

export async function getProfile(userId?: string): Promise<Profile> {
  if (!isSupabaseConfigured) {
    return DEMO_PROFILES.find((p) => p.id === userId) ?? DEMO_PROFILE
  }
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
  if (!isSupabaseConfigured) return DEMO_PROFILES
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
