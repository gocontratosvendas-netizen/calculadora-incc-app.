import { createElement, type ReactNode } from 'react'

function IconFinanceiro() {
  return createElement(
    'svg',
    { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
    createElement('path', {
      d: 'M2.5 12.5V6.5M6.25 12.5V3.5M10 12.5V8M13.5 12.5V5.25',
      stroke: 'currentColor',
      strokeWidth: '1.2',
      strokeLinecap: 'round',
    }),
    createElement('path', {
      d: 'M2 13.25h12',
      stroke: 'currentColor',
      strokeWidth: '1.2',
      strokeLinecap: 'round',
    }),
  )
}

export type ExtraNavItem = {
  to: string
  label: string
  icon: () => ReactNode
}

export const financeiroNavItem: ExtraNavItem = {
  to: '/financeiro',
  label: 'Financeiro',
  icon: IconFinanceiro,
}
