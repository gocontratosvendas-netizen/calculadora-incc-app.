import App from '../../App'
import Home from '../../pages/Home'
import Materiais from '../../pages/Materiais'
import { useRouter } from '../../lib/router-context'
import { theme } from '../../theme'
import { Sidebar } from './Sidebar'
import './layout.css'

type AppShellProps = {
  onSignOut: () => void
}

export function AppShell({ onSignOut }: AppShellProps) {
  const { pathname } = useRouter()
  const isCalculator = pathname === '/calculadora'

  return (
    <div className="app-shell">
      <Sidebar onSignOut={onSignOut} />
      <main
        className={isCalculator ? 'shell-main shell-main--calculator' : 'shell-main'}
        style={{ background: theme.contentBg }}
      >
        {pathname === '/' ? <Home /> : null}
        {isCalculator ? <App /> : null}
        {pathname === '/materiais' ? <Materiais /> : null}
      </main>
    </div>
  )
}
