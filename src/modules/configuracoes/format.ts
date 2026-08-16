const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const dataLonga = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function asDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
}

export function formatarMoeda(centavos: number): string {
  return moeda.format(Math.abs(centavos) / 100)
}

export function formatarParticipacao(percentual: number): string {
  return `${pct.format(percentual).replace('\u00a0', '')}%`
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  return dataLonga.format(asDate(iso))
}

export function formatarDataHora(iso: string): string {
  return dataHora.format(new Date(iso))
}

export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  const primeira = partes[0][0] ?? ''
  const ultima = partes[partes.length - 1][0] ?? ''
  return (primeira + ultima).toUpperCase()
}

export function hojeISO(agora = new Date()): string {
  const y = agora.getFullYear()
  const m = String(agora.getMonth() + 1).padStart(2, '0')
  const d = String(agora.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
