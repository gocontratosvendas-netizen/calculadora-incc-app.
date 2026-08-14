import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from '../../lib/router'
import { useRouter } from '../../lib/router-context'
import { currentUser } from '../../lib/session'
import { theme } from '../../theme'

const NAV_ITEMS = [
  { to: '/', label: 'Início', icon: 'home' },
  { to: '/calculadora', label: 'Calculadora', icon: 'calculator' },
  { to: '/casos', label: 'Casos', icon: 'briefcase' },
  { to: '/memoriais', label: 'Memoriais', icon: 'memorial' },
  { to: '/materiais', label: 'Documentos', icon: 'folders' },
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

function IconMemorial() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.25 2.25h5.1L12.25 5v8.75H4.25V2.25Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9.3 2.35V5h2.7" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M6 12V9.4M8 12V8.2M10 12v-2.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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

const ICONS: Record<(typeof NAV_ITEMS)[number]['icon'], () => ReactNode> = {
  home: IconHome,
  calculator: IconCalculator,
  briefcase: IconBriefcase,
  memorial: IconMemorial,
  folders: IconFolders,
}

type SidebarProps = {
  onSignOut: () => void
}

export function Sidebar({ onSignOut }: SidebarProps) {
  const { pathname } = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const footerRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!footerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

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

      <div className="sidebar-footer" ref={footerRef}>
        <hr className="sidebar-footer-rule" />
        <button
          type="button"
          className="sidebar-user"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sidebar-avatar">{currentUser.initials}</span>
          <span className="sidebar-user-copy">
            <span className="sidebar-user-name">{currentUser.fullName}</span>
            <span className="sidebar-user-role">{currentUser.role}</span>
          </span>
        </button>
        {menuOpen ? (
          <div className="sidebar-menu" id={menuId} role="menu">
            <Link
              to="/configuracoes"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              Configurações
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onSignOut()
              }}
            >
              Sair
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
