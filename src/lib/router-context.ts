import { createContext, useContext } from 'react'

export type RouterContextValue = {
  pathname: string
  search: string
  navigate: (to: string, options?: { replace?: boolean }) => void
}

export const RouterContext = createContext<RouterContextValue | null>(null)

export function useRouter(): RouterContextValue {
  const context = useContext(RouterContext)
  if (!context) {
    throw new Error('useRouter deve ser usado dentro de Router')
  }
  return context
}
