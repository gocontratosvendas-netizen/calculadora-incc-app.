import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from '../../lib/router'
import { useRouter } from '../../lib/router-context'
import { currentUser, loadCurrentUser, type SessionUser } from '../../lib/session'
import { theme } from '../../theme'

const NAV_ITEMS = [
  { to: '/', label: 'Início', icon: 'home' },
  { to: '/calculadora', label: 'Calculadora', icon: 'calculator' },
  { to: '/casos', label: 'Casos', icon: 'briefcase' },
  { to: '/parcerias', label: 'Parcerias', icon: 'handshake' },
  { to: '/materiais', label: 'Documentos', icon: 'folders' },
  { to: '/financeiro', label: 'Financeiro', icon: 'chart' },
] as const

function isActivePath(pathname: string, to: string) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

function IconHome() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.75" y="1.75" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8.75" y="1.75" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1.75" y="8.75" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8.75" y="8.75" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function IconCalculator() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.25" y="1.75" width="11.5" height="12.5" rx="1.1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="4.25" y="3.6" width="7.5" height="2.2" fill="currentColor" />
      <rect x="4.25" y="7.4" width="1.7" height="1.55" fill="currentColor" />
      <rect x="7.15" y="7.4" width="1.7" height="1.55" fill="currentColor" />
      <rect x="10.05" y="7.4" width="1.7" height="1.55" fill="currentColor" />
      <rect x="4.25" y="10.4" width="1.7" height="1.55" fill="currentColor" />
      <rect x="7.15" y="10.4" width="1.7" height="1.55" fill="currentColor" />
      <rect x="10.05" y="10.4" width="1.7" height="2.6" fill="currentColor" />
    </svg>
  )
}

function IconBriefcase() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.75" y="5.25" width="12.5" height="8.5" rx="1.1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 5.25V3.9A1.15 1.15 0 0 1 6.65 2.75h2.7A1.15 1.15 0 0 1 10.5 3.9v1.35" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.75 8.5h12.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function IconHandshake() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.8 7.2 4.1 5.1a1.2 1.2 0 0 1 1.55-.08l1.55 1.2 1.4-1.15a1.15 1.15 0 0 1 1.45 0L14.2 8.1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.35 7.55v2.4c0 .55.35 1.05.88 1.22l2.02.66c.38.12.79.08 1.14-.12L8.1 10.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.65 8.25v1.85c0 .5-.3.95-.77 1.15l-1.78.76a1.8 1.8 0 0 1-1.3 0l-1.05-.45"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.7 8.55 8 9.65l1.45-1.05"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconFolders() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.1 6.3V4.35c0-.5.4-.9.9-.9h2.2l1.15 1.2h4.2c.5 0 .9.4.9.9v1.75"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M2.7 6.55h10.1c.72 0 1.25.67 1.08 1.37l-.72 3.2a1.15 1.15 0 0 1-1.12.88H3.46a1.15 1.15 0 0 1-1.12-.88l-.72-3.2c-.17-.7.36-1.37 1.08-1.37Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconChart() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 12.5V6.5M6.25 12.5V3.5M10 12.5V8M13.5 12.5V5.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2 13.25h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

const ICONS: Record<(typeof NAV_ITEMS)[number]['icon'], () => ReactNode> = {
  home: IconHome,
  calculator: IconCalculator,
  briefcase: IconBriefcase,
  handshake: IconHandshake,
  folders: IconFolders,
  chart: IconChart,
}

function IconSettings() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 1.7v1.4M8 12.9v1.4M1.7 8h1.4M12.9 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 3H3.6A1.1 1.1 0 0 0 2.5 4.1v7.8A1.1 1.1 0 0 0 3.6 13H6M7 8h6.2M10.7 5.5 13.5 8l-2.8 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

type SidebarProps = {
  onSignOut: () => void
  showSettings?: boolean
}

export function Sidebar({ onSignOut, showSettings = false }: SidebarProps) {
  const { pathname } = useRouter()
  const [user, setUser] = useState<SessionUser>(() => ({ ...currentUser }))
  const settingsActive = isActivePath(pathname, '/configuracoes')

  useEffect(() => {
    void loadCurrentUser()
      .then(setUser)
      .catch(() => setUser({ ...currentUser }))
  }, [])

  const sidebarVars = {
    '--theme-gold': theme.gold,
    '--theme-wordmark': theme.wordmark,
    '--theme-sidebar-text': theme.sidebarTextInactive,
    '--theme-sidebar-icon': theme.sidebarIconInactive,
    '--theme-sidebar-hover': theme.sidebarHoverBg,
    '--theme-sidebar-active': theme.sidebarActiveBg,
    '--theme-sidebar-focus': theme.sidebarFocus,
    '--theme-sidebar-divider': theme.sidebarDivider,
    '--theme-avatar-bg': theme.avatarBg,
    '--theme-avatar-initials': theme.avatarInitials,
    '--theme-user-name': theme.userName,
    '--theme-user-role': theme.userRole,
  } as CSSProperties

  return (
    <aside className="sidebar" style={{ background: theme.sidebarBg, ...sidebarVars }}>
      <div>
        <div className="sidebar-brand">
          <div className="sidebar-monogram" aria-hidden="true">
            V
          </div>
          <span className="sidebar-wordmark">VERUM</span>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon]
            const active = isActivePath(pathname, item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={active ? 'sidebar-link is-active' : 'sidebar-link'}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                title={item.label}
              >
                <Icon />
                <span className="sidebar-link-label">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="sidebar-footer">
        <hr className="sidebar-footer-rule" />
        <nav className="sidebar-nav" aria-label="Conta">
          {showSettings ? (
            <Link
              to="/configuracoes"
              className={settingsActive ? 'sidebar-link is-active' : 'sidebar-link'}
              aria-current={settingsActive ? 'page' : undefined}
              aria-label="Configurações"
              title="Configurações"
            >
              <IconSettings />
              <span className="sidebar-link-label">Configurações</span>
            </Link>
          ) : null}
          <button type="button" className="sidebar-link" onClick={onSignOut} aria-label="Sair" title="Sair">
            <IconLogout />
            <span className="sidebar-link-label">Sair</span>
          </button>
        </nav>
        <div className="sidebar-user" style={{ marginTop: 12, cursor: 'default' }}>
          <span className="sidebar-avatar">{user.initials}</span>
          <span className="sidebar-user-copy">
            <span className="sidebar-user-name">{user.fullName}</span>
            <span className="sidebar-user-role">{user.role}</span>
          </span>
        </div>
      </div>
    </aside>
  )
}
