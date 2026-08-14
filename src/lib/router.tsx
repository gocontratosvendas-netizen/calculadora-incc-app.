import { useCallback, useEffect, useMemo, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { RouterContext, useRouter } from './router-context'

export function Router({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname) return
    window.history.pushState(null, '', to)
    setPathname(to)
  }, [])

  const value = useMemo(() => ({ pathname, navigate }), [pathname, navigate])

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string
}

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useRouter()

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
      return
    }
    event.preventDefault()
    navigate(to)
  }

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
