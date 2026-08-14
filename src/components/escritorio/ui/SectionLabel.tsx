type SectionLabelProps = {
  children: string
  onDark?: boolean
}

export function SectionLabel({ children, onDark }: SectionLabelProps) {
  return (
    <p className={onDark ? 'esc-label esc-label--on-dark' : 'esc-label'}>
      {children}
    </p>
  )
}
