import type { ReactNode } from 'react'

type SectionTitleProps = {
  children: ReactNode
  onDark?: boolean
  id?: string
}

export function SectionTitle({ children, onDark, id }: SectionTitleProps) {
  return (
    <h2 id={id} className={onDark ? 'esc-title esc-title--on-dark' : 'esc-title'}>
      {children}
    </h2>
  )
}
