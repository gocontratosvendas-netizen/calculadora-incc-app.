import { useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { Router } from './lib/router'
import { useRouter } from './lib/router-context'
import { isAuthenticated, signOut } from './lib/auth'
import Escritorio from './pages/escritorio/Escritorio'
import Login from './pages/Login'

function isEscritorioPath(pathname: string) {
  return pathname === '/escritorio' || pathname.startsWith('/escritorio/')
}

function AppGate() {
  const { pathname } = useRouter()
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated())

  useEffect(() => {
    setAuthenticated(isAuthenticated())
  }, [pathname])

  if (isEscritorioPath(pathname)) {
    return <Escritorio />
  }

  if (!authenticated) {
    return <Login onSuccess={() => setAuthenticated(true)} />
  }

  return (
    <AppShell
      onSignOut={() => {
        signOut()
        setAuthenticated(false)
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
