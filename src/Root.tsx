import { useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { Router } from './lib/router'
import { useRouter } from './lib/router-context'
import { hasCachedSession, isAuthenticated, onAuthChange, signOut } from './lib/auth'
import { loadCurrentUser } from './lib/session'
import { carregarEquipe, carregarUsuarioAtual } from './lib/mural'
import Escritorio from './pages/escritorio/Escritorio'
import Login from './pages/Login'
import { ConvitePage, RecuperarSenhaPage, RedefinirSenhaPage } from './modules/configuracoes'

function isPublicAuthPath(pathname: string) {
  return pathname.startsWith('/convite/') || pathname === '/recuperar-senha' || pathname.startsWith('/redefinir-senha/')
}

function AppGate() {
  const { pathname } = useRouter()
  const [authenticated, setAuthenticated] = useState(() => hasCachedSession())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ok = await isAuthenticated()
      if (cancelled) return
      setAuthenticated(ok)
      if (ok) {
        try {
          await Promise.all([loadCurrentUser(), carregarEquipe(), carregarUsuarioAtual()])
        } catch {
          /* perfil pode falhar se seed ainda não rodou */
        }
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [pathname])

  useEffect(() => {
    return onAuthChange((ok) => {
      setAuthenticated(ok)
      if (ok) {
        void Promise.all([loadCurrentUser(), carregarEquipe(), carregarUsuarioAtual()])
      }
    })
  }, [])

  if (pathname === '/escritorio' || pathname.startsWith('/escritorio/')) {
    return <Escritorio />
  }

  if (isPublicAuthPath(pathname)) {
    if (pathname.startsWith('/convite/')) {
      return <ConvitePage token={decodeURIComponent(pathname.slice('/convite/'.length))} />
    }
    if (pathname.startsWith('/redefinir-senha/')) {
      return <RedefinirSenhaPage token={decodeURIComponent(pathname.slice('/redefinir-senha/'.length))} />
    }
    return <RecuperarSenhaPage />
  }

  if (!ready && hasCachedSession()) {
    return null
  }

  if (!authenticated) {
    return <Login onSuccess={() => setAuthenticated(true)} />
  }

  return (
    <AppShell
      onSignOut={() => {
        void signOut().then(() => setAuthenticated(false))
      }}
    />
  )
}

export function Root() {
  return (
    <Router>
      <AppGate />
    </Router>
  )
}
