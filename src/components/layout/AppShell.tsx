import { useEffect, useState } from 'react'
import App from '../../App'
import CasoDetalhe from '../../pages/CasoDetalhe'
import Casos from '../../pages/Casos'
import Home from '../../pages/Home'
import Materiais from '../../pages/Materiais'
import Parcerias from '../../pages/Parcerias'
import { useRouter } from '../../lib/router-context'
import { currentUser, loadCurrentUser } from '../../lib/session'
import { theme } from '../../theme'
import { Sidebar, type SidebarNavItem } from './Sidebar'
import { FinanceiroApp, financeiroNavItem, verificarAcessoFinanceiro } from '../../modules/financeiro'
import './layout.css'

function casoIdDe(pathname: string): string | null {
  const match = /^\/casos\/([^/]+)$/.exec(pathname)
  const id = match?.[1]
  if (!id || id === 'novo') return null
  return decodeURIComponent(id)
}

type AppShellProps = {
  onSignOut: () => void
}

export function AppShell({ onSignOut }: AppShellProps) {
  const { pathname } = useRouter()
  const isCalculator = pathname === '/calculadora'
  const casoId = casoIdDe(pathname)
  const [finOk, setFinOk] = useState(() => currentUser.papel === 'socio')

  useEffect(() => {
    void loadCurrentUser()
      .then((user) => {
        if (user.papel === 'socio') setFinOk(true)
      })
      .catch(() => {})
    void verificarAcessoFinanceiro().then((ok) => {
      if (ok) setFinOk(true)
    })
  }, [])

  const extraItems: SidebarNavItem[] = finOk ? [financeiroNavItem] : []

  return (
    <div className="app-shell">
      <Sidebar onSignOut={onSignOut} extraItems={extraItems} />
      <main
        className={isCalculator ? 'shell-main shell-main--calculator' : 'shell-main'}
        style={{ background: theme.contentBg }}
      >
        {pathname === '/' ? <Home /> : null}
        {isCalculator ? <App /> : null}
        {pathname === '/casos' ? <Casos /> : null}
        {casoId ? <CasoDetalhe id={casoId} /> : null}
        {pathname === '/parcerias' ? <Parcerias /> : null}
        {pathname === '/materiais' ? <Materiais /> : null}
        {pathname === '/financeiro' || pathname.startsWith('/financeiro/') ? <FinanceiroApp /> : null}
      </main>
    </div>
  )
}
