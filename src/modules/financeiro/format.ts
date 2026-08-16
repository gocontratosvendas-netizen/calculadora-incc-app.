const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const dataLonga = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function asDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
}

export function formatarMoeda(centavos: number, comSimbolo = true): string {
  const absoluto = Math.abs(centavos) / 100
  const corpo = comSimbolo ? moeda.format(absoluto) : decimal.format(absoluto)
  if (centavos < 0) {
    return comSimbolo ? `−${corpo.replace('R$', '').trim()}` : `(${decimal.format(absoluto)})`
  }
  return comSimbolo ? corpo : corpo
}

export function formatarMoedaContabil(centavos: number, comSimbolo = false): string {
  const absoluto = Math.abs(centavos) / 100
  const corpo = comSimbolo ? moeda.format(absoluto) : decimal.format(absoluto)
  if (centavos < 0) return `(${comSimbolo ? corpo.replace('R$', '').trim() : corpo})`
  return corpo
}

export function formatarPercentual(razao: number | null): string {
  if (razao === null || Number.isNaN(razao)) return '—'
  return `${pct.format(razao * 100)}%`
}

export function formatarVariacao(razao: number | null): string {
  if (razao === null || Number.isNaN(razao)) return '—'
  const sinal = razao > 0 ? '+' : razao < 0 ? '−' : ''
  return `${sinal}${pct.format(Math.abs(razao) * 100)}%`
}

export function formatarDataTabela(iso: string | null): string {
  if (!iso) return ''
  return dataCurta.format(asDate(iso))
}

export function formatarDataLonga(iso: string): string {
  return dataLonga.format(asDate(iso))
}

export function rotuloRegime(regime: 'competencia' | 'caixa'): string {
  return regime === 'competencia' ? 'Competência' : 'Caixa'
}
