import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'

type Common = {
  variant?: 'primary' | 'secondary' | 'nav'
  block?: boolean
}

type ButtonAsButton = Common &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined
  }

type ButtonAsLink = Common &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
  }

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = 'primary', block, className, ...rest } = props
  const classes = [
    'esc-btn',
    `esc-btn--${variant}`,
    block ? 'esc-btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  if ('href' in props && props.href) {
    const { href, children, ...linkRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement>
    return (
      <a href={href} className={classes} {...linkRest}>
        {children}
      </a>
    )
  }

  const { children, type = 'button', ...buttonRest } =
    rest as ButtonHTMLAttributes<HTMLButtonElement>
  return (
    <button type={type} className={classes} {...buttonRest}>
      {children}
    </button>
  )
}
