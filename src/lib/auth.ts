import { supabase, getProfile, type Profile } from './supabase'

export async function isAuthenticated(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

/** Sync check for initial render — uses cached session from supabase client. */
export function hasCachedSession(): boolean {
  // supabase-js hydrates from localStorage synchronously on createClient
  const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
  if (!key) return false
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { access_token?: string; expires_at?: number }
    if (!parsed.access_token) return false
    if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) return false
    return true
  } catch {
    return false
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw new Error('E-mail ou senha incorretos.')
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getCurrentProfile(): Promise<Profile> {
  return getProfile()
}

export function onAuthChange(callback: (authenticated: boolean) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(Boolean(session))
  })
  return () => data.subscription.unsubscribe()
}
