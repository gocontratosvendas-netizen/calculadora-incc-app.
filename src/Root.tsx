import { useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { Router } from './lib/router'
import { isAuthenticated, signOut } from './lib/auth'
import Login from './pages/Login'

export function Root() {
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated())

  if (!authenticated) {
    return <Login onSuccess={() => setAuthenticated(true)} />
  }

  return (
    <Router>
      <AppShell
        onSignOut={() => {
          signOut()
          setAuthenticated(false)
        }}
      />
    </Router>
  )
}
