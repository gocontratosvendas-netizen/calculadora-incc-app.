const AUTH_STORAGE_KEY = 'verum.auth'

export function isAuthenticated(): boolean {
  return (
    localStorage.getItem(AUTH_STORAGE_KEY) === '1' ||
    sessionStorage.getItem(AUTH_STORAGE_KEY) === '1'
  )
}

export function persistSession(rememberMe: boolean) {
  const storage = rememberMe ? localStorage : sessionStorage
  const other = rememberMe ? sessionStorage : localStorage
  storage.setItem(AUTH_STORAGE_KEY, '1')
  other.removeItem(AUTH_STORAGE_KEY)
}

export function signOut() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  sessionStorage.removeItem(AUTH_STORAGE_KEY)
}
