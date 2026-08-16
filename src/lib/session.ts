import { getProfile, listProfiles, type Profile } from './supabase'

export type SessionUser = {
  id: string
  firstName: string
  fullName: string
  role: string
  initials: string
  papel: Profile['papel']
}

function primeiroNome(nome: string) {
  return nome.split(/\s+/)[0]?.replace(/\.$/, '') || nome
}

function rotuloPapel(profile: Profile) {
  const feminino = /a\s*$/i.test(profile.nome.split(/\s+/)[0] ?? '') ||
    ['Rafaela', 'Helena', 'Camila'].some((n) => profile.nome.startsWith(n))
  if (profile.papel === 'socio') return feminino ? 'Sócia' : 'Sócio'
  return feminino ? 'Advogada' : 'Advogado'
}

export function profileToSessionUser(profile: Profile): SessionUser {
  return {
    id: profile.id,
    firstName: primeiroNome(profile.nome),
    fullName: profile.nome,
    role: rotuloPapel(profile),
    initials: profile.iniciais,
    papel: profile.papel,
  }
}

/** Fallback used only before hydration — Sidebar should load real profile. */
export const currentUser: SessionUser = {
  id: '',
  firstName: '…',
  fullName: '…',
  role: '',
  initials: '…',
  papel: 'advogado',
}

let cached: SessionUser | null = null

export async function loadCurrentUser(): Promise<SessionUser> {
  const profile = await getProfile()
  cached = profileToSessionUser(profile)
  Object.assign(currentUser, cached)
  return cached
}

export function getCachedCurrentUser(): SessionUser | null {
  return cached
}

export async function loadEquipe(): Promise<Profile[]> {
  return listProfiles()
}
