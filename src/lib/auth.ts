import { isSupabaseConfigured, supabase, getProfile, type Profile } from './supabase'
import { invalidarSessaoCfg } from '../modules/configuracoes/acesso'
import {
  confirmarPosLogin,
  loginLiberado,
  logoutServidor,
  registrarLoginFalho,
} from '../modules/configuracoes/data/repositorio'

const MSG = 'E-mail ou senha incorretos.'
const AUTH_STORAGE_KEY = 'verum.auth'
const DEMO_EMAIL = 'admin@admin.com'
const DEMO_PASSWORDS = new Set(['1234', '123456'])

function hasDemoSession(): boolean {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) === '1' || sessionStorage.getItem(AUTH_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function persistDemoSession(rememberMe: boolean) {
  const storage = rememberMe ? localStorage : sessionStorage
  const other = rememberMe ? sessionStorage : localStorage
  storage.setItem(AUTH_STORAGE_KEY, '1')
  other.removeItem(AUTH_STORAGE_KEY)
}

function clearDemoSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  sessionStorage.removeItem(AUTH_STORAGE_KEY)
}

export async function isAuthenticated(): Promise<boolean> {
  if (!isSupabaseConfigured) return hasDemoSession()
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

/** Sync check for initial render — uses cached session from supabase client. */
export function hasCachedSession(): boolean {
  if (!isSupabaseConfigured) return hasDemoSession()
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

export async function signIn(email: string, password: string, rememberMe = false): Promise<void> {
  if (!isSupabaseConfigured) {
    const accepted = email.trim().toLowerCase() === DEMO_EMAIL && DEMO_PASSWORDS.has(password)
    if (!accepted) throw new Error(MSG)
    persistDemoSession(rememberMe)
    invalidarSessaoCfg()
    return
  }

  const liberado = await loginLiberado(email.trim()).catch(() => true)
  if (!liberado) throw new Error(MSG)
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) {
    await registrarLoginFalho(email.trim()).catch(() => undefined)
    throw new Error(MSG)
  }
  const pos = await confirmarPosLogin().catch(() => ({ ok: true as const, data: true as const }))
  if (!pos.ok) {
    await supabase.auth.signOut()
    throw new Error(MSG)
  }
  invalidarSessaoCfg()
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured) {
    clearDemoSession()
    invalidarSessaoCfg()
    return
  }
  await logoutServidor().catch(() => undefined)
  invalidarSessaoCfg()
  await supabase.auth.signOut()
}

export async function getCurrentProfile(): Promise<Profile> {
  return getProfile()
}

export function onAuthChange(callback: (authenticated: boolean) => void) {
  if (!isSupabaseConfigured) {
    return () => {}
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(Boolean(session))
  })
  return () => data.subscription.unsubscribe()
}
