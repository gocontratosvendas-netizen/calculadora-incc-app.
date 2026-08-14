type MonogramProps = {
  size?: 'md' | 'sm'
}

export function Monogram({ size = 'md' }: MonogramProps) {
  return (
    <div
      className={size === 'sm' ? 'esc-monogram esc-monogram--sm' : 'esc-monogram esc-monogram--md'}
      aria-hidden="true"
    >
      P
    </div>
  )
}
